import SafariServices
import StoreKit
import SwiftUI

/// The two ways out of the clip: the church's website, and the full app.
///
/// Ported from `src/clip/handoff.ts`, which carries the reasoning. Both matter
/// more here than they did there, because this binary deliberately does not
/// contain the long-form reading — see the header of `plugins/withNativeClip.js`.

/// Opens a URL in `SFSafariViewController` over the clip.
///
/// Not `UIApplication.open`, which would leave the clip entirely and dismiss
/// the card — somebody reading the liturgy tour should be able to come back to
/// the button that offers them the app. Not a `WKWebView` either: Safari shows
/// the address, so a person typing a card number into Tithe.ly can see whose
/// page it is, which is the whole argument in `giving/open.ts`.
struct SafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let configuration = SFSafariViewController.Configuration()
        configuration.entersReaderIfAvailable = false

        let controller = SFSafariViewController(url: url, configuration: configuration)
        controller.preferredBarTintColor = UIColor(Ink.deep)
        controller.preferredControlTintColor = UIColor(Ink.inkInverse)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// A modifier so a screen can say `.safari(item: $url)` and be done.
extension View {
    func safari(url: Binding<IdentifiableURL?>) -> some View {
        sheet(item: url) { SafariSheet(url: $0.url) }
    }
}

/// `sheet(item:)` needs identity, and `URL` has none.
struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

/// Offers the full app, through Apple's own overlay.
///
/// `SKOverlay` rather than a link to the App Store, and this is the one place
/// the difference is load-bearing: the app has **no App Store id yet**, and the
/// overlay needs none. The system already knows which app this clip belongs to —
/// that is what `parent-application-identifiers` in the entitlements says — so
/// it can present the right card before the listing exists. A hardcoded
/// `id0000000000` link would have to be edited on release day, which is exactly
/// the kind of thing nobody remembers.
enum AppOffer {
    static func present() {
        guard
            let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive })
        else { return }

        let configuration = SKOverlay.AppClipConfiguration(position: .bottom)
        SKOverlay(configuration: configuration).present(in: scene)
    }
}
