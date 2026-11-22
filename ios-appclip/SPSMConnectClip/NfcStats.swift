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

    /// The invocation arrived. Mints the visit and reports the scan.
    ///
    /// iOS can deliver the same user activity again when the clip comes back
    /// to the foreground, so a second call for the tag already in force is a
    /// no-op rather than a second tap. A *different* tag is a new tap — the
    /// clip was still alive when somebody tapped the next sticker along — and
    /// gets its own visit, so what they do now is credited to the tag they
    /// just tapped and not to the first one.
    ///
    /// The cost is that tapping the same tag twice while the clip is still
    /// open counts once. From iOS's side the two are indistinguishable from a
    /// redelivery, and undercounting a repeat is the safer of the two errors.
    @MainActor static func start(_ destination: ClipDestination) {
        guard attribution?["slug"] != destination.rawValue else { return }
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
        Task.detached {
            if await arrived(request) { return }
            // Once more, for a phone that was between signals. The server keeps
            // the first (visit, action) and drops repeats, so a first attempt
            // that landed but whose answer was lost cannot count twice.
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            _ = await arrived(request)
        }
    }

    /// True unless the network failed or the server did. A 4xx is a refusal —
    /// malformed or rate-limited — and sending it again would be refused again.
    private static func arrived(_ request: URLRequest) async -> Bool {
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return ((response as? HTTPURLResponse)?.statusCode ?? 500) < 500
    }
}
