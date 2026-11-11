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

    /// The full app's Firebase app id, `GOOGLE_APP_ID` in the app target's
    /// `GoogleService-Info.plist`, tried second.
    ///
    /// A TestFlight build of the clip, signed as `org.spsm.connect.Clip` and
    /// attesting in production, was refused under `clipAppId` with Firebase's
    /// one uninformative sentence. Every byte of the request matches Firebase's
    /// own SDK, so what is left is the identity Apple attests a clip under —
    /// and if that is the parent's, only the parent's registration accepts
    /// it. So the clip asks the clip's first and the parent's second, with a
    /// fresh challenge and key for each, and reports both if both refuse. The
    /// Function verifies a token from any app in the project, so either one
    /// is as good as the other there.
    static let parentAppId = "1:778458603931:ios:6812ba9d30447bb579813e"

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

        var refusals: [String] = []
        for (label, appId) in [("clip", clipAppId), ("app", parentAppId)] {
            do {
                let (token, ttl) = try await attempt(appId: appId)
                await cache.store(token, for: ttl)
                return token
            } catch Failure.refused(let why) where why.hasPrefix(refusedPrefix) {
                // Firebase looked and said no; the other registration may not.
                refusals.append("\(label): \(why.dropFirst(refusedPrefix.count))")
            }
        }
        throw Failure.refused("Firebase refused the attestation. " + refusals.joined(separator: " "))
    }

    /// The opening of the one refusal worth trying the other app id for.
    private static let refusedPrefix = "Firebase refused the attestation. "

    /// One full round against one Firebase app: key, challenge, attestation,
    /// exchange.
    private static func attempt(appId: String) async throws -> (token: String, ttl: TimeInterval) {
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
        let challenge = try await requestChallenge(appId: appId)
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

        return try await exchange(appId: appId, keyId: keyId, attestation: attestation, challenge: challenge)
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

    private static func base(_ appId: String) -> String {
        "https://firebaseappcheck.googleapis.com/v1/projects/\(ClipConfig.firebaseProjectId)/apps/\(appId)"
    }

    private static func requestChallenge(appId: String) async throws -> String {
        var request = URLRequest(
            url: URL(string: "\(base(appId)):generateAppAttestChallenge?key=\(ClipConfig.firebaseApiKey)")!
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
        appId: String,
        keyId: String,
        attestation: Data,
        challenge: String
    ) async throws -> (token: String, ttl: TimeInterval) {
        var request = URLRequest(
            url: URL(string: "\(base(appId)):exchangeAppAttestAttestation?key=\(ClipConfig.firebaseApiKey)")!
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
             * Firebase's refusal is one sentence, "App attestation failed.",
             * whatever the reason. So the clip reads its own attestation and
             * says which of the two usual causes it is — the environment
             * Apple attested in, and whose identity — in a short code the
             * office can read off the screen. Neither is secret: both are in
             * the signed binary for anybody who looks.
             */
            let said = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["error"] as? [String: Any] }?["message"] as? String
            throw Failure.refused(
                "\(refusedPrefix)[\(diagnosis(of: attestation)), \((response as? HTTPURLResponse)?.statusCode ?? 0)\(said.map { " \($0)" } ?? "")]"
            )
        }

        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let issued = decoded.appCheckToken else {
            throw Failure.refused("Firebase returned no App Check token.")
        }
        let seconds = issued.ttl.flatMap { TimeInterval($0.replacingOccurrences(of: "s", with: "")) } ?? 3600
        return (issued.token, seconds)
    }

    /// The team that signs both binaries. `DEVELOPMENT_TEAM` in the project.
    private static let teamId = "5ZRM8X66TN"

    /// "production / clip", "development / app", … — what Apple attested.
    ///
    /// The attestation is CBOR; `authData` inside it begins with the SHA-256 of
    /// the App ID Apple attested for (32 bytes), a flags byte, a four-byte
    /// counter, then the 16-byte AAGUID, which is `appattest` padded with
    /// zeros in production and `appattestdevelop` in development. No CBOR
    /// library for two fields: the key is found by its bytes, and anything
    /// that does not parse says so rather than guessing.
    static func diagnosis(of attestation: Data) -> String {
        let bytes = [UInt8](attestation)
        let key: [UInt8] = [0x68] + Array("authData".utf8)
        guard let at = bytes.indices.first(where: { i in
            i + key.count <= bytes.count && Array(bytes[i..<(i + key.count)]) == key
        }) else { return "unreadable" }

        var cursor = at + key.count
        guard cursor < bytes.count else { return "unreadable" }
        let header = bytes[cursor]
        cursor += 1
        switch header {
        case 0x58: cursor += 1
        case 0x59: cursor += 2
        case 0x40...0x57: break
        default: return "unreadable"
        }
        guard cursor + 53 <= bytes.count else { return "unreadable" }

        let rpIdHash = Data(bytes[cursor..<(cursor + 32)])
        let aaguid = Data(bytes[(cursor + 37)..<(cursor + 53)])

        let environment: String
        if aaguid == Data("appattestdevelop".utf8) {
            environment = "development"
        } else if aaguid == Data("appattest".utf8) + Data(repeating: 0, count: 7) {
            environment = "production"
        } else {
            environment = "unknown-env"
        }

        func hash(_ id: String) -> Data { Data(SHA256.hash(data: Data(id.utf8))) }
        let bundle = Bundle.main.bundleIdentifier ?? ""
        let identity: String
        switch rpIdHash {
        case hash("\(teamId).org.spsm.connect.Clip"): identity = "clip"
        case hash("\(teamId).org.spsm.connect"): identity = "app"
        case hash("\(teamId).\(bundle)"): identity = bundle
        default: identity = "other-id"
        }
        return "\(environment) / \(identity)"
    }
}
