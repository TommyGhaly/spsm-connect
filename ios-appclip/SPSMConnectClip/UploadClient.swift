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
    /// One place a photograph can be filed: the ministry itself, or a level
    /// under it. `submissionTargets` in `@spsm/shared`'s `gallery/tree.ts`.
    struct Target: Identifiable, Equatable {
        let id: String
        let title: String
        /// Zero for the ministry, one for its direct levels, and so on.
        let depth: Int
        /// The titles from the ministry down, so "Week 1" says which year.
        let trail: [String]

        /// "Summer Camp 2026, Week 1" — the trail without the ministry, which
        /// the screen already names, or the ministry alone for its own row.
        var label: String {
            trail.count > 1 ? trail.dropFirst().joined(separator: ", ") : title
        }
    }

    /// Where photographs go today — `config/events.mainSection`, resolved —
    /// and every other place in that ministry somebody may choose instead.
    struct Destination {
        let programId: String
        let programName: String
        /// The ministry first, then its levels in reading order.
        let targets: [Target]
        /// The one the parish chose, or the best fallback. Always in `targets`.
        let suggested: Target
    }

    enum Failure: LocalizedError {
        case unattested(String)
        case noSection
        case refused(String)

        var errorDescription: String? {
            switch self {
            case .unattested(let why): return why
            case .noSection:
                return "The church is not collecting photos for anything just now."
            case .refused(let why): return why
            }
        }
    }

    /// The app's `gallery/mainSection.ts`, in Swift.
    ///
    /// It used to read `program.defaultSubmissionNode`, which no document has
    /// ever carried — the administrators' choice is `prioritySubmissionNodeId`
    /// — so every clip photograph was filed on the ministry rather than on the
    /// week the parish had picked. This walks the same tree the app does and
    /// lands where the app lands.
    static func destination() async throws -> Destination {
        let config = try await FirestoreREST.document("config/events")
        guard let programId = config["mainSection"]?.stringValue, !programId.isEmpty else {
            throw Failure.noSection
        }

        async let programRead = FirestoreREST.document("programs/\(programId)")
        async let eventsRead = FirestoreREST.query(
            "programEvents",
            matching: [("programId", .string(programId)), ("published", .bool(true))]
        )
        let program = try await programRead
        let events = try await eventsRead

        let name = program["name"]?.stringValue ?? "The church’s galleries"
        let nodes = events.map { event in
            Node(
                id: event.id,
                parentId: event.fields["parentId"]?.stringValue,
                title: event.fields["title"]?.stringValue ?? "",
                order: event.fields["order"]?.numberValue ?? 0,
                startAt: event.fields["startAt"]?.timestampValue
            )
        }

        let rows = flatten(nodes)
        var targets = [Target(id: programId, title: name, depth: 0, trail: [name])]
        var trails: [String: [String]] = [:]
        for row in rows {
            let parentTrail = row.node.parentId.flatMap { trails[$0] } ?? [name]
            let trail = parentTrail + [row.node.title]
            trails[row.node.id] = trail
            targets.append(Target(id: row.node.id, title: row.node.title, depth: row.depth + 1, trail: trail))
        }

        /*
         * `defaultSubmissionNode(tree, priority, null) ?? programId`: the
         * parish's priority if it still resolves, else the first level, else
         * the ministry. A deleted priority costs a preselection, never a form.
         */
        let priority = program["prioritySubmissionNodeId"]?.stringValue
        let suggestedId = priority.flatMap { id in rows.contains { $0.node.id == id } ? id : nil }
            ?? rows.first?.node.id
            ?? programId
        let suggested = targets.first { $0.id == suggestedId } ?? targets[0]

        return Destination(programId: programId, programName: name, targets: targets, suggested: suggested)
    }

    private struct Node {
        let id: String
        let parentId: String?
        let title: String
        let order: Double
        let startAt: String?
    }

    /// `buildGalleryTree` then `flattenGalleryTree`: children under parents in
    /// sibling order, depth first, with the shared package's two guards — an
    /// orphan (its parent unpublished) is lifted to the top rather than
    /// dropped, and a cycle stops at `GALLERY_MAX_DEPTH`.
    private static func flatten(_ nodes: [Node]) -> [(node: Node, depth: Int)] {
        let ids = Set(nodes.map(\.id))
        var byParent: [String: [Node]] = [:]
        for node in nodes {
            let key = node.parentId.flatMap { ids.contains($0) ? $0 : nil } ?? ""
            byParent[key, default: []].append(node)
        }
        for key in byParent.keys { byParent[key]?.sort(by: precedes) }

        var rows: [(node: Node, depth: Int)] = []
        var seen = Set<String>()
        func walk(_ parent: String, _ depth: Int) {
            guard depth <= 16 else { return }
            for child in byParent[parent] ?? [] where !seen.contains(child.id) {
                seen.insert(child.id)
                rows.append((child, depth))
                walk(child.id, depth + 1)
            }
        }
        walk("", 0)
        return rows
    }

    /// `compareNodes`: the order an administrator set, then newest first, then
    /// undated last, then the title, then the id — byte order, not locale.
    private static func precedes(_ a: Node, _ b: Node) -> Bool {
        if a.order != b.order { return a.order < b.order }
        switch (a.startAt, b.startAt) {
        case let (x?, y?) where x != y: return x > y
        case (_?, nil): return true
        case (nil, _?): return false
        default: break
        }
        if a.title != b.title { return Array(a.title.utf16).lexicographicallyPrecedes(b.title.utf16) }
        return Array(a.id.utf16).lexicographicallyPrecedes(b.id.utf16)
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
        to target: Target,
        in programId: String,
        onProgress: @escaping @Sendable (Double) -> Void
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
            throw Failure.refused("That photo could not be got ready to send. Please take it again.")
        }

        onProgress(0.05)

        let attestation: String
        do {
            attestation = try await AppAttest.token()
        } catch let failure as AppAttest.Failure {
            switch failure {
            case .unsupported:
                throw Failure.unattested(
                    "This iPhone can’t send photos from the preview. The free SPSM Connect app can."
                )
            case .notConfigured:
                throw Failure.unattested(
                    "Sending photos from the preview isn’t switched on yet. The free SPSM Connect app can send them."
                )
            case .refused(let why):
                throw Failure.unattested("The church couldn’t check this iPhone just now. \(why)")
            }
        }

        onProgress(0.08)
        let token = try await idToken()

        var reserve = URLRequest(url: ClipConfig.api("/api/gallery/upload-url"))
        reserve.httpMethod = "POST"
        reserve.setValue("application/json", forHTTPHeaderField: "Content-Type")
        reserve.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        reserve.setValue(attestation, forHTTPHeaderField: "X-Firebase-AppCheck")
        reserve.httpBody = try JSONSerialization.data(withJSONObject: [
            "programId": programId,
            "programEventId": target.id,
            "contentType": "image/jpeg",
            "byteSize": data.count,
        ])

        let (body, response) = try await URLSession.shared.data(for: reserve)
        guard let http = response as? HTTPURLResponse else {
            throw Failure.refused("The church couldn’t be reached. Check you have signal or Wi-Fi, then try again.")
        }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                throw Failure.unattested(
                    "The church wouldn’t accept a photo from the preview. The free SPSM Connect app can send it."
                )
            }
            if http.statusCode == 429 {
                throw Failure.refused("A lot of photos have come from here today. Please try again tomorrow.")
            }
            throw Failure.refused("The church couldn’t take a photo just now. Please try again in a minute.")
        }

        let reservation = try JSONDecoder().decode(Reservation.self, from: body)
        onProgress(0.1)

        var put = URLRequest(url: URL(string: reservation.uploadUrl)!)
        put.httpMethod = "PUT"
        put.setValue(reservation.contentType, forHTTPHeaderField: "Content-Type")
        // Both pinned headers, exactly. See the file header.
        put.setValue("\(data.count),\(data.count)", forHTTPHeaderField: "x-goog-content-length-range")
        put.timeoutInterval = 120

        /*
         * The bytes are nearly all of the wait, so they get nearly all of the
         * bar: 0.1 to 1 follows what has actually left the phone. The steps
         * before it are quick and only nudge it, so the bar never sits still
         * through the one part that takes seconds.
         */
        let watcher = UploadProgress { sent in onProgress(0.1 + 0.9 * sent) }
        let (_, putResponse) = try await URLSession.shared.upload(for: put, from: data, delegate: watcher)
        guard let putHTTP = putResponse as? HTTPURLResponse,
              (200..<300).contains(putHTTP.statusCode)
        else {
            throw Failure.refused("That photo didn’t finish sending. Please try again.")
        }

        onProgress(1)
        return reservation.mediaId
    }

    /// The app's ladder: `upload/condense.ts`, rung for rung.
    ///
    /// Edge first, then quality — a smaller picture at decent quality reads
    /// better than a large one at poor quality — and it stops at the first rung
    /// under the budget, which for a 12 MP photograph is the first one. This
    /// was 2048px at 0.72 once, to keep a foreground upload short; it made the
    /// clip's photographs visibly softer than the app's for the same moment,
    /// and a church wifi upload of three or four megabytes is a few seconds.
    ///
    /// JPEG rather than the app's WebP because UIKit has no WebP encoder; at
    /// 0.92 the difference is size, not sharpness. The numbers are the shared
    /// package's `PHOTO_MAX_EDGE`, `PHOTO_QUALITY` and `PHOTO_BUDGET_BYTES`.
    private static func condense(_ image: UIImage) -> Data? {
        let budget = 12 * 1024 * 1024
        let ladder: [(edge: CGFloat, quality: CGFloat)] = [
            (3840, 0.92),
            (3840, 0.72),
            (3840, 0.62),
            (2048, 0.62),
        ]

        var last: Data?
        for rung in ladder {
            guard let data = resized(image, toEdge: rung.edge).jpegData(compressionQuality: rung.quality) else {
                continue
            }
            if data.count <= budget { return data }
            last = data
        }
        return last
    }

    /// Bounded on the long edge, in pixels.
    ///
    /// `format.scale = 1` is load-bearing: `UIGraphicsImageRenderer` otherwise
    /// draws at the screen's scale, so a 2048-point canvas on a 3× phone is
    /// 6144 pixels wide — the old version of this function shipped exactly
    /// that, and its "2048px" photographs were larger than the originals.
    private static func resized(_ image: UIImage, toEdge edge: CGFloat) -> UIImage {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let longest = max(pixels.width, pixels.height)
        // Drawn even when no smaller, because the draw is what applies the
        // orientation and drops the EXIF block. See `send`.
        let factor = min(1, edge / longest)
        let size = CGSize(width: (pixels.width * factor).rounded(), height: (pixels.height * factor).rounded())

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

/// How much of the PUT has left the phone, for the progress bar.
private final class UploadProgress: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let report: @Sendable (Double) -> Void

    init(report: @escaping @Sendable (Double) -> Void) {
        self.report = report
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard totalBytesExpectedToSend > 0 else { return }
        report(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
    }
}
