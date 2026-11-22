import Foundation

/// The App Clip's half of the NFC tag statistics: the `clip` path.
///
/// The Swift port of `src/nfc/visit.ts`, and simpler, because a clip *is* one
/// visit. iOS launches it for one tap and it has no state that survives being
/// closed, so the visit minted at invocation lasts exactly as long as the
/// process, and there is no window to time out. The model — paths, visits, the
/// funnel, why money is counted by the server and not reported from here —
/// is `packages/shared/src/analytics/nfc.ts` in the Website repo, and the
/// strings below must match its lists or `/api/nfc/event` refuses the post.
///
/// Fire-and-forget. A statistic that failed to send is never something the
/// person tapping a tag should notice, so nothing here throws or waits.
///
/// Nothing that identifies anybody: sixteen random hex characters made up for
/// this tap, the experience, and the fact that it was a clip on an iPhone.
enum NfcStats {
    /// One step after the tap. The rest — the form being stored, the card
    /// being taken — the server records itself.
    enum Action: String {
        case giveTap, cartAdd, checkoutStart, formOpen, photoSent, getApp
    }

    @MainActor private static var attribution: [String: String]?

    /// The invocation arrived. Mints the visit and reports the scan, once.
    ///
    /// iOS can deliver the same user activity again when the clip comes back
    /// to the foreground, so a second call for a visit already in force is a
    /// no-op rather than a second tap.
    @MainActor static func start(_ destination: ClipDestination) {
        guard attribution == nil else { return }
        var bytes = [UInt8](repeating: 0, count: 8)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return }
        let visit = bytes.map { String(format: "%02x", $0) }.joined()
        attribution = ["visit": visit, "slug": destination.rawValue, "path": "clip", "platform": "ios"]
        post("scan")
    }

    /// Report one step of this visit. Does nothing before the invocation.
    @MainActor static func report(_ action: Action) {
        post(action.rawValue)
    }

    /// `["nfc": {...}]` for the checkout and form bodies, or empty.
    ///
    /// The server credits the order or the paid form to the tag from this,
    /// when the money actually moves. Empty before an invocation, which the
    /// server reads as "not from a tag".
    @MainActor static var body: [String: Any] {
        guard let attribution else { return [:] }
        return ["nfc": attribution]
    }

    @MainActor private static func post(_ action: String) {
        guard var payload = attribution else { return }
        payload["action"] = action
        var request = URLRequest(url: ClipConfig.api("/api/nfc/event"))
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        Task.detached { _ = try? await URLSession.shared.data(for: request) }
    }
}
