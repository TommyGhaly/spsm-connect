import Foundation
import PassKit
import SquareInAppPaymentsSDK

/// Taking money for a book, in an App Clip.
///
/// ---------------------------------------------------------------------------
/// ## Apple Pay, and nothing else
///
/// Square's card sheet is in this binary — `SQIPCardEntryViewController` comes
/// with the framework whether it is called or not — and it is deliberately not
/// used. The reason is not the card: it is the other five fields. The checkout
/// Function requires an email address, a first and last name, a fulfilment
/// choice and, when posting, a full address, and it validates every one of them
/// server-side. Typing that into a clip, standing at a bookstall, is worse than
/// being told to install the app.
///
/// Apple Pay supplies all of it. `requiredShippingContactFields` returns the
/// name, the email and the address from the wallet, and `shippingMethods` makes
/// collect-or-post a row in the sheet rather than a control of ours. **So the
/// clip asks the buyer for nothing at all**, which is the only reason a shop
/// belongs in a clip. That, rather than the framework's size, is what changed
/// the answer here; the size question is settled separately and the measurement
/// is in `src/clip/experiences.ts`.
///
/// ## Where the money is decided, and where it is not
///
/// Nowhere here. The request carries slugs, quantities and a one-time token —
/// there is deliberately nowhere in it to put a price. `squareCheckout` prices
/// the basket from Square's own catalog and charges what Square says, so a
/// basket edited on the device cannot change the total. The same Function, the
/// same `sourceId` field, and the same contract the website and the app both
/// use: a nonce is a nonce whether a browser, a phone or a clip minted it.
///
/// The one thing that *must* agree is the figure in the sheet. Apple Pay shows
/// a total before the thumbprint, and the church taking more than it showed is
/// the failure that matters — see `docs/apple-pay-google-pay.md` in the Website
/// repo, where exactly that happened with postage. Postage is a
/// `PKShippingMethod` below so the sheet does the addition itself.
///
/// ## Sales tax, and live postage
///
/// Two things the Function started charging that the sheet has to show.
///
/// **Tax** is a summary line of its own, worked out in `Shop.swift` from the
/// product's `taxable` flag and `config/bookstore.taxRateBps` — the same two
/// fields `squareCheckout` reads — per line, half to even, as Square rounds it.
/// Nothing about it is sent: the Function decides it again from Firestore.
///
/// **Postage** is priced by USPS when the parish has live rates on. Apple Pay
/// hands over a partial address the moment a contact is chosen — enough for
/// the ZIP and no more, until the thumbprint — and that is all
/// `/api/shipping/quote` needs. Each service it returns becomes a
/// `PKShippingMethod`, beside "Collect", and the chosen one's signed id goes to
/// checkout as `shippingOptionId`. The Function charges the cents *inside the
/// signature*, so the price still travels in only one direction; the clip
/// merely echoes a token it was shown the price of. No options — rates off, an
/// unweighed book, USPS down, an address abroad — is the flat row, and no id,
/// which is the flat charge on both sides.
///
/// Neither endpoint wants an App Check header: the checkout and the quote are
/// both open to the website's anonymous browsers, rate-limited by address, and
/// the clip calls them exactly as a browser does. `AppAttest.swift` is for the
/// gallery upload alone.
/// ---------------------------------------------------------------------------
@MainActor
final class Checkout: NSObject, ObservableObject {
    enum Outcome: Equatable {
        /// The sheet closed with nothing bought. Cancelling is ordinary and is
        /// not an error anybody should be shown a message about.
        case cancelled
        case paid(orderId: String)
        case failed(String)
    }

    @Published private(set) var outcome: Outcome?
    @Published private(set) var busy = false

    private let model: ShopModel

    /// Made once and held across every attempt inside one sheet.
    ///
    /// Square treats a repeated idempotency key as the same payment. A buyer
    /// whose first card is declined and who immediately picks another must
    /// reuse it — a fresh key on the retry is a *second* payment, and the way
    /// that fails is by charging twice. Each attempt needs a new nonce and the
    /// same key, which is exactly what one `Checkout` instance per sheet gives.
    private let idempotencyKey = UUID().uuidString

    /// Held across the delegate callbacks so the receipt can be filed against
    /// whoever the wallet said was buying.
    private var contact: PKContact?

    /// The sheet, held for as long as it is up.
    ///
    /// A `PKPaymentAuthorizationController` is not retained by the system while
    /// it is presented — nothing but this owns it, and a local would be
    /// released at the end of `begin()`. The failure is not a crash: the
    /// delegate stops being called, so the sheet sits there and the thumbprint
    /// does nothing. Released in `close()`, which is the one place the sheet is
    /// known to be gone.
    private var controller: PKPaymentAuthorizationController?

    /// The grand total the sheet was last given, in cents.
    ///
    /// Checked against the basket at the thumbprint, against the sheet's own
    /// record of which delivery row is ticked (`PKPayment.shippingMethod`). If
    /// the two ever disagree, the figure authorised is not the figure the
    /// Function would charge, and the payment is refused here rather than
    /// taken — see `settle`.
    private var shownTotal = 0

    init(model: ShopModel) {
        self.model = model
        super.init()
    }

    /// Whether to offer an Apple Pay button at all.
    ///
    /// Three things, and each answers a different question. `canSell` is about
    /// the *build* — were the two Square ids stamped in. `canUseApplePay` is
    /// about the *device and the wallet* — Square's own check, which the SDK
    /// documents as the one to make before presenting anything. `canMakePayments`
    /// is PassKit's, and it is the one that is false on a Simulator, which is
    /// why none of this can be tested anywhere else.
    static var available: Bool {
        guard configured else { return false }
        return SQIPInAppPaymentsSDK.canUseApplePay && PKPaymentAuthorizationController.canMakePayments()
    }

    /// Hands Square its application id, once.
    ///
    /// `static let` because the SDK's own warning is that *any* other call
    /// crashes before the id is set, and a lazily-initialised constant is the
    /// one construct that cannot be read before it has run. False here means
    /// the ids were never stamped into this build, which is an ordinary state —
    /// see `ClipConfig.canSell`.
    private static let configured: Bool = {
        guard ClipConfig.canSell else { return false }
        SQIPInAppPaymentsSDK.squareApplicationID = ClipConfig.squareApplicationId
        return true
    }()

    func begin() {
        guard !model.isEmpty, Checkout.available else { return }

        outcome = nil
        // Collect is the default because the tag is on the bookstall: the
        // person scanning it is standing in the church. Posting is the second
        // row, not the first.
        model.shipping = false
        // A fresh sheet prices afresh. Options from an earlier sheet were
        // quoted for an address this one may not use, and their tokens expire.
        model.deliveryOptions = []
        model.chosenOption = nil
        model.flatDeliveryCents = model.settings.deliveryCents

        let request = PKPaymentRequest.squarePaymentRequest(
            merchantIdentifier: ClipConfig.applePayMerchantId,
            countryCode: "US",
            currencyCode: "USD"
        )

        /*
         * The whole form, as three wallet fields.
         *
         * `.postalAddress` is required even for a collection, and that is the
         * one piece of friction in this design: a wallet with no address on it
         * prompts to add one before paying, at a bookstall. It is required
         * anyway because the choice between collecting and posting is made
         * *inside* the sheet, after this request is built, and the fields
         * cannot change once it opens. Requiring it always is the smaller
         * cost — a person who chooses to post and has no address would
         * otherwise reach the end and be refused by the Function.
         */
        request.requiredShippingContactFields = [.name, .emailAddress, .postalAddress]
        request.shippingMethods = shippingMethods()
        request.paymentSummaryItems = summaryItems()

        let controller = PKPaymentAuthorizationController(paymentRequest: request)
        controller.delegate = self
        self.controller = controller
        busy = true
        controller.present { presented in
            Task { @MainActor in
                if !presented {
                    self.controller = nil
                    self.busy = false
                    self.outcome = .failed("Apple Pay could not be opened on this iPhone.")
                }
            }
        }
    }

    /* ── What the sheet shows ────────────────────────────────────────────── */

    /// Cents → `NSDecimalNumber`, exactly.
    ///
    /// `mantissa`/`exponent` rather than dividing by a hundred: PassKit wants a
    /// decimal, the basket holds an integer, and a division is a chance for
    /// $12.34 to become $12.339999. Money is never a float anywhere in this
    /// binary and this is the one place it could have become one.
    private func usd(_ cents: Int) -> NSDecimalNumber {
        NSDecimalNumber(mantissa: UInt64(abs(cents)), exponent: -2, isNegative: cents < 0)
    }

    /// The sheet's delivery rows. Identifiers are how `apply` reads a choice
    /// back: `collect`, `ship` for the flat charge, `usps:<service>` for a
    /// live quote.
    private static let collectId = "collect"
    private static let flatId = "ship"
    private static let uspsPrefix = "usps:"

    /// Collect, then either the live services or the one flat row.
    ///
    /// **Whatever the model holds is first.** PassKit ticks the first method in
    /// a list it is handed, and a contact change hands it a new list. So a
    /// buyer who chose to post and then picks another address finds their
    /// choice still ticked at the top — the service they had, if USPS still
    /// offers it there, or the cheapest — rather than silently reset to
    /// collecting, with the summary saying one thing and the row another.
    /// Opening the sheet is the ordinary case, and there the model is
    /// collecting, so the order is the natural one.
    private func shippingMethods() -> [PKShippingMethod] {
        let collect = PKShippingMethod(label: "Collect at the church", amount: usd(0))
        collect.identifier = Checkout.collectId
        collect.detail = "Ready at the bookstall. The office will write when it is."

        var posts: [PKShippingMethod]
        if model.deliveryOptions.isEmpty {
            let flat = PKShippingMethod(label: "Post to me", amount: usd(model.flatDeliveryCents))
            flat.identifier = Checkout.flatId
            flat.detail = "Flat rate, anywhere in the United States."
            posts = [flat]
        } else {
            // Cheapest first, as the Function sorts them.
            posts = model.deliveryOptions.map { option in
                let method = PKShippingMethod(label: option.label, amount: usd(option.cents))
                method.identifier = Checkout.uspsPrefix + option.service
                method.detail = option.days
                return method
            }
            if let chosen = model.chosenOption,
               let at = posts.firstIndex(where: { $0.identifier == Checkout.uspsPrefix + chosen.service }) {
                posts.insert(posts.remove(at: at), at: 0)
            }
        }

        return model.shipping ? posts + [collect] : [collect] + posts
    }

    /// Every line, then postage when there is any, then the church.
    ///
    /// The grand total is the last item by PassKit's rule, and its label is
    /// what appears beside the amount on the sheet — so it is the church's
    /// name, which is also what shows on the card statement.
    private func summaryItems() -> [PKPaymentSummaryItem] {
        var items = model.lines.map { line in
            PKPaymentSummaryItem(
                label: line.quantity > 1 ? "\(line.product.name) × \(line.quantity)" : line.product.name,
                amount: usd(line.product.amount * line.quantity)
            )
        }

        // Tax before postage, because it is on the books and not on the parcel.
        let tax = model.taxCents
        if tax > 0 {
            items.append(
                PKPaymentSummaryItem(label: taxLabel(rateBps: model.settings.taxRateBps), amount: usd(tax))
            )
        }

        if model.deliveryCents > 0 {
            items.append(
                PKPaymentSummaryItem(label: model.chosenOption?.label ?? "Postage", amount: usd(model.deliveryCents))
            )
        }

        shownTotal = model.total
        items.append(
            PKPaymentSummaryItem(label: "St. Philopater & St. Mina", amount: usd(shownTotal))
        )

        return items
    }

    /* ── Spending the token ──────────────────────────────────────────────── */

    /// `PKPayment` → Square nonce → the church's Function.
    ///
    /// Square's step is a network call to its tokenizer, not a local decrypt:
    /// the payment-processing certificate that unwraps Apple's token belongs to
    /// Square, which is why the parish needs a merchant id but never holds a
    /// key. What comes back is the same one-time `sourceId` the website's card
    /// field produces.
    private func charge(_ payment: PKPayment) async throws -> String {
        let nonce: String = try await withCheckedThrowingContinuation { continuation in
            SQIPApplePayNonceRequest(payment: payment).perform { details, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let nonce = details?.nonce {
                    continuation.resume(returning: nonce)
                } else {
                    continuation.resume(throwing: CheckoutError("Apple Pay returned no token."))
                }
            }
        }

        do {
            return try await post(nonce: nonce)
        } catch is QuoteExpired {
            return try await requoteAndRetry(nonce: nonce)
        }
    }

    /// The Function refused the postage token — older than its thirty minutes,
    /// or the final address's ZIP is not the one the partial address gave.
    ///
    /// ---------------------------------------------------------------------
    /// The website's answer is to fetch a fresh quote, show it, and let the
    /// buyer press Pay again. A sheet cannot be re-priced from inside an
    /// authorisation, so the clip asks again itself and goes on **only if the
    /// new quote is for the same service at the same cents** — then the figure
    /// the thumbprint approved is still the figure charged, and the token is
    /// merely newer. Anything else fails the payment with a sentence saying
    /// why; the next sheet quotes afresh and shows the new price before
    /// anybody pays it.
    ///
    /// The nonce is spent once at most. The 409 is answered before the
    /// Function calls Square, so the same nonce and the same idempotency key
    /// are an untouched first attempt as far as Square knows.
    /// ---------------------------------------------------------------------
    private func requoteAndRetry(nonce: String) async throws -> String {
        let changed = CheckoutError(
            "The postage to this address changed after it was priced, so nothing was charged. "
                + "Open Apple Pay again to see the new figure."
        )
        guard let held = model.chosenOption,
              let zip = usableZip(contact?.postalAddress?.postalCode),
              let fresh = try? await quote(zip: zip),
              let same = fresh.options.first(where: { $0.service == held.service && $0.cents == held.cents })
        else { throw changed }

        model.deliveryOptions = fresh.options
        model.chosenOption = same
        do {
            return try await post(nonce: nonce)
        } catch is QuoteExpired {
            throw changed
        }
    }

    /* ── Live postage ────────────────────────────────────────────────────── */

    /// `POST /api/shipping/quote` — the shared `ShippingQuoteResponse`.
    ///
    /// The same endpoint and the same body as the website's
    /// `useShippingQuote`: slugs, quantities and a ZIP. Ten seconds, because
    /// this runs inside Apple's sheet, which gives a contact callback about
    /// thirty before it gives up on the payment; the Function stops waiting for
    /// USPS after four and answers with the flat charge.
    private func quote(zip: String) async throws -> QuoteResponse {
        var request = URLRequest(url: ClipConfig.api("/api/shipping/quote"))
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "cart": model.cart,
            "postalCode": zip,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(QuoteResponse.self, from: data)
    }

    /// Five digits from a postal code — the shared `usableZip`. `"01778-1234"`
    /// and `" 01778 "` both count; anything else, including an address abroad,
    /// is nil, and nil is the flat charge.
    private func usableZip(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        // ASCII digits only, as JavaScript's `\d` is. Swift's would also take
        // the Arabic-Indic ones, which no ZIP code is written in.
        guard let match = trimmed.wholeMatch(of: #/(\d{5})(?:-?\d{4})?/#.asciiOnlyDigits()) else { return nil }
        return String(match.1)
    }

    /// A wallet contact's name, as the two fields the Function requires.
    ///
    /// Both are mandatory server-side — a collection order is handed to a
    /// person, and one with nobody's name on it is one a volunteer cannot file.
    /// `PKContact` almost always carries `givenName` and `familyName`
    /// separately, but a wallet holding only a single-line name would otherwise
    /// reach the till and be refused for something the buyer cannot fix from
    /// inside Apple's sheet. So a name with no family part is split on its last
    /// space, and a single word is sent as both rather than as half a record.
    private func names(from components: PersonNameComponents?) -> (String, String) {
        let given = components?.givenName?.trimmingCharacters(in: .whitespaces) ?? ""
        let family = components?.familyName?.trimmingCharacters(in: .whitespaces) ?? ""
        if !given.isEmpty, !family.isEmpty { return (given, family) }

        let whole = [given, family, components?.nickname ?? ""]
            .first { !$0.isEmpty } ?? ""
        guard let space = whole.lastIndex(of: " ") else {
            return whole.isEmpty ? ("", "") : (whole, whole)
        }
        return (
            String(whole[whole.startIndex..<space]),
            String(whole[whole.index(after: space)...])
        )
    }

    private func post(nonce: String) async throws -> String {
        let (firstName, lastName) = names(from: contact?.name)
        var body: [String: Any] = [
            "sourceId": nonce,
            "cart": model.cart,
            "email": contact?.emailAddress ?? "",
            "firstName": firstName,
            "lastName": lastName,
            "fulfillment": model.shipping ? "ship" : "collect",
            "idempotencyKey": idempotencyKey,
        ]

        // The signed quote, when posting by a live service. Absent is the flat
        // charge, which is what the Function takes with no token at all.
        if model.shipping, let option = model.chosenOption {
            body["shippingOptionId"] = option.id
        }

        if model.shipping, let postal = contact?.postalAddress {
            /*
             * Field for field with the app's own form — `line1`, `city`,
             * `state`, `postalCode` are what `isUsableAddress` checks, and the
             * Function refuses a posted order without all four. CNPostalAddress
             * keeps the whole street in `street`, newlines and all, so the
             * second line is whatever follows the first.
             */
            let street = postal.street.split(separator: "\n", omittingEmptySubsequences: true)
            body["address"] = [
                "line1": street.first.map(String.init) ?? postal.street,
                "line2": street.dropFirst().joined(separator: " "),
                "city": postal.city,
                "state": postal.state,
                "postalCode": postal.postalCode,
            ]
        }

        var request = URLRequest(url: ClipConfig.api("/api/square/checkout"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw CheckoutError.generic }

        let decoded = try? JSONDecoder().decode(CheckoutResponse.self, from: data)

        if http.statusCode == 409, decoded?.code == "quote-expired" { throw QuoteExpired() }

        guard (200..<300).contains(http.statusCode) else {
            /*
             * The Function's own words, not a status code. Every refusal in
             * this codebase answers with copy written to be read — "A valid
             * email address is needed for the receipt" is of more use than
             * "400", and it is the sentence the buyer sees.
             */
            throw CheckoutError(decoded?.error ?? "The payment could not be completed.")
        }

        guard let orderId = decoded?.orderId else { throw CheckoutError.generic }
        return orderId
    }
}

/* ── PassKit ──────────────────────────────────────────────────────────────── */

/// The three callbacks, each of which does as little as possible.
///
/// Every one is `nonisolated` because PassKit calls the delegate off the main
/// actor, and every one immediately awaits a `@MainActor` method on this class.
/// That hop is the whole pattern: the isolated methods below can touch `model`
/// and `outcome` directly, and nothing in this extension has to reason about
/// which thread it is on.
extension Checkout: PKPaymentAuthorizationControllerDelegate {
    nonisolated func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didSelectShippingContact contact: PKContact
    ) async -> PKPaymentRequestShippingContactUpdate {
        await reprice(for: contact)
    }

    nonisolated func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didSelectShippingMethod shippingMethod: PKShippingMethod
    ) async -> PKPaymentRequestShippingMethodUpdate {
        await choose(shippingMethod)
    }

    nonisolated func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didAuthorizePayment payment: PKPayment
    ) async -> PKPaymentAuthorizationResult {
        await settle(payment)
    }

    nonisolated func paymentAuthorizationControllerDidFinish(
        _ controller: PKPaymentAuthorizationController
    ) {
        controller.dismiss {
            Task { @MainActor in self.close() }
        }
    }
}

extension Checkout {
    /// Collect or post, chosen in the sheet, with the total recomputed.
    ///
    /// The returned update replaces every summary item, which is how the
    /// sheet's arithmetic stays this screen's: `shipping` moves first, then the
    /// items are rebuilt from it, so the figure being authorised is the figure
    /// showing behind the sheet.
    fileprivate func choose(_ method: PKShippingMethod) -> PKPaymentRequestShippingMethodUpdate {
        apply(method)
        return PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: summaryItems())
    }

    /// A row of the sheet, as the model's two fields.
    private func apply(_ method: PKShippingMethod) {
        let id = method.identifier ?? Checkout.collectId
        model.shipping = id != Checkout.collectId
        model.chosenOption = model.deliveryOptions.first { Checkout.uspsPrefix + $0.service == id }
    }

    /// A contact chosen in the sheet, which is an address to price postage to.
    ///
    /// Called when the sheet opens with the wallet's default contact and again
    /// whenever the buyer picks another. The contact is redacted — Apple gives
    /// the city, the state and the ZIP until the payment is authorised — and
    /// the ZIP is all the quote wants.
    ///
    /// Every failure here is the flat row rather than an error in the sheet,
    /// which is the website's rule too: "could not quote" is the flat charge,
    /// and a buyer must always be able to pay that.
    fileprivate func reprice(for contact: PKContact) async -> PKPaymentRequestShippingContactUpdate {
        let held = model.chosenOption
        var options: [DeliveryOption] = []

        let country = contact.postalAddress?.isoCountryCode.uppercased() ?? ""
        if model.settings.liveShipping,
           country.isEmpty || country == "US",
           let zip = usableZip(contact.postalAddress?.postalCode),
           let answer = try? await quote(zip: zip) {
            options = answer.options.sorted { $0.cents < $1.cents }
            if (0...ShopSettings.maxDeliveryCents).contains(answer.fallbackCents) {
                model.flatDeliveryCents = answer.fallbackCents
            }
        }

        model.deliveryOptions = options
        // The service the buyer had, if this address still has it; otherwise
        // the cheapest, as the website preselects. Only read while posting.
        model.chosenOption = options.first { $0.service == held?.service } ?? options.first

        return PKPaymentRequestShippingContactUpdate(
            errors: nil,
            paymentSummaryItems: summaryItems(),
            shippingMethods: shippingMethods()
        )
    }

    fileprivate func settle(_ payment: PKPayment) async -> PKPaymentAuthorizationResult {
        contact = payment.shippingContact

        /*
         * The sheet's own record of the ticked row, over ours. They should
         * never differ — every change of row and of address came through
         * `choose` or `reprice` — but if one ever did, the order would go out
         * as the wrong fulfilment or the wrong postage. And if that makes the
         * basket's total differ from the one the buyer approved, nothing is
         * charged: the figure authorised must be the figure taken.
         */
        if let method = payment.shippingMethod { apply(method) }
        guard model.total == shownTotal else {
            let message = "The total changed while Apple Pay was open, so nothing was charged. Please try again."
            outcome = .failed(message)
            return PKPaymentAuthorizationResult(status: .failure, errors: [CheckoutError(message)])
        }

        do {
            let orderId = try await charge(payment)
            outcome = .paid(orderId: orderId)
            return PKPaymentAuthorizationResult(status: .success, errors: nil)
        } catch {
            /*
             * `.failure` leaves the buyer inside Apple's own sheet with another
             * card one tap away, rather than dropping them back here to start
             * again — the same reasoning `chargeWithCard` gives in
             * `payments/square.ts`. The sheet prints its own wording for the
             * failure; the Function's sentence is kept for the screen
             * underneath, which is where it can actually be read.
             */
            let message = (error as? CheckoutError)?.message ?? CheckoutError.generic.message
            outcome = .failed(message)
            return PKPaymentAuthorizationResult(status: .failure, errors: [CheckoutError(message)])
        }
    }

    fileprivate func close() {
        controller = nil
        busy = false
        // Nothing recorded means the sheet was closed without paying, which
        // needs no message of any kind.
        if outcome == nil { outcome = .cancelled }
        if case .paid = outcome { emptyBasket() }
    }

    /// Emptied only on success. A declined basket is one the buyer may well
    /// want to try again with a different card, and clearing it would be the
    /// app deciding they had changed their mind.
    private func emptyBasket() {
        model.quantities.removeAll()
    }
}

/* ── Plumbing ─────────────────────────────────────────────────────────────── */

private struct CheckoutResponse: Decodable {
    let orderId: String?
    let error: String?
    /// `quote-expired` is the one the clip acts on. See `requoteAndRetry`.
    let code: String?
}

/// `{ options, fallbackCents }` from `/api/shipping/quote`.
private struct QuoteResponse: Decodable {
    let options: [DeliveryOption]
    let fallbackCents: Int
}

/// The Function's 409 for a postage token it will not honour.
private struct QuoteExpired: Error {}

/// An error that carries a sentence written to be shown.
struct CheckoutError: LocalizedError {
    let message: String

    init(_ message: String) { self.message = message }

    static let generic = CheckoutError("The payment could not be completed.")

    var errorDescription: String? { message }
}
