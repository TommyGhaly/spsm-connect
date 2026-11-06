import SwiftUI

/// `/c/welcome` — the liturgy, for somebody who has not been before.
///
/// This is the tag by the door, and the person reading it is very likely
/// standing in the narthex right now with their coat on. A short welcome card,
/// then the whole six-station tour — the same words as the app's
/// Welcome screen, generated from `src/about/tour.ts` rather than copied, with
/// the church's website edits laid over them. See `AboutPage.swift`. Each
/// station is folded shut under its heading. The whole guide is one tap away
/// in Safari.
struct WelcomeView: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .welcome) {
            ClipCard(spacing: 12) {
                ClipEyebrow(text: "You are welcome here")
                ClipBody(
                    text: """
                    This is a Coptic Orthodox church, and the service you have walked into is \
                    the Divine Liturgy. Nothing here is expected of a visitor.
                    """,
                    tone: Ink.ink
                )
            }

            AboutPage(slug: "welcome-newcomers")
        }
        .safari(url: $sheet)
    }
}
