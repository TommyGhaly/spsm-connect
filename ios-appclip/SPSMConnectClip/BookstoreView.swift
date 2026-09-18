import SwiftUI

/// `/c/bookstore` — the one experience that says "not here".
///
/// "The clip cannot sell books" sounds like a rule and is not one. Physical
/// goods may not be sold through in-app purchase — Apple's own guideline — so
/// the only ways to take money for a book are Apple Pay or a card sheet, and
/// both mean a payments SDK. That framework does not fit a 15 MB budget, and
/// every tag this parish owns is a physical invocation, which is the tier that
/// budget belongs to.
///
/// A shop that shows a book and cannot sell it would be a worse card than an
/// honest one: somebody would browse, choose, press Buy, and be told at the last
/// step to go and install something. So this says the two true things and offers
/// the two routes that actually work — the app, which takes Apple Pay, and the
/// church's website, which takes a card in a browser and needs nothing
/// installed.
struct BookstoreView: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .bookstore) {
            ClipCard {
                ClipEyebrow(text: "The parish bookstore")
                ClipHeading(text: "Icons, books and gifts from the church.")
                ClipBody(
                    text: """
                    Buying happens in one of two places: SPSM Connect, which takes Apple Pay, \
                    or the church's own website, which takes a card in a browser. Either way \
                    the order is collected at, or posted from, the church.
                    """
                )

                ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                ClipButton(label: "Shop on the website", tone: .quiet) {
                    sheet = IdentifiableURL(url: ClipConfig.page("/bookstore"))
                }

                Text("Nothing is charged here, and nothing typed here is a payment.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .safari(url: $sheet)
    }
}
