import PassKit
import SwiftUI

/// `/c/bookstore` — the shelf, and Apple Pay under it.
///
/// ---------------------------------------------------------------------------
/// This was the one experience of the eight that handed off, and the reason it
/// gave was that Square's SDK is a large framework in a 15 MB budget. That was
/// measured and it is not: `SquareInAppPaymentsSDK` is about 1.4 MB embedded on
/// arm64, and the six-megabyte figure belonged to `SquareBuyerVerificationSDK`,
/// a separate pod that only the React Native wrapper ever depended on and that
/// nothing in this parish's flow needs. `src/clip/experiences.ts` carries the
/// numbers.
///
/// The harder problem was never the framework. It was that the checkout wants
/// an email address, a first and last name, a fulfilment choice and an address,
/// all validated server-side, and a clip that asks a person to type five fields
/// at a bookstall has wasted their time more thoroughly than an honest refusal
/// would. Apple Pay answers that: the wallet supplies every one of them, and
/// this screen asks for nothing. See `Checkout.swift`.
///
/// **Still honest when it cannot sell.** A build with no Square ids, a device
/// with no wallet, a card Square does not take — each of those keeps the shelf
/// and loses the steppers, with the card this screen used to be sitting above
/// it. The old objection was that a shop which cannot sell is a worse card than
/// an honest one, and it is exactly right about the *order*: being led through
/// a basket and refused at the till is the bad outcome, not seeing what the
/// church sells. Saying so first and then showing the shelf is neither.
///
/// It is also the only way this screen can be looked at. Apple Pay is
/// unavailable on every Simulator — `canMakePayments()` is false there, and
/// Square documents a physical device as a requirement — so gating the whole
/// view on it would mean nobody could see the shelf without a device, a wallet
/// and a merchant certificate.
/// ---------------------------------------------------------------------------
struct BookstoreView: View {
    @StateObject private var model: ShopModel
    @StateObject private var checkout: Checkout
    @State private var sheet: IdentifiableURL?

    /// Answered once, on appear, rather than read from `body`.
    ///
    /// `Checkout.available` asks Square whether the wallet holds a card it can
    /// charge, and SwiftUI evaluates `body` whenever anything observable moves
    /// — every press of a stepper, on a screen with one per title. The answer
    /// cannot change while a clip is open: a wallet is not configured from
    /// inside a payment sheet.
    @State private var selling = false

    init() {
        let model = ShopModel()
        _model = StateObject(wrappedValue: model)
        _checkout = StateObject(wrappedValue: Checkout(model: model))
    }

    var body: some View {
        ClipScreen(destination: .bookstore) {
            shop
        }
        .task {
            selling = Checkout.available
            model.loadIfNeeded()
        }
        .safari(url: $sheet)
    }

    @ViewBuilder private var shop: some View {
        switch model.state {
        case .loading:
            ClipCard {
                HStack(spacing: 10) {
                    ProgressView().tint(Ink.accent)
                    ClipBody(text: "Opening the church's bookstore…")
                }
            }

        case .failed(let message):
            ClipProblem(message: message) { model.load() }

        case .loaded(let products) where products.isEmpty:
            ClipCard {
                ClipEyebrow(text: "Nothing on the shelf")
                ClipBody(
                    text: "The bookstore has nothing listed just now. The bookstall in the hall is still open after the Liturgy."
                )
            }

        case .loaded(let products):
            if let outcome = checkout.outcome, case .paid(let orderId) = outcome {
                Receipt(orderId: orderId, shipping: model.shipping)
            } else {
                // Before the shelf, never after it: this is the sentence that
                // stops somebody choosing a book and then being refused.
                if !selling { Handoff() }

                if case .failed(let message) = checkout.outcome {
                    ClipCard {
                        ClipEyebrow(text: "Not paid")
                        ClipBody(text: message)
                    }
                }

                ClipCard(spacing: 14) {
                    ClipEyebrow(text: "The parish bookstore")
                    ForEach(products) { product in
                        Shelf(product: product, model: model, selling: selling)
                        if product.id != products.last?.id {
                            Divider().overlay(Ink.rule)
                        }
                    }
                }

                if selling {
                    Basket(model: model, checkout: checkout)

                    ClipBody(text: model.settings.returnsNotice, tone: Ink.inkFaint)
                        .font(Face.small)
                }
            }
        }

        ClipFooter(
            destination: .bookstore,
            readMore: "The church's shop has every title, with its full description and more pictures."
        )
    }
}

/* ── One title ────────────────────────────────────────────────────────────── */

private struct Shelf: View {
    let product: ShopProduct
    @ObservedObject var model: ShopModel
    /// False leaves the title, the cover and the price, and takes away the
    /// stepper — a price list rather than a basket nobody can pay for.
    let selling: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Cover(url: product.imageURL)

            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(Face.body.weight(.medium))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(money(product.amount))
                    .font(Face.small.weight(.semibold))
                    .foregroundStyle(Ink.accent)

                if product.soldOut {
                    Text("Sold out")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                } else if selling {
                    Stepper(product: product, model: model)
                }
            }

            Spacer(minLength: 0)
        }
    }
}

/// The cover, or the space one would take.
///
/// A placeholder of the same size rather than none, so a shelf does not reflow
/// as eleven images arrive one at a time over a church's wifi.
private struct Cover: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            Ink.paperSunken
        }
        .frame(width: 52, height: 68)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Ink.rule, lineWidth: 1))
    }
}

/// − n +, and nothing else.
///
/// Not SwiftUI's `Stepper`, whose label-plus-control layout wants a full row
/// and reads as a settings screen. The buttons are 34pt across in a 44pt row,
/// which is the tap target on a screen somebody is using one-handed.
private struct Stepper: View {
    let product: ShopProduct
    @ObservedObject var model: ShopModel

    private var quantity: Int { model.quantity(of: product) }

    var body: some View {
        HStack(spacing: 0) {
            if quantity == 0 {
                Button("Add") { model.adjust(product, by: 1) }
                    .font(Face.small.weight(.semibold))
                    .foregroundStyle(Ink.accent)
                    .padding(.horizontal, 14)
                    .frame(height: 34)
                    .overlay(Capsule().strokeBorder(Ink.rule, lineWidth: 1))
            } else {
                Knob(symbol: "minus") { model.adjust(product, by: -1) }
                Text("\(quantity)")
                    .font(Face.body.weight(.semibold))
                    .foregroundStyle(Ink.ink)
                    .frame(minWidth: 34)
                    .monospacedDigit()
                Knob(symbol: "plus") { model.adjust(product, by: 1) }
            }
        }
        .padding(.top, 2)
    }
}

private struct Knob: View {
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Ink.accent)
                .frame(width: 34, height: 34)
                .background(Ink.accentSoft)
                .clipShape(Circle())
        }
    }
}

/* ── The total, and the one button ────────────────────────────────────────── */

private struct Basket: View {
    @ObservedObject var model: ShopModel
    @ObservedObject var checkout: Checkout

    var body: some View {
        if !model.isEmpty {
            ClipCard {
                /*
                 * Sales tax, when anything in the basket carries it — the same
                 * figure the Apple Pay sheet itemises and the Function asks
                 * Square to charge, so the total below is the books as they
                 * will actually be paid for. Postage is still not here; see
                 * below.
                 */
                if model.taxCents > 0 {
                    HStack {
                        ClipBody(text: taxLabel(rateBps: model.settings.taxRateBps), tone: Ink.inkFaint)
                        Spacer()
                        Text(money(model.taxCents))
                            .font(Face.small)
                            .foregroundStyle(Ink.inkFaint)
                    }
                }

                HStack {
                    ClipBody(text: "Total", tone: Ink.ink)
                    Spacer()
                    Text(money(model.total))
                        .font(Face.heading)
                        .foregroundStyle(Ink.ink)
                }

                /*
                 * Deliberately not a delivery line. Collecting or posting is
                 * chosen inside the Apple Pay sheet, and postage is a
                 * `PKShippingMethod` there, so this figure is the basket until
                 * the sheet is open and the sheet's own arithmetic afterwards.
                 * Printing "plus postage" here would be guessing at a choice
                 * the buyer has not made yet.
                 */
                Text("Collect at the church, or have it posted — choose when you pay.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)

                ApplePayButton { checkout.begin() }
                    .frame(height: 48)
                    .opacity(checkout.busy ? 0.5 : 1)
                    .disabled(checkout.busy)

                Text("The church is charged nothing until Apple Pay is confirmed.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
            }
        }
    }
}

/// Apple's own mark, which is the only button allowed to say Apple Pay.
///
/// `PKPaymentButton` rather than SwiftUI's `PayWithApplePayButton`: that one
/// owns the `PKPaymentRequest` and presents the sheet itself, and this screen
/// needs the delegate — the shipping-method callback is where the total is
/// recomputed. See `Checkout.swift`.
private struct ApplePayButton: UIViewRepresentable {
    let action: () -> Void

    func makeUIView(context: Context) -> PKPaymentButton {
        let button = PKPaymentButton(paymentButtonType: .buy, paymentButtonStyle: .black)
        button.cornerRadius = 12
        button.addTarget(context.coordinator, action: #selector(Coordinator.fire), for: .touchUpInside)
        return button
    }

    func updateUIView(_ button: PKPaymentButton, context: Context) {
        context.coordinator.action = action
    }

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    final class Coordinator {
        var action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func fire() { action() }
    }
}

/* ── After ────────────────────────────────────────────────────────────────── */

private struct Receipt: View {
    let orderId: String
    let shipping: Bool

    var body: some View {
        ClipCard {
            ClipEyebrow(text: "Paid, thank you")
            ClipHeading(text: shipping ? "It will be posted to you." : "It will be waiting at the bookstall.")
            ClipBody(
                text: shipping
                    ? "The church has your order and a receipt is on its way to the address in your wallet."
                    : "The church has your order. Ask at the bookstall after the Liturgy, and there is a receipt on its way to you."
            )
            Text("Order \(orderId.prefix(8).uppercased())")
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)
        }
    }
}

/// What the screen says when it cannot take money — which was the whole screen
/// until Apple Pay made the errand finishable, and is still the right answer
/// for a wallet Square cannot charge.
private struct Handoff: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipCard {
            ClipEyebrow(text: "The parish bookstore")
            ClipHeading(text: "Icons, books and gifts from the church.")
            ClipBody(
                text: """
                Buying here needs Apple Pay, and this iPhone has not got a card set up for it. \
                Everything below is what the church sells; SPSM Connect takes a card typed in, \
                and so does the church's own website.
                """
            )

            ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
            ClipButton(label: "Shop on the website", tone: .quiet) {
                sheet = IdentifiableURL(url: ClipConfig.page("/bookstore"))
            }
        }
        .safari(url: $sheet)
    }
}
