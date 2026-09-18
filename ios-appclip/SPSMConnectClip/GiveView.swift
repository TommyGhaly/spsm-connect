import SwiftUI

/// `/c/give` — the offering.
///
/// Two things worth stating plainly, because a payment inside an App Clip
/// sounds like it should be a problem and this one is not:
///
///   - **Nothing is charged by this binary.** The gift is made on Tithe.ly's own
///     hosted form, in Safari with the address visible. No card field belongs to
///     this app and there is nowhere in it to keep one.
///   - **A donation to a nonprofit is the case Apple names** for collecting
///     money outside in-app purchase, so this needs no payment SDK — which is
///     just as well, because the framework that would provide one is 15 MB of
///     budget this clip does not have.
struct GiveView: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .give) {
            ClipCard(spacing: 12) {
                // The website's own homepage verse, from `giving/verses.ts`.
                Text("“God loves a cheerful giver.”")
                    .font(Face.display(20))
                    .italic()
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("2 CORINTHIANS 9:7")
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.gold)
            }

            ClipCard {
                ClipEyebrow(text: "Give to the church")
                ClipBody(
                    text: """
                    The offering is taken on Tithe.ly, the church's own giving page. \
                    It opens here in Safari so you can see whose page you are on, and \
                    Apple Pay works there.
                    """
                )
                ClipButton(label: "Give now") {
                    sheet = IdentifiableURL(url: ClipConfig.givingURL)
                }
                Text("Nothing is charged by this sample, and nothing you type here is a payment.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ClipFooter(
                destination: .give,
                readMore: "The church's giving page explains what your offering supports, and how to give by standing order."
            )
        }
        .safari(url: $sheet)
    }
}
