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
    /// Empty until somebody registers `org.spsm.connect.Clip` as a second iOS
    /// app in the Firebase console. Deliberately not the parent's id — using
    /// that is the exact mismatch that made this unanswerable before.
    static let clipAppId = ""

    enum Failure: Error {
        /// `DCAppAttestService.isSupported` is false in this process. Fatal to
        /// the feature: no configuration changes it.
        case unsupported
        /// No Firebase app registered for the clip's bundle id yet.
        case notConfigured
        /// Apple refused to attest, or Firebase refused the attestation.
        case refused(String)
    }

    private static let keyDefaultsName = "spsm.clip.appattest.keyId"

    /// An App Check token, or a reason there is none.
    static func token() async throws -> String {
        guard DCAppAttestService.shared.isSupported else { throw Failure.unsupported }
        guard !clipAppId.isEmpty else { throw Failure.notConfigured }

        let service = DCAppAttestService.shared
        let keyId = try await keyIdentifier(service)

        /*
         * Firebase issues the challenge. Attesting against a nonce this app
         * chose would prove nothing — the point of the challenge is that the
         * server picked it, so a captured attestation cannot be replayed.
         */
        let challenge = try await requestChallenge()
        let hash = Data(SHA256.hash(data: Data(challenge.utf8)))
        let attestation = try await service.attestKey(keyId, clientDataHash: hash)

        return try await exchange(keyId: keyId, attestation: attestation, challenge: challenge)
    }

    /// The key, generated once and remembered.
    ///
    /// `UserDefaults` rather than the keychain, and only because a clip's
    /// storage is cleared by iOS on its own schedule anyway — there is nothing
    /// here worth protecting beyond the process, and a keychain item that
    /// outlives the clip would be litter on the device.
    private static func keyIdentifier(_ service: DCAppAttestService) async throws -> String {
        if let existing = UserDefaults.standard.string(forKey: keyDefaultsName) {
            return existing
        }
        let generated = try await service.generateKey()
        UserDefaults.standard.set(generated, forKey: keyDefaultsName)
        return generated
    }

    private struct ChallengeResponse: Decodable { let challenge: String }
    private struct TokenResponse: Decodable {
        let attestationToken: AppCheckToken?
        let appCheckToken: AppCheckToken?
        struct AppCheckToken: Decodable { let token: String }
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

    private static func exchange(keyId: String, attestation: Data, challenge: String) async throws -> String {
        var request = URLRequest(
            url: URL(string: "\(base):exchangeAppAttestAttestation?key=\(ClipConfig.firebaseApiKey)")!
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "artifact": "",
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
        guard let token = (decoded.appCheckToken ?? decoded.attestationToken)?.token else {
            throw Failure.refused("Firebase returned no App Check token.")
        }
        return token
    }
}
