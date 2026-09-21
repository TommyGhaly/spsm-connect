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

                    /* A hairline, because the badge is artwork and not this
                       card's type: without it the black pill sits directly
                       under the sentence and reads as part of the paragraph
                       rather than as the thing to tap. The app's cards take the
                       same rule for the same reason — a `ClipButton` never
                       needed one, because its own border said what it was. */
                    Rectangle().fill(Ink.rule).frame(height: 1)

                    /*
                     * Apple's own badge, as on the website and on the app's
                     * `/apps` — `StoreBadge.swift` carries the rules about it,
                     * and why this screen shows one store where the other two
                     * show two.
                     *
                     * Still the Safari sheet and not `UIApplication.open`: the
                     * reason `Handoff.swift` gives holds for a store page as
                     * much as for a liturgy tour. Leaving the clip dismisses
                     * the card, and somebody who has just looked at Taksis
                     * should come back to the card that offers them this one.
                     */
                    AppStoreBadge(appName: app.name) {
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
                /*
                 * A button and not the badge above, and the difference is not
                 * an oversight to be tidied up. Apple's badge links to an App
                 * Store product page; this presents `SKOverlay`, which is the
                 * mechanism Apple provides for a clip offering its own full
                 * app, and which needs no App Store id — see `Handoff.swift`
                 * for why that matters while the app is unreleased. Putting
                 * Apple's artwork on a control that does not go to the store
                 * would be using the badge for something it is not for.
                 */
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
        /*
         * 16, which is `radius.lg`, and it was 8. A 64pt icon on a home screen
         * is rounded at about fourteen points; at eight this square read as a
         * thumbnail *of* an app icon rather than as the icon — on the one
         * screen whose job is helping somebody recognise the thing they are
         * about to look for in a store. The app's own cards made the same move.
         *
         * The hairline comes with it, and earns its place twice here: Tithe.ly's
         * icon is pale at the edges and would dissolve into the card, and this
         * square is empty paper until a fetched file arrives, which without an
         * edge is a gap rather than a space being held.
         */
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Ink.rule, lineWidth: 1))
        .accessibilityHidden(true)
    }
}
