import Foundation
import UIKit

/// Sending one photograph to the church's galleries.
///
/// The Swift port of `src/clip/clipUpload.ts`, and the contract it describes is
/// the app's, unchanged:
///
///   1. sign in anonymously, because `galleryUploadUrl` attributes an upload to
///      a uid for its daily cap;
///   2. mint a reservation from `/api/gallery/upload-url`, carrying an App Check
///      token;
///   3. PUT the bytes straight to Cloud Storage with **both** pinned headers.
///
/// The signed URL is pinned to one object name, one content type and — through
/// `extensionHeaders` — an exact content length. Get either header wrong and
/// Cloud Storage refuses the PUT, and because that refusal comes from
/// `storage.googleapis.com` rather than the Function, there is no Function log
/// to explain it. `upload/uploader.ts` in the app carries the long-form version
/// of this note; keep the two in step.
enum UploadClient {
    struct Section {
        let programId: String
        let programEventId: String
        let title: String
    }

    enum Failure: LocalizedError {
        case unattested(String)
        case noSection
        case refused(String)

        var errorDescription: String? {
            switch self {
            case .unattested(let why): return why
            case .noSection:
                return "The church is not collecting photographs for anything just now."
            case .refused(let why): return why
            }
        }
    }

    /// Where photographs go today — `config/events.mainSection`, resolved.
    ///
    /// The clip reads the setting and the program's own default node over REST.
    /// The app's `gallery/mainSection.ts` does considerably more than this, with
    /// four documented fallbacks for a tree of sub-events; the clip takes the
    /// simple case and refuses honestly when there is not one, because a
    /// photograph filed against a guess is worse than one not taken.
    static func mainSection() async throws -> Section {
        let config = try await FirestoreREST.document("config/events")
        guard let programId = config["mainSection"]?.stringValue, !programId.isEmpty else {
            throw Failure.noSection
        }

        let program = try await FirestoreREST.document("programs/\(programId)")
        let title = program["name"]?.stringValue ?? "the church's galleries"

        /*
         * `defaultSubmissionNode` in the app walks the program's event tree. The
         * clip uses the documented fourth fallback — the program's own id — which
         * is what the app lands on when nothing more specific is set, and is
         * always a valid submission node.
         */
        let node = program["defaultSubmissionNode"]?.stringValue ?? programId

        return Section(programId: programId, programEventId: node, title: title)
    }

    /// Anonymous sign-in, over the Auth REST API.
    ///
    /// A clip gets a fresh anonymous user on nearly every invocation, because
    /// its storage does not survive. That makes the per-uid daily cap close to
    /// useless for clip traffic and is not a problem: `galleryUploadUrl` also
    /// caps per hashed IP, which is the limit that actually holds here.
    private static func idToken() async throws -> String {
        var request = URLRequest(
            url: URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\(ClipConfig.firebaseApiKey)")!
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(#"{"returnSecureToken":true}"#.utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = json["idToken"] as? String
        else {
            throw Failure.refused("The church's sign-in could not be reached.")
        }
        return token
    }

    private struct Reservation: Decodable {
        let uploadUrl: String
        let mediaId: String
        let contentType: String
    }

    /// Condense, reserve, send.
    static func send(
        image: UIImage,
        to section: Section,
        onProgress: @escaping (Double) -> Void
    ) async throws -> String {
        /*
         * Re-encoded rather than sent as captured, and this is not an
         * optimisation to be skipped for one file: the re-encode is what drops
         * the EXIF block, and a photograph taken in a church should not arrive
         * carrying the coordinates it was taken at. The server strip in
         * `functions/src/galleries.ts` is the guarantee; this is the courtesy,
         * exactly as `upload/condense.ts` frames it.
         */
        guard let data = condense(image) else {
            throw Failure.refused("That photograph could not be prepared for sending.")
        }

        onProgress(0.1)

        let attestation: String
        do {
            attestation = try await AppAttest.token()
        } catch let failure as AppAttest.Failure {
            switch failure {
            case .unsupported:
                throw Failure.unattested(
                    "This sample cannot prove it is genuine, which the church requires before accepting a photograph. The full app can."
                )
            case .notConfigured:
                throw Failure.unattested(
                    "Sending photographs from this sample is not switched on yet. The full app can send them."
                )
            case .refused(let why):
                throw Failure.unattested("The church could not verify this sample. \(why)")
            }
        }

        onProgress(0.2)
        let token = try await idToken()

        var reserve = URLRequest(url: ClipConfig.api("/api/gallery/upload-url"))
        reserve.httpMethod = "POST"
        reserve.setValue("application/json", forHTTPHeaderField: "Content-Type")
        reserve.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        reserve.setValue(attestation, forHTTPHeaderField: "X-Firebase-AppCheck")
        reserve.httpBody = try JSONSerialization.data(withJSONObject: [
            "programId": section.programId,
            "programEventId": section.programEventId,
            "contentType": "image/jpeg",
            "byteSize": data.count,
        ])

        let (body, response) = try await URLSession.shared.data(for: reserve)
        guard let http = response as? HTTPURLResponse else {
            throw Failure.refused("The church could not be reached.")
        }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                throw Failure.unattested(
                    "The church would not accept a photograph from this sample. The full app can send it."
                )
            }
            throw Failure.refused("The church could not take a photograph just now.")
        }

        let reservation = try JSONDecoder().decode(Reservation.self, from: body)
        onProgress(0.35)

        var put = URLRequest(url: URL(string: reservation.uploadUrl)!)
        put.httpMethod = "PUT"
        put.setValue(reservation.contentType, forHTTPHeaderField: "Content-Type")
        // Both pinned headers, exactly. See the file header.
        put.setValue("\(data.count),\(data.count)", forHTTPHeaderField: "x-goog-content-length-range")
        put.timeoutInterval = 120

        let (_, putResponse) = try await URLSession.shared.upload(for: put, from: data)
        guard let putHTTP = putResponse as? HTTPURLResponse,
              (200..<300).contains(putHTTP.statusCode)
        else {
            throw Failure.refused("That photograph could not be sent. Please try it again.")
        }

        onProgress(1)
        return reservation.mediaId
    }

    /// The app's ladder, shortened.
    ///
    /// `upload/condense.ts` steps down edge then quality, because a smaller
    /// picture at decent quality reads better than a large one at poor quality.
    /// One photograph in a foreground upload does not need the whole ladder —
    /// 2048px at 0.72 lands comfortably inside what a phone on church wifi
    /// finishes while its owner waits.
    private static func condense(_ image: UIImage) -> Data? {
        let maxEdge: CGFloat = 2048
        let longest = max(image.size.width, image.size.height)
        let scale = longest > maxEdge ? maxEdge / longest : 1

        guard scale < 1 else { return image.jpegData(compressionQuality: 0.72) }

        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        return resized.jpegData(compressionQuality: 0.72)
    }
}
