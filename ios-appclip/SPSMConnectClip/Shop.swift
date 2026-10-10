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
/// **No sections.** The app and the website divide the shop by
/// `config/bookstore.sections`, which is the right call for a page somebody
/// browses. A clip is opened at the shelf itself by somebody holding the book
/// they already want, and eleven titles under one heading is less to read than
/// eleven titles under four. If the catalog ever grows past a screenful, this
/// is the first thing to revisit.

/// One thing the church sells.
struct ShopProduct: Identifiable, Equatable {
    let id: String
    let slug: String
    let name: String
    /// Cents. `Money.amount` in `@spsm/shared`'s `commerce.ts` is an integer of
    /// the smallest unit, and this carries it as one all the way to Apple Pay —
    /// no float ever touches a price here.
    let amount: Int
    let imageURL: URL?
    /// `nil` means the parish does not count this one, which is deliberately
    /// distinct from `0`, meaning sold out.
    let stockCount: Int?

    var soldOut: Bool { stockCount == 0 }

    static func decode(_ fields: [String: FirestoreValue], id: String) -> ShopProduct? {
        let name = fields["name"]?.stringValue ?? ""
        guard !name.isEmpty else { return nil }

        // `slug` is the document id by construction, but the checkout is keyed
        // by slug and a hand-edited document could disagree. Prefer the field,
        // fall back to the id — the same order `toShopProduct` uses.
        let slug = fields["slug"]?.stringValue.flatMap { $0.isEmpty ? nil : $0 } ?? id

        let first = fields["imagePaths"]?.arrayValue?.compactMap(\.stringValue).first

        return ShopProduct(
            id: id,
            slug: slug,
            name: name,
            amount: fields["price"]?.mapValue?["amount"]?.intValue ?? 0,
            imageURL: first.flatMap(URL.init(string:)),
            stockCount: fields["stockCount"]?.intValue
        )
    }
}

/// The two settings a sale depends on, from `config/bookstore`.
///
/// Not the whole document: `sections` is unused here, and `orderEmail` belongs
/// to the Function that sends the receipt. The defaults are
/// `DEFAULT_BOOKSTORE_CONFIG`'s, so a clip that reaches the shop a moment
/// before the settings land — or a parish that has never opened the editor —
/// reads correctly rather than blankly.
struct ShopSettings {
    var deliveryCents: Int = 700
    var returnsNotice: String =
        "Sales are final. If a book reaches you damaged, or is not the one you ordered, "
        + "write to the church office within 14 days and it will be put right."

    static func decode(_ fields: [String: FirestoreValue]) -> ShopSettings {
        var settings = ShopSettings()
        if let cents = fields["deliveryCents"]?.intValue, cents >= 0 {
            settings.deliveryCents = cents
        }
        if let notice = fields["returnsNotice"]?.stringValue, !notice.isEmpty {
            settings.returnsNotice = notice
        }
        return settings
    }
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

    /// Quantities by slug. A dictionary rather than a list of lines because
    /// every operation on this screen is "how many of that one", and a list
    /// would need a search for each.
    @Published var quantities: [String: Int] = [:]

    /// Posting to the church, rather than collecting at it.
    ///
    /// Set from the Apple Pay sheet's own shipping-method picker rather than by
    /// a control of ours — see `Checkout.swift`. It lives here because the
    /// total on screen must agree with the total in the sheet.
    @Published var shipping = false

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
            }

            do {
                let rows = try await FirestoreREST.query("products", where: "published", equals: true)
                products = rows
                    .compactMap { ShopProduct.decode($0.fields, id: $0.id) }
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

    func quantity(of product: ShopProduct) -> Int { quantities[product.slug] ?? 0 }

    func adjust(_ product: ShopProduct, by delta: Int) {
        let next = quantity(of: product) + delta
        /*
         * Bounded by what the parish says it has, when it says anything. A
         * basket that can hold twelve of a book the church owns three of is a
         * refund and an apology, and the server would price all twelve.
         */
        let ceiling = product.stockCount ?? 99
        quantities[product.slug] = max(0, min(next, ceiling))
        if quantities[product.slug] == 0 { quantities.removeValue(forKey: product.slug) }
    }

    var lines: [(product: ShopProduct, quantity: Int)] {
        products.compactMap { product in
            guard let quantity = quantities[product.slug], quantity > 0 else { return nil }
            return (product, quantity)
        }
    }

    var isEmpty: Bool { lines.isEmpty }

    var subtotal: Int { lines.reduce(0) { $0 + $1.product.amount * $1.quantity } }

    var deliveryCents: Int { shipping ? settings.deliveryCents : 0 }

    /// What Apple Pay will show, and what the Function will charge.
    ///
    /// The one invariant this screen has. The website got it wrong first by
    /// adding postage server-side where the page could not see it, so somebody
    /// authorised $24.00 with a thumbprint and was charged $31.00 — see
    /// `docs/apple-pay-google-pay.md` in the Website repo. Postage is a
    /// `PKShippingMethod` here precisely so the sheet does the addition itself.
    var total: Int { subtotal + deliveryCents }

    /// What the checkout posts. Slugs and quantities, never prices — there is
    /// deliberately nowhere in the request to put one.
    var cart: [[String: Any]] {
        lines.map { ["slug": $0.product.slug, "quantity": $0.quantity] }
    }
}
