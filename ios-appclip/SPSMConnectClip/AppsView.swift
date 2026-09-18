import SwiftUI

/// `/c/apps` — the church's apps, and where to get them.
///
/// The circularity is real and is argued in `src/clip/experiences.ts`: an App
/// Clip *is* an App Store card, so a clip advertising apps sounds redundant. It
/// stays because the printed card this opens from lists several things, only one
/// of which is this app — and a Smart App Banner cannot introduce Taksis.
///
/// ## Short, here, more than anywhere else in the clip
///
/// This screen is read standing up, seconds after a tag was tapped, and the
/// question it answers is "which of these do I want". A sentence each is the
/// whole budget; the app's `/apps` screen and the website's page carry the
/// longer wording for somebody sitting down. The one thing that must be plain
/// is that **Taksis is the servants' app** — it was described here as the
/// parking and traffic app, which is one of the things it does and not what it
/// is for.
struct AppsView: View {
    @State private var sheet: IdentifiableURL?

    private struct ChurchApp {
        let name: String
        let blurb: String
        /// The app's own icon, on the church's site — the same file the app's
        /// `src/apps/stores.ts` draws, fetched rather than bundled because a
        /// clip has 15 MB and a store icon is not where to spend any of it.
        ///
        /// These are **third-party trademarks** where the app is somebody
        /// else's, shown to identify their app and nothing else: not cropped,
        /// not recoloured, not redrawn. The rounded corner is a clip shape on
        /// the view, which is how every store draws these and leaves the file
        /// alone.
        let icon: URL
        let appStore: URL
    }

    /// From `src/apps/stores.ts`. Two entries, because those are the two the
    /// church actually ships to a store.
    private let apps: [ChurchApp] = [
        ChurchApp(
            name: "Taksis",
            blurb: "The servants’ app, and the church’s own: schedules, attendance, children’s accounts, vehicles.",
            icon: ClipConfig.page("/img/app-taksis-192.webp"),
            appStore: URL(string: "https://apps.apple.com/us/app/taksis/id6743824691")!
        ),
        ChurchApp(
            name: "Tithe.ly",
            blurb: "The giving app the church uses. You can give without it, from the church’s own page.",
            icon: ClipConfig.page("/img/app-tithely-192.webp"),
            appStore: URL(string: "https://apps.apple.com/us/app/tithely-giving/id694740700")!
        ),
    ]

    var body: some View {
        ClipScreen(destination: .apps) {
            ClipBody(
                text: "The church keeps three apps. This is one of them.",
                tone: Ink.ink
            )

            ForEach(apps, id: \.name) { app in
                ClipCard {
                    HStack(spacing: 12) {
                        AppIconImage(url: app.icon)
                        ClipHeading(text: app.name)
                    }
                    ClipBody(text: app.blurb)
                    ClipButton(label: "View on the App Store", tone: .quiet) {
                        sheet = IdentifiableURL(url: app.appStore)
                    }
                }
            }

            /*
             * The third icon is fetched like the other two rather than read out
             * of this bundle's own `AppIcon`: pulling an app icon from an asset
             * catalogue at runtime is not something iOS promises, and the file
             * on the site is the same artwork — `scripts/make-icons.mjs` here
             * generates `assets/icon.png`, and the website's
             * `assets/apps/spsm-connect-icon.png` is a copy of it.
             */
            ClipCard {
                HStack(spacing: 12) {
                    AppIconImage(url: ClipConfig.page("/img/app-spsm-connect-192.webp"))
                    VStack(alignment: .leading, spacing: 4) {
                        ClipEyebrow(text: "You are using it now")
                        ClipHeading(text: "SPSM Connect")
                    }
                }
                ClipBody(
                    text: """
                    The church’s app for everyone: the calendar, the galleries, forms, \
                    the bookstore and the offering. This is a sample of it, and iPhone \
                    removes the sample on its own.
                    """
                )
                ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                Text("Free, and from the church’s own developer account.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
            }
        }
        .safari(url: $sheet)
    }
}

/// One app's icon: 64pt square, as on the app's `/apps` screen, over the sunken
/// paper that holds the row open while the file arrives so the name does not
/// jump left as the icon lands.
///
/// Decorative, hence hidden rather than described — the app's name is on the
/// line beside it, and a screen reader announcing both says "Taksis Taksis".
private struct AppIconImage: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                // No spinner and no broken-image glyph: a 64pt square of paper
                // is the honest state both while it loads and if it never
                // does, and the card reads without it either way.
                Color.clear
            }
        }
        .frame(width: 64, height: 64)
        .background(Ink.paperSunken)
        // 8, which is `radius.md` in the theme and what the app's card uses for
        // the same square.
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityHidden(true)
    }
}
