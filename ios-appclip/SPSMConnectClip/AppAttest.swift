import CryptoKit
import DeviceCheck
import Foundation

/// App Attest, called directly, and the question this finally answers.
///
/// ---------------------------------------------------------------------------
/// ## The question
///
/// `galleryUploadUrl` reads `X-Firebase-AppCheck` by hand and answers
/// `401 {"error":"unattested"}` without it. So whether the clip can send a
/// photograph comes down to whether it can produce that header.
///
/// The React Native clip could not answer this, and the reason was never App
/// Attest itself — it was Firebase's SDK. Apple builds the relying-party
/// identifier from the team id and **the bundle it is running in**, so a clip
/// attests as `org.spsm.connect.Clip`; the SDK meanwhile authenticated as the
/// parent app, because `withClipTarget` copied the parent's
/// `GoogleService-Info.plist` onto the clip. Those two cannot both be satisfied,
/// and `README.md` carries the full account.
///
/// Going native removes the middleman. `DCAppAttestService` is called here
/// directly, and the attestation is exchanged with Firebase App Check's own REST
/// endpoint for the **clip's** app id — so the bundle that attests and the app
/// that is registered are the same thing by construction.
///
/// ## What still has to be true, and is not this file's to decide
///
/// **The clip's bundle id needs its own Firebase iOS app**, registered in the
/// console with App Attest enabled, and `clipAppId` below must be its app id.
/// Until that exists this returns `.notConfigured` and the photographs screen
/// says so plainly rather than failing at the upload.
///
/// **`isSupported` may be false inside a clip.** Apple documents that it is
/// false in some contexts and does not say whether an App Clip is one of them.
/// If it is, nothing rescues the feature and the screen falls back to the app.
/// That is one boolean, on one device, and this reports it distinctly from
/// every other failure so the answer is unambiguous the first time somebody
/// runs it.
/// ---------------------------------------------------------------------------
enum AppAttest {
    /// The Firebase app id for the **clip's** bundle identifier.
    ///
    /// "SPSM Connect Clip" in `spsm-database`, registered 2026-11-11 for
    /// `org.spsm.connect.Clip` on team 5ZRM8X66TN, with App Attest as its App
    /// Check provider. Deliberately not the parent's id — using that is the
    /// exact mismatch that made this unanswerable before.
    static let clipAppId = "1:778458603931:ios:598803aa980e55ff79813e"

    enum Failure: Error {
        /// `DCAppAttestService.isSupported` is false in this process. Fatal to
        /// the feature: no configuration changes it.
        case unsupported
        /// No Firebase app registered for the clip's bundle id yet.
        case notConfigured
        /// Apple refused to attest, or Firebase refused the attestation.
        case refused(String)
    }

    /// An App Check token, or a reason there is none.
    ///
    /// Reused for as long as Firebase says it is good, so a second photograph
    /// in the same visit costs no attestation at all.
    static func token() async throws -> String {
        guard DCAppAttestService.shared.isSupported else { throw Failure.unsupported }
        guard !clipAppId.isEmpty else { throw Failure.notConfigured }

        if let cached = await cache.current() { return cached }

        let service = DCAppAttestService.shared

        /*
         * A fresh key every time, never one remembered from an earlier visit.
         * Apple attests a key once: a second `attestKey` on the same id is
         * refused, so the old remembered key made every visit after the first
         * fail here. Generating one is local and cheap; the clip has no
         * assertion flow that would make keeping one worth anything.
         */
        let keyId: String
        do {
            keyId = try await service.generateKey()
        } catch {
            throw Failure.refused("This iPhone could not make a key. (\(error.localizedDescription))")
        }

        /*
         * Firebase issues the challenge. Attesting against a nonce this app
         * chose would prove nothing — the point of the challenge is that the
         * server picked it, so a captured attestation cannot be replayed.
         *
         * The challenge arrives base64-encoded, and the hash is of its *bytes*,
         * as Firebase's own SDK does. Hashing the base64 text instead gives a
         * hash Firebase never computes, and it refuses the attestation.
         */
        let challenge = try await requestChallenge()
        guard let challengeBytes = Data(base64Encoded: challenge) else {
            throw Failure.refused("Firebase sent a challenge that could not be read.")
        }
        let hash = Data(SHA256.hash(data: challengeBytes))

        let attestation: Data
        do {
            attestation = try await service.attestKey(keyId, clientDataHash: hash)
        } catch {
            throw Failure.refused("Apple would not vouch for this iPhone. (\(error.localizedDescription))")
        }

        let (token, ttl) = try await exchange(keyId: keyId, attestation: attestation, challenge: challenge)
        await cache.store(token, for: ttl)
        return token
    }

    private static let cache = TokenCache()

    /// Drop the kept token, after the Function refused it.
    static func forget() async { await cache.clear() }

    /// The last token and when to stop trusting it — five minutes before
    /// Firebase does, so a token never expires between the reservation and
    /// the Function's check of it.
    private actor TokenCache {
        private var token: String?
        private var until = Date.distantPast

        func current() -> String? { Date() < until ? token : nil }

        func store(_ token: String, for ttl: TimeInterval) {
            self.token = token
            until = Date().addingTimeInterval(max(0, ttl - 300))
        }

        func clear() { token = nil }
    }

    private struct ChallengeResponse: Decodable { let challenge: String }
    private struct TokenResponse: Decodable {
        let appCheckToken: AppCheckToken?
        /// `ttl` is a protobuf duration, "3600s".
        struct AppCheckToken: Decodable { let token: String; let ttl: String? }
    }

    private static var base: String {
        "https://firebaseappcheck.googleapis.com/v1/projects/\(ClipConfig.firebaseProjectId)/apps/\(clipAppId)"
    }

    private static func requestChallenge() async throws -> String {
        var request = URLRequest(
            url: URL(string: "\(base):generateAppAttestChallenge?key=\(ClipConfig.firebaseApiKey)")!
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw Failure.refused("Firebase would not issue a challenge.")
        }
        return try JSONDecoder().decode(ChallengeResponse.self, from: data).challenge
    }

    private static func exchange(
        keyId: String,
        attestation: Data,
        challenge: String
    ) async throws -> (token: String, ttl: TimeInterval) {
        var request = URLRequest(
            url: URL(string: "\(base):exchangeAppAttestAttestation?key=\(ClipConfig.firebaseApiKey)")!
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        /*
         * Exactly the three fields the request message has. `artifact` was here
         * once; it belongs to the *response*, and Google's API front end
         * refuses a body with a field it does not know ("Unknown name"), so
         * its presence alone failed every exchange.
         *
         * `challenge` goes back as Firebase sent it, base64; `keyId` is already
         * base64 from `generateKey`.
         */
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "challenge": challenge,
            "keyId": keyId,
            "attestationStatement": attestation.base64EncodedString(),
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            /*
             * The bundle-id mismatch lands here if the Firebase app registered
             * for `clipAppId` is not the clip's own bundle. Worth quoting the
             * body: it is the only place that says which of the two disagreed.
             */
            let body = String(data: data, encoding: .utf8) ?? ""
            throw Failure.refused("Firebase refused the attestation. \(body.prefix(200))")
        }

        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let issued = decoded.appCheckToken else {
            throw Failure.refused("Firebase returned no App Check token.")
        }
        let seconds = issued.ttl.flatMap { TimeInterval($0.replacingOccurrences(of: "s", with: "")) } ?? 3600
        return (issued.token, seconds)
    }
}
