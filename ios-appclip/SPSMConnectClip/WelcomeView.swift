import SwiftUI

/// `/c/welcome` — the liturgy, for somebody who has not been before.
///
/// This is the tag by the door, and the person reading it is very likely
/// standing in the narthex right now with their coat on. So the native card
/// answers the questions that cannot wait — may I come in, what is happening,
/// what am I expected to do — and the whole guide is one tap away in Safari.
///
/// Under those, the whole six-station tour — the same words as the app's
/// Welcome screen, generated from `src/about/tour.ts` rather than copied, with
/// the church's website edits laid over them. See `AboutPage.swift`. Each
/// station is folded shut under its heading, so the short answers stay the
/// first thing on the screen.
struct WelcomeView: View {
    @State private var sheet: IdentifiableURL?

    private struct Answer {
        let question: String
        let answer: String
    }

    private let answers: [Answer] = [
        Answer(
            question: "May I just come in?",
            answer: "Yes. There is nothing to sign, nothing to pay, and nobody will ask who you are. Come in and sit anywhere."
        ),
        Answer(
            question: "How long is it?",
            answer: "The Liturgy runs about two hours, and people arrive throughout. Leaving early is normal and nobody minds."
        ),
        Answer(
            question: "What do I do?",
            answer: "Nothing is required of you. Stand when the congregation stands if you like, or stay seated. You are not expected to join in the responses."
        ),
        Answer(
            question: "Communion",
            answer: "Communion is for those who have prepared and are members of the Coptic Orthodox Church. At the end, blessed bread is offered to everybody — please do take some."
        ),
        Answer(
            question: "What should I wear?",
            answer: "Modest and comfortable. Many women cover their heads; you are welcome either way."
        ),
    ]

    var body: some View {
        ClipScreen(destination: .welcome) {
            ClipCard(spacing: 12) {
                ClipEyebrow(text: "You are welcome here")
                ClipBody(
                    text: """
                    This is a Coptic Orthodox church, and the service you have walked into is \
                    the Divine Liturgy. Everything below is the short answer. Nothing here is \
                    expected of a visitor.
                    """,
                    tone: Ink.ink
                )
            }

            ForEach(answers, id: \.question) { item in
                ClipCard(spacing: 6) {
                    ClipHeading(text: item.question)
                    ClipBody(text: item.answer)
                }
            }

            AboutPage(slug: "welcome-newcomers")

            ClipFooter(
                destination: .welcome,
                readMore: "The church’s website has the same tour with its pictures, the hymn to listen to, and your name in Coptic letters."
            )
        }
        .safari(url: $sheet)
    }
}
