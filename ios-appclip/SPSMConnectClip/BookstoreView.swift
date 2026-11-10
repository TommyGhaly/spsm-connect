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
    /// The website's Clearance toggle: the shelf narrowed to what is marked
    /// down, deepest discount first. Only offered while something is.
    @State private var clearanceOnly = false

    init() {
        let model = ShopModel()
        _model = StateObject(wrappedValue: model)
        _checkout = StateObject(wrappedValue: Checkout(model: model))
    }

    var body: some View {
        ClipScreen(destination: .bookstore, bar: payBar) {
            shop
        }
        .task {
            selling = Checkout.available
            model.loadIfNeeded()
        }
        .safari(url: $sheet)
    }

    /// The total and the button, pinned under the shelf so paying never means
    /// scrolling past every title first. Only while there is something to pay
    /// for: an empty basket, a paid order or a wallet Square cannot charge has
    /// no bar at all, and the shelf keeps the whole sheet.
    private var payBar: AnyView? {
        guard selling, !model.isEmpty, case .loaded = model.state else { return nil }
        if case .paid = checkout.outcome { return nil }
        return AnyView(PayBar(model: model, checkout: checkout))
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

                let onSale = products
                    .filter { $0.percentOff != nil && !$0.soldOut }
                    .sorted { ($0.percentOff ?? 0) > ($1.percentOff ?? 0) }
                let shown = clearanceOnly && !onSale.isEmpty ? onSale : products

                ClipCard(spacing: 14) {
                    ClipEyebrow(text: "The parish bookstore")
                    if !onSale.isEmpty {
                        ClearanceToggle(
                            on: clearanceOnly,
                            deepest: onSale.first?.percentOff ?? 0,
                            count: onSale.count
                        ) { clearanceOnly.toggle() }
                    }
                    let titles = grouped(shown)
                    ForEach(titles, id: \.first?.slug) { variants in
                        Shelf(variants: variants, model: model, selling: selling)
                        if variants.first?.slug != titles.last?.first?.slug {
                            Divider().overlay(Ink.rule)
                        }
                    }
                }

                if selling {
                    Text("The church is charged nothing until Apple Pay is confirmed.")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)

                    ClipBody(text: model.settings.returnsNotice, tone: Ink.inkFaint)
                        .font(Face.small)
                }
            }
        }
    }
}

/// Rows back into titles: every size of one shirt under one entry, in the order
/// the rows came — alphabetical by title, sizes in preset order (`ShopModel`).
private func grouped(_ rows: [ShopProduct]) -> [[ShopProduct]] {
    var titles: [[ShopProduct]] = []
    for row in rows {
        if let last = titles.last?.first, last.slug == row.slug {
            titles[titles.count - 1].append(row)
        } else {
            titles.append([row])
        }
    }
    return titles
}

/* ── Clearance ────────────────────────────────────────────────────────────── */

/// "Clearance · up to N% off", outlined in the accent while off so it reads as
/// an offer and filled when on — the website's `.shop-filter--sale`.
private struct ClearanceToggle: View {
    let on: Bool
    let deepest: Int
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text("Clearance").font(Face.small.weight(.semibold))
                if deepest > 0 { Text("up to \(deepest)% off").font(Face.small) }
                Text("\(count)").font(Face.small).opacity(0.7)
            }
            .foregroundStyle(on ? Color.white : Ink.accent)
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .background(Capsule().fill(on ? Ink.accent : Color.clear))
            .overlay(Capsule().strokeBorder(Ink.accent, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/* ── One title ────────────────────────────────────────────────────────────── */

private struct Shelf: View {
    /// One row for a book; one per size for clothing.
    let variants: [ShopProduct]
    @ObservedObject var model: ShopModel
    /// False leaves the title, the cover and the price, and takes away the
    /// stepper — a price list rather than a basket nobody can pay for.
    let selling: Bool

    /// The size the stepper is counting, by basket key.
    @State private var chosenId: String?

    private var sized: Bool { variants.contains { $0.size != nil } }
    /// The tapped size — or, when only one size is left to buy, that one,
    /// since asking somebody to choose from one is a tap for nothing.
    private var chosen: ShopProduct? {
        guard sized else { return variants.first }
        if let picked = variants.first(where: { $0.id == chosenId }) { return picked }
        let buyable = variants.filter { !$0.soldOut }
        return buyable.count == 1 ? buyable[0] : nil
    }
    private var soldOut: Bool { variants.allSatisfy(\.soldOut) }

    /// The row whose price is shown: the chosen size, or the cheapest one
    /// that can be bought until a size is chosen.
    private var priced: ShopProduct {
        chosen
            ?? variants.filter { !$0.soldOut }.min { $0.amount < $1.amount }
            ?? variants[0]
    }

    /// "From" only while the sizes disagree on price and none is chosen.
    private var from: Bool {
        chosen == nil && Set(variants.filter { !$0.soldOut }.map(\.amount)).count > 1
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Cover(url: priced.imageURL)

            VStack(alignment: .leading, spacing: 6) {
                Text(priced.title)
                    .font(Face.body.weight(.medium))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Price(product: priced, from: from)

                if soldOut {
                    Text("Sold out")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                } else {
                    if sized {
                        SizePicker(variants: variants, model: model, chosenId: $chosenId, chosen: chosen)
                    }
                    if selling {
                        if let chosen {
                            Stepper(product: chosen, model: model)
                        } else {
                            Text("Choose a size")
                                .font(Face.small)
                                .foregroundStyle(Ink.inkFaint)
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
    }
}

/// On clearance: the old price struck through beside the new one, and the
/// saving — the shop's crossed-out price and badge.
private struct Price: View {
    let product: ShopProduct
    let from: Bool

    var body: some View {
        HStack(spacing: 6) {
            if from {
                Text("From").font(Face.small).foregroundStyle(Ink.inkFaint)
            }
            if let was = product.wasCents, let off = product.percentOff {
                Text(money(was))
                    .font(Face.small)
                    .strikethrough()
                    .foregroundStyle(Ink.inkFaint)
                Text(money(product.amount))
                    .font(Face.small.weight(.semibold))
                    .foregroundStyle(Ink.accent)
                Text("\(off)% off")
                    .font(Face.small.weight(.semibold))
                    .foregroundStyle(Ink.accent)
            } else {
                Text(money(product.amount))
                    .font(Face.small.weight(.semibold))
                    .foregroundStyle(Ink.accent)
            }
        }
    }
}

/// Every size as a chip, wrapped — one tap chooses the size the stepper below
/// counts. A size already in the basket carries its count, so a buyer taking
/// an M and two Ls sees both without opening anything. Sold-out sizes stay,
/// struck through and untappable, because a missing size reads as "never made".
private struct SizePicker: View {
    let variants: [ShopProduct]
    @ObservedObject var model: ShopModel
    @Binding var chosenId: String?
    /// What the shelf is counting, which may be a size nobody tapped.
    let chosen: ShopProduct?

    var body: some View {
        Wrap(spacing: 6) {
            ForEach(variants) { variant in
                let label = variant.size ?? variant.title
                let count = model.quantity(of: variant)
                let on = chosen?.id == variant.id
                Button {
                    chosenId = variant.id
                } label: {
                    HStack(spacing: 4) {
                        Text(label)
                            .strikethrough(variant.soldOut)
                        if count > 0 {
                            Text("×\(count)").opacity(0.8).monospacedDigit()
                        }
                    }
                    .font(Face.small.weight(on ? .semibold : .regular))
                    .foregroundStyle(
                        on ? Color.white : variant.soldOut ? Ink.inkFaint : count > 0 ? Ink.accent : Ink.ink
                    )
                    .padding(.horizontal, 10)
                    .frame(minWidth: 40, minHeight: 32)
                    .background(
                        Capsule().fill(on ? Ink.accent : count > 0 ? Ink.accentSoft : Color.clear)
                    )
                    .overlay(Capsule().strokeBorder(on ? Ink.accent : Ink.rule, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(variant.soldOut)
                .accessibilityLabel(
                    "Size \(label)\(variant.soldOut ? ", sold out" : "")\(count > 0 ? ", \(count) in basket" : "")"
                )
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

/// Left to right, then onto the next line — chips that wrap rather than a
/// row that scrolls sideways and hides half the sizes.
struct Wrap: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                y += line + spacing
                x = 0
                line = 0
            }
            x += size.width + spacing
            line = max(line, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: widest, height: y + line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += line + spacing
                x = bounds.minX
                line = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            line = max(line, size.height)
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

/* ── The total, and the one button, pinned ────────────────────────────────── */

private struct PayBar: View {
    @ObservedObject var model: ShopModel
    @ObservedObject var checkout: Checkout

    private var count: Int { model.lines.reduce(0) { $0 + $1.quantity } }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    /*
                     * Sales tax, when anything in the basket carries it — the
                     * same figure the Apple Pay sheet itemises and the Function
                     * asks Square to charge, so the total is the books as they
                     * will actually be paid for.
                     */
                    Text(
                        (count == 1 ? "1 item" : "\(count) items")
                            + (model.taxCents > 0 ? " · incl. \(money(model.taxCents)) tax" : "")
                    )
                    Text(money(model.total))
                        .font(Face.heading)
                        .foregroundStyle(Ink.ink)
                }
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)

                Spacer(minLength: 0)

                ApplePayButton { checkout.begin() }
                    .frame(maxWidth: 200)
                    .frame(height: 48)
                    .opacity(checkout.busy ? 0.5 : 1)
                    .disabled(checkout.busy)
            }

            /*
             * Deliberately not a delivery line. Collecting or posting is chosen
             * inside the Apple Pay sheet, and postage is a `PKShippingMethod`
             * there, so this figure is the basket until the sheet is open and
             * the sheet's own arithmetic afterwards.
             */
            Text("Collect at the church, or have it posted — choose when you pay.")
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.paperRaised, ignoresSafeAreaEdges: .bottom)
        .overlay(alignment: .top) { Rectangle().fill(Ink.rule).frame(height: 1) }
    }
}

/// Apple's own mark, which is the only button allowed to say Apple Pay.
///
/// `PKPaymentButton` rather than SwiftUI's `PayWithApplePayButton`: that one
/// owns the `PKPaymentRequest` and presents the sheet itself, and this screen
/// needs the delegate — the shipping-method callback is where the total is
/// recomputed. See `Checkout.swift`. Shared with the paid forms in
/// `FormsView`, which say "Continue with" rather than "Buy with".
struct ApplePayButton: UIViewRepresentable {
    var type: PKPaymentButtonType = .buy
    let action: () -> Void

    func makeUIView(context: Context) -> PKPaymentButton {
        let button = PKPaymentButton(paymentButtonType: type, paymentButtonStyle: .black)
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
