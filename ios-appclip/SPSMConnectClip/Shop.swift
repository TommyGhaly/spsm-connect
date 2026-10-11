import Foundation

/// The shelf, and the basket on it.
///
/// The Swift half of `src/bookstore/data.ts` and `src/bookstore/cart.ts`, cut
/// to what a person standing at the bookstall can use: every published title in
/// one alphabetical list, a quantity against each, and a total.
///
/// **No descriptions.** `products` carries one and this deliberately does not
/// read it: a paragraph under each of eleven rows is a screenful of scrolling
/// on a sheet the system sizes, and the footer already points at the shop page,
/// which has the full text and every picture.
///
/// **No sections.** The app and the website divide the shop into categories —
/// Square's subcategories of "Bookstore", mirrored into
/// `config/bookstore.sections` (nested, by `parentId`) and onto each product as
/// `categoryIds` — which is the right call for a page somebody browses. A clip
/// is opened at the shelf itself by somebody holding the book they already
/// want, and eleven titles under one heading is less to read than eleven
/// titles under four. So neither field is read here, and the old single
/// `section` field going away changed nothing in this file. If the catalog
/// ever grows past a screenful, this is the first thing to revisit, and the
/// rules to copy are `groupProducts` in `@spsm/shared`'s `shopSections.ts`.
///
/// **Sales tax is read, and worked out here.** Not because the clip decides it
/// — `squareCheckout` reads the same two fields from Firestore and asks Square
/// to apply it — but because Apple Pay shows a total before the thumbprint, and
/// the tax is part of what gets charged. See `salesTaxCents` below.

/// One thing the church sells — or, for clothing, one size of it.
///
/// Clothing is laid out as one row per size ("Parish tee — size M"), each with
/// its own count and its own price, because the clip's basket is a quantity per
/// row and a size picker would be a second screen inside a sheet the system
/// sizes. The checkout is told the size; the add-on is charged from Firestore by
/// `buildSquareOrder`, never from what the clip sends.
struct ShopProduct: Identifiable, Equatable {
    /// The basket key: the slug, or `slug|size` for one size of clothing — the
    /// app's and the website's `cartKey`.
    let id: String
    let slug: String
    /// The size this row is, for clothing; `nil` for everything else.
    let size: String?
    let name: String
    /// Cents. `Money.amount` in `@spsm/shared`'s `commerce.ts` is an integer of
    /// the smallest unit, and this carries it as one all the way to Apple Pay —
    /// no float ever touches a price here.
    let amount: Int
    let imageURL: URL?
    /// `nil` means the parish does not count this one, which is deliberately
    /// distinct from `0`, meaning sold out.
    let stockCount: Int?
    /// Whether Massachusetts sales tax applies — the parish's flag on the
    /// product, `Product.taxable`. Absent is false, as it is server-side:
    /// nothing is taxed until somebody says so.
    let taxable: Bool
    /// The price before clearance, shown crossed out — `Product.wasPriceCents`
    /// plus whatever this size adds. `nil` unless it is the higher of the two,
    /// which is `clearanceOf`'s rule.
    let wasCents: Int?

    var soldOut: Bool { stockCount == 0 }

    /// The saving as a whole percent, as the shop's "% off" badge says it.
    var percentOff: Int? {
        guard let was = wasCents, was > amount, amount > 0 else { return nil }
        return Int((Double(was - amount) / Double(was) * 100).rounded())
    }

    /// `SIZE_PRESETS` in `@spsm/shared`'s `clothing.ts`, in its order.
    static let sizePresets = [
        "Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL",
        "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL",
    ]

    static func decode(_ fields: [String: FirestoreValue], id: String) -> [ShopProduct] {
        let name = fields["name"]?.stringValue ?? ""
        guard !name.isEmpty else { return [] }

        // `slug` is the document id by construction, but the checkout is keyed
        // by slug and a hand-edited document could disagree. Prefer the field,
        // fall back to the id — the same order `toShopProduct` uses.
        let slug = fields["slug"]?.stringValue.flatMap { $0.isEmpty ? nil : $0 } ?? id

        let first = fields["imagePaths"]?.arrayValue?.compactMap(\.stringValue).first
        let amount = fields["price"]?.mapValue?["amount"]?.intValue ?? 0
        let was = fields["wasPriceCents"]?.intValue.flatMap { $0 > amount ? $0 : nil }
        let taxable = fields["taxable"]?.boolValue == true

        /*
         * Clothing: `cleanSizes`, cut down — known labels only, once each, in
         * preset order, whole counts and add-ons within the shared bounds.
         * Anything it cannot read is dropped rather than guessed at, since the
         * Function charges by the same rules.
         */
        if let raw = fields["sizes"]?.arrayValue {
            var byLabel: [String: (count: Int, extra: Int)] = [:]
            for entry in raw {
                guard let map = entry.mapValue, let label = map["label"]?.stringValue,
                      sizePresets.contains(label), byLabel[label] == nil else { continue }
                let count = min(99_999, max(0, map["count"]?.intValue ?? 0))
                let extra = min(10_000, max(0, map["extraCents"]?.intValue ?? 0))
                byLabel[label] = (count, extra)
            }
            let rows: [ShopProduct] = sizePresets.compactMap { label in
                guard let size = byLabel[label] else { return nil }
                return ShopProduct(
                    id: "\(slug)|\(label)",
                    slug: slug,
                    size: label,
                    name: "\(name) — size \(label)",
                    amount: amount + size.extra,
                    imageURL: first.flatMap(URL.init(string:)),
                    stockCount: size.count,
                    taxable: taxable,
                    wasCents: was.map { $0 + size.extra }
                )
            }
            /*
             * Clothing with no size ticked yet cannot be bought, but it is still
             * on the shelf: the website shows it sold out (`sizesSoldOut` of an
             * empty list), so one sold-out row here rather than none.
             */
            if rows.isEmpty {
                return [ShopProduct(
                    id: slug, slug: slug, size: nil, name: name, amount: amount,
                    imageURL: first.flatMap(URL.init(string:)), stockCount: 0,
                    taxable: taxable, wasCents: was
                )]
            }
            return rows
        }

        return [ShopProduct(
            id: slug,
            slug: slug,
            size: nil,
            name: name,
            amount: amount,
            imageURL: first.flatMap(URL.init(string:)),
            stockCount: fields["stockCount"]?.intValue,
            taxable: taxable,
            wasCents: was
        )]
    }
}

/// The settings a sale depends on, from `config/bookstore`.
///
/// Not the whole document: `sections` is unused here, `orderEmail` belongs to
/// the Function that sends the receipt, and of `shipping` only the switch is
/// read — the box, the handling fee and the origin ZIP are the quote
/// Function's business, and it answers in cents. The defaults are
/// `DEFAULT_BOOKSTORE_CONFIG`'s, so a clip that reaches the shop a moment
/// before the settings land — or a parish that has never opened the editor —
/// reads correctly rather than blankly.
///
/// Every number falls back rather than clamps, field for field with
/// `parseBookstoreConfig`: these become part of a charge, and the Function
/// applies the same guards, so a value it would ignore is one this must ignore
/// too or the sheet and the card statement disagree.
struct ShopSettings {
    var deliveryCents: Int = 700
    /// Basis points: 625 is 6.25%. Applied only to `taxable` products.
    var taxRateBps: Int = 625
    /// `shipping.mode == "usps"`: whether to ask `/api/shipping/quote` at all.
    /// Off (the default) is the flat `deliveryCents` on every delivery, and
    /// asking anyway would only spend a round trip inside the sheet to be told
    /// so.
    var liveShipping = false
    var returnsNotice: String =
        "Sales are final. If a book reaches you damaged, or is not the one you ordered, "
        + "write to the church office within 14 days and it will be put right."

    /// `MAX_DELIVERY_CENTS` and `MAX_TAX_RATE_BPS` in `@spsm/shared`.
    static let maxDeliveryCents = 100_00
    static let maxTaxRateBps = 2_000

    static func decode(_ fields: [String: FirestoreValue]) -> ShopSettings {
        var settings = ShopSettings()
        if let cents = fields["deliveryCents"]?.intValue, (0...maxDeliveryCents).contains(cents) {
            settings.deliveryCents = cents
        }
        if let rate = fields["taxRateBps"]?.intValue, (0...maxTaxRateBps).contains(rate) {
            settings.taxRateBps = rate
        }
        settings.liveShipping = fields["shipping"]?.mapValue?["mode"]?.stringValue == "usps"
        if let notice = fields["returnsNotice"]?.stringValue, !notice.isEmpty {
            settings.returnsNotice = notice
        }
        return settings
    }
}

/* ── Sales tax ────────────────────────────────────────────────────────────────
 *
 * The Swift copy of `payments/salesTax.ts`, and it has to be a faithful one.
 * Square applies a LINE_ITEM-scoped percentage to each taxable line *on its
 * own* and rounds each with Bankers' Rounding, half to even; the sum of those
 * is the tax. Rounding the basket's total once instead is a cent out on the
 * right basket, and a cent is enough for the sheet to show less than the card
 * is charged.
 *
 * Integers throughout, where the TypeScript multiplies in floating point and
 * needs a tolerance to recognise a half. `lineCents * rateBps` is exact here,
 * so a half is a remainder of exactly 5,000 in 10,000 and no tolerance is
 * needed. Delivery is never passed in: Massachusetts does not tax a delivery
 * charge that is stated separately and avoidable by collecting.
 */

/// Tax on one line, in cents. `rateBps` is basis points: 625 is 6.25%.
func lineTaxCents(_ lineCents: Int, rateBps: Int) -> Int {
    guard lineCents > 0, rateBps > 0 else { return 0 }
    let scaled = lineCents * rateBps
    let whole = scaled / 10_000
    let rest = scaled % 10_000
    if rest > 5_000 { return whole + 1 }
    if rest < 5_000 { return whole }
    return whole % 2 == 0 ? whole : whole + 1
}

/// Tax on a basket: each taxable line taxed and rounded on its own, then summed.
func salesTaxCents(_ lines: [(amountCents: Int, taxable: Bool)], rateBps: Int) -> Int {
    lines.reduce(0) { $0 + ($1.taxable ? lineTaxCents($1.amountCents, rateBps: rateBps) : 0) }
}

/// `625` → `"Sales tax (6.25%)"`, the shared `taxLabel` — trailing zeros
/// dropped, so 600 reads "6%" and 650 "6.5%", as `toFixed(2)` and the regex do.
func taxLabel(rateBps: Int) -> String {
    let whole = rateBps / 100
    let part = rateBps % 100
    let percentage: String
    if part == 0 {
        percentage = "\(whole)"
    } else if part % 10 == 0 {
        percentage = "\(whole).\(part / 10)"
    } else {
        percentage = String(format: "%d.%02d", whole, part)
    }
    return "Sales tax (\(percentage)%)"
}

/// One way of posting the basket, as `/api/shipping/quote` priced it — the
/// shared `ShippingOption`, cut to what the sheet shows.
///
/// `id` is the signed quote, and the only thing about this the Function
/// believes. `cents` is the figure inside that signature, carried here to put
/// in the sheet; the clip never sends it back, so it cannot choose a price —
/// only echo a token whose price it was shown.
struct DeliveryOption: Equatable, Decodable {
    let id: String
    /// `USPS_GROUND_ADVANTAGE`, `PRIORITY_MAIL`, `MEDIA_MAIL`.
    let service: String
    let label: String
    let days: String?
    let cents: Int
}

/// `1234` → `"$12.34"`. Integer arithmetic, and the only place cents become a
/// string anywhere in this binary.
func money(_ cents: Int) -> String {
    String(format: "$%d.%02d", cents / 100, abs(cents) % 100)
}

/* ── The shop ─────────────────────────────────────────────────────────────── */

@MainActor
final class ShopModel: ObservableObject {
    enum State {
        case loading
        case loaded([ShopProduct])
        case failed(String)
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var settings = ShopSettings()

    /// Quantities by basket key — `ShopProduct.id`. A dictionary rather than a list of lines because
    /// every operation on this screen is "how many of that one", and a list
    /// would need a search for each.
    @Published var quantities: [String: Int] = [:]

    /// Posting to the church, rather than collecting at it.
    ///
    /// Set from the Apple Pay sheet's own shipping-method picker rather than by
    /// a control of ours — see `Checkout.swift`. It lives here because the
    /// total on screen must agree with the total in the sheet.
    @Published var shipping = false

    /// The live USPS options for the address in the sheet, cheapest first.
    ///
    /// Empty means flat delivery, for every reason the quote Function gives
    /// one: live rates off, an unweighed book, USPS slow, no address yet. Held
    /// here rather than in `Checkout` for the reason `shipping` is — the total
    /// is this model's, and it has to know what posting costs.
    @Published var deliveryOptions: [DeliveryOption] = []

    /// Which of `deliveryOptions` is chosen. `nil` while posting is the flat
    /// charge, and checkout then sends no `shippingOptionId`, which is the flat
    /// charge on the Function's side too.
    @Published var chosenOption: DeliveryOption?

    /// The flat charge, live where the quote has answered.
    ///
    /// `fallbackCents` in a quote response is `config/bookstore` as the
    /// Function read it a moment ago, which is fresher than the copy this clip
    /// fetched when it opened, and it is the figure checkout charges when no
    /// option is sent. `settings.deliveryCents` stands in until there is one.
    @Published var flatDeliveryCents = ShopSettings().deliveryCents

    private var started = false
    private var products: [ShopProduct] = []

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    func load() {
        state = .loading

        Task {
            /*
             * The settings are fetched first and separately, and a failure is
             * swallowed on purpose. `config/bookstore` missing means "the
             * parish has never set this", which the defaults above cover; the
             * catalog missing means there is no shop to draw. Only the second
             * is worth a screen that says so.
             */
            if let fields = try? await FirestoreREST.document("config/bookstore") {
                settings = ShopSettings.decode(fields)
                flatDeliveryCents = settings.deliveryCents
            }

            do {
                let rows = try await FirestoreREST.query("products", where: "published", equals: true)
                products = rows
                    .flatMap { ShopProduct.decode($0.fields, id: $0.id) }
                    // Alphabetical, matching `getProducts` on the website.
                    // Square's own order is the order things were created in,
                    // which is nobody's idea of a shelf.
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                state = .loaded(products)
            } catch {
                state = .failed(
                    "The church's bookstore could not be reached. It may be the signal where you are standing."
                )
            }
        }
    }

    /* ── The basket ──────────────────────────────────────────────────────── */

    func quantity(of product: ShopProduct) -> Int { quantities[product.id] ?? 0 }

    func adjust(_ product: ShopProduct, by delta: Int) {
        let next = quantity(of: product) + delta
        /*
         * Bounded by what the parish says it has, when it says anything. A
         * basket that can hold twelve of a book the church owns three of is a
         * refund and an apology, and the server would price all twelve.
         */
        let ceiling = product.stockCount ?? 99
        quantities[product.id] = max(0, min(next, ceiling))
        if quantities[product.id] == 0 { quantities.removeValue(forKey: product.id) }
    }

    var lines: [(product: ShopProduct, quantity: Int)] {
        products.compactMap { product in
            guard let quantity = quantities[product.id], quantity > 0 else { return nil }
            return (product, quantity)
        }
    }

    var isEmpty: Bool { lines.isEmpty }

    var subtotal: Int { lines.reduce(0) { $0 + $1.product.amount * $1.quantity } }

    var deliveryCents: Int {
        guard shipping else { return 0 }
        return chosenOption?.cents ?? flatDeliveryCents
    }

    /// Massachusetts sales tax on the books. Never on postage.
    var taxCents: Int {
        salesTaxCents(
            lines.map { (amountCents: $0.product.amount * $0.quantity, taxable: $0.product.taxable) },
            rateBps: settings.taxRateBps
        )
    }

    /// What Apple Pay will show, and what the Function will charge.
    ///
    /// The one invariant this screen has. The website got it wrong first by
    /// adding postage server-side where the page could not see it, so somebody
    /// authorised $24.00 with a thumbprint and was charged $31.00 — see
    /// `docs/apple-pay-google-pay.md` in the Website repo. Postage is a
    /// `PKShippingMethod` here precisely so the sheet does the addition itself,
    /// and sales tax is a line of its own for the same reason: the Function
    /// started adding it, and a sheet that did not would be that bug again.
    var total: Int { subtotal + taxCents + deliveryCents }

    /// What the checkout posts. Slugs, quantities and — for clothing — the
    /// size, never prices: there is deliberately nowhere in the request to put
    /// one.
    var cart: [[String: Any]] {
        lines.map { line in
            var entry: [String: Any] = ["slug": line.product.slug, "quantity": line.quantity]
            if let size = line.product.size { entry["size"] = size }
            return entry
        }
    }
}
