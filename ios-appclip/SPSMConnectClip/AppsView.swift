import SwiftUI

/// `/c/apps` — the parish's apps, and where to get them.
///
/// The circularity is real and is argued in `src/clip/experiences.ts`: an App
/// Clip *is* an App Store card, so a clip advertising apps sounds redundant. It
/// stays because the printed card this opens from lists several things, only one
/// of which is this app — and a Smart App Banner cannot introduce Taksis.
///
/// SPSM Connect is listed here with **no icon**, matching the website's rule for
/// the same card: it has no store listing to take one from, and an invented mark
/// for an unreleased app is the one thing on this page that could mislead.
struct AppsView: View {
    @State private var sheet: IdentifiableURL?

    private struct ParishApp {
        let name: String
        let blurb: String
        let appStore: URL
    }

    /// From `src/apps/stores.ts`. Two entries, because those are the two the
    /// church actually ships to a store.
    private let apps: [ParishApp] = [
        ParishApp(
            name: "Taksis",
            blurb: "The parking and traffic app — register a vehicle so the parking team can reach you if your car needs moving.",
            appStore: URL(string: "https://apps.apple.com/us/app/taksis/id6743824691")!
        ),
        ParishApp(
            name: "Tithe.ly",
            blurb: "The giving platform the church uses. You can give without it, from the church's own page.",
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
                    ClipHeading(text: app.name)
                    ClipBody(text: app.blurb)
                    ClipButton(label: "View on the App Store", tone: .quiet) {
                        sheet = IdentifiableURL(url: app.appStore)
                    }
                }
            }

            ClipCard {
                ClipEyebrow(text: "You are using it now")
                ClipHeading(text: "SPSM Connect")
                ClipBody(
                    text: """
                    The church's own app, for everyone rather than for servants: the calendar, \
                    the galleries, parish forms, the bookstore and the offering. What you are \
                    holding is a sample of it — iPhone removes it again on its own after a \
                    while, and nothing you have done here is kept.
                    """
                )
                ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                Text("Free, and from the church's own developer account.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
            }
        }
        .safari(url: $sheet)
    }
}
