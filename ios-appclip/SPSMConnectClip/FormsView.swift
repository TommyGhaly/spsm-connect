import PassKit
import SquareInAppPaymentsSDK
import SwiftUI

/// `/c/forms` — the form on the tag, filled in and sent from here.
///
/// The tag opens whichever form the office has chosen, which is
/// `config/forms.nfcFormSlug` and defaults to the vehicle registration — that is
/// what the tag by the car park has always opened. **Only that form.** It used
/// to list every parish form and send each one to the website; somebody who has
/// just tapped a tag by the car park wants the car park form, in front of them,
/// with nothing to choose.
///
/// ## Filled in here, sent from here
///
/// This used to hand every form to Safari, on the argument that porting the
/// form engine would be most of the clip's 15 MB. It is not: the engine is
/// text boxes and rules, a few kilobytes of Swift, and `FormModel.swift` is it.
/// `formSubmit` needs no sign-in and no App Check, so the clip posts exactly
/// what the website posts.
///
/// Two cases still go to the website, and say so rather than failing:
/// `embed`/`external` forms, which live with somebody else; and a form with a
/// **photo** field, which needs an upload this clip cannot authorise yet — see
/// `FormModel.swift`.
struct FormsView: View {
    @StateObject private var model = FormsScreenModel()
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .forms) {
            switch model.state {
            case .loading:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Opening the form…")
                    }
                }

            case .failed(let message):
                ClipProblem(message: message) { model.load() }

            case .closed(let form):
                ClipCard {
                    ClipEyebrow(text: "Closed")
                    ClipHeading(text: form.title)
                    ClipBody(text: form.closedMessage ?? "This form isn’t taking answers right now.")
                }

            case .elsewhere(let form, let url):
                ClipCard {
                    ClipHeading(text: form.title)
                    if !form.blurb.isEmpty { ClipBody(text: form.blurb) }
                    ClipBody(text: form.hasPhotoField
                             ? "This form asks for a photo, so it opens on the church’s website."
                             : "This form opens on the church’s website. Nothing here needs an account.")
                    ClipButton(label: "Open the form") { sheet = IdentifiableURL(url: url) }
                }

            case .filling(let form):
                FormBody(form: form, model: model)

            case .sent(let form):
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Sent")
                    ClipHeading(text: "Thank you!")
                    ClipBody(text: form.confirmationMessage)
                }
            }

            ClipFooter(
                destination: .forms,
                readMore: "Every form the church keeps is on its website, and none of them needs an account."
            )
        }
        .safari(url: $sheet)
        .task { model.loadIfNeeded() }
    }
}

/// The questions, the total, and the one button.
private struct FormBody: View {
    let form: ParishForm
    @ObservedObject var model: FormsScreenModel

    var body: some View {
        ClipCard(spacing: 12) {
            ClipHeading(text: form.title)
            if !form.blurb.isEmpty { ClipBody(text: form.blurb) }
            if !form.blurb.localizedCaseInsensitiveContains("no account") {
                Text("No account needed.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
            }
        }

        ClipCard(spacing: 18) {
            if form.kind == .vehicle {
                VehicleFields(input: $model.vehicle)
            } else {
                ForEach(FormRules.visible(form.fields, model.answers)) { field in
                    FieldInput(
                        field: field,
                        answer: Binding(
                            get: { model.answers[field.key] },
                            set: { model.answers[field.key] = $0 }
                        ),
                        problem: model.showProblems ? model.fieldProblems[field.key] : nil
                    )
                }
            }
        }

        ClipCard(spacing: 12) {
            if !model.messages.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(model.messages, id: \.self) { FieldProblem(text: $0) }
                }
            }

            let total = model.total
            if total > 0 {
                HStack {
                    Text("Total")
                        .font(Face.body.weight(.semibold))
                    Spacer()
                    Text(Money.text(total))
                        .font(Face.heading)
                }
                .foregroundStyle(Ink.ink)

                if model.canPay {
                    ApplePayButton(type: .continue) { model.send() }
                        .frame(height: 50)
                        .disabled(model.busy)
                        .opacity(model.busy ? 0.5 : 1)
                        .accessibilityLabel("Pay \(Money.text(total)) with Apple Pay and send")
                } else {
                    ClipBody(text: "This form takes a payment, and Apple Pay isn’t set up on this iPhone. You can fill it in on the church’s website instead.")
                }
            } else {
                ClipButton(label: form.kind == .vehicle ? "Register this car" : "Send", busy: model.busy) {
                    model.send()
                }
            }
        }
    }
}

@MainActor
final class FormsScreenModel: ObservableObject {
    enum State {
        case loading
        case failed(String)
        case closed(ParishForm)
        case elsewhere(ParishForm, URL)
        case filling(ParishForm)
        case sent(ParishForm)
    }

    @Published private(set) var state: State = .loading
    @Published var answers: FormAnswers = [:]
    @Published var vehicle = VehicleInput()
    /// Off until the first press, so an empty form is not a wall of red.
    @Published private(set) var showProblems = false
    /// Whole-form sentences: the server's refusals, or the vehicle checks.
    @Published private(set) var messages: [String] = []
    @Published private(set) var busy = false

    private var started = false
    private var payment: FormPaymentSheet?

    private var form: ParishForm? {
        if case .filling(let form) = state { return form }
        return nil
    }

    var fieldProblems: [String: String] {
        guard let form else { return [:] }
        return FormRules.problems(form, answers)
    }

    var total: Int {
        guard let form, form.kind == .native else { return 0 }
        return FormRules.totalCents(form, answers)
    }

    var canPay: Bool { Checkout.available }

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    func load() {
        state = .loading
        Task {
            do {
                let form = try await FormsAPI.taggedForm()
                if !form.open {
                    state = .closed(form)
                } else if form.kind == .embed || form.kind == .external || form.hasPhotoField {
                    let url = form.kind == .external
                        ? (form.externalUrl.flatMap(URL.init(string:)) ?? ClipConfig.page("/forms/\(form.slug)"))
                        : ClipConfig.page("/forms/\(form.slug)")
                    state = .elsewhere(form, url)
                } else {
                    state = .filling(form)
                }
            } catch {
                state = .failed("The form couldn’t be opened just now. Check you have signal or Wi-Fi, then try again.")
            }
        }
    }

    func send() {
        guard let form, !busy else { return }
        showProblems = true
        messages = []

        let answers: [String: Any]
        if form.kind == .vehicle {
            let found = vehicle.problems()
            guard found.isEmpty else { messages = found; return }
            answers = vehicle.answers()
        } else {
            let found = FormRules.problems(form, self.answers)
            guard found.isEmpty else {
                messages = ["Please fix the \(found.count == 1 ? "answer" : "answers") marked above."]
                return
            }
            answers = form.payload(self.answers)
        }

        let total = total
        if total > 0 {
            let sheet = FormPaymentSheet(form: form, totalCents: total, answers: answers) { [weak self] outcome in
                self?.finish(outcome, form: form)
            }
            payment = sheet
            busy = true
            sheet.present()
            return
        }

        busy = true
        Task {
            finish(await FormsAPI.submit(slug: form.slug, answers: answers, cardToken: nil), form: form)
        }
    }

    private func finish(_ outcome: FormsAPI.Outcome?, form: ParishForm) {
        busy = false
        payment = nil
        switch outcome {
        case .sent:
            state = .sent(form)
        case .paidNotRecorded(let message):
            // Not a success screen and not a retry button: the money moved, and
            // the one wrong thing to invite is a second payment.
            messages = [message]
            state = .closed(ParishForm(
                slug: form.slug, title: form.title, blurb: "", published: true, open: false,
                closedMessage: message, kind: form.kind, externalUrl: nil, fields: [],
                paymentEnabled: false, baseCents: 0, paymentLabel: "",
                confirmationMessage: form.confirmationMessage
            ))
        case .refused(let errors):
            messages = errors
        case nil:
            // The sheet was closed without paying. Nothing to say.
            break
        }
    }
}

/// Apple Pay for a paid form: one line, the total, a nonce, the submit.
///
/// Smaller than the bookstore's `Checkout` because a form asks for no address
/// and has no postage. The email comes from the wallet so the Square receipt
/// has somewhere to go; nothing else does. The total in the sheet is the
/// clip's `computeTotalCents`; the Function prices the form again from the
/// stored definition and charges its own figure, so a stale screen can show
/// the wrong number but never charge it.
final class FormPaymentSheet: NSObject, PKPaymentAuthorizationControllerDelegate {
    private let form: ParishForm
    private let totalCents: Int
    private let answers: [String: Any]
    private let done: @MainActor (FormsAPI.Outcome?) -> Void
    private var controller: PKPaymentAuthorizationController?
    private var outcome: FormsAPI.Outcome?

    init(form: ParishForm, totalCents: Int, answers: [String: Any], done: @escaping @MainActor (FormsAPI.Outcome?) -> Void) {
        self.form = form
        self.totalCents = totalCents
        self.answers = answers
        self.done = done
    }

    func present() {
        let request = PKPaymentRequest.squarePaymentRequest(
            merchantIdentifier: ClipConfig.applePayMerchantId,
            countryCode: "US",
            currencyCode: "USD"
        )
        request.requiredShippingContactFields = [.emailAddress]
        let amount = NSDecimalNumber(mantissa: UInt64(totalCents), exponent: -2, isNegative: false)
        request.paymentSummaryItems = [
            PKPaymentSummaryItem(label: form.paymentLabel.isEmpty ? form.title : form.paymentLabel, amount: amount),
            PKPaymentSummaryItem(label: "St. Philopater & St. Mina", amount: amount),
        ]

        let controller = PKPaymentAuthorizationController(paymentRequest: request)
        controller.delegate = self
        self.controller = controller
        controller.present { presented in
            if !presented {
                Task { @MainActor in self.done(.refused(["Apple Pay couldn’t be opened on this iPhone."])) }
            }
        }
    }

    func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didAuthorizePayment payment: PKPayment
    ) async -> PKPaymentAuthorizationResult {
        let nonce: String? = await withCheckedContinuation { continuation in
            SQIPApplePayNonceRequest(payment: payment).perform { details, _ in
                continuation.resume(returning: details?.nonce)
            }
        }
        guard let nonce else {
            outcome = .refused(["Apple Pay couldn’t take that card. Nothing was charged."])
            return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }

        let result = await FormsAPI.submit(slug: form.slug, answers: answers, cardToken: nonce)
        outcome = result
        switch result {
        case .sent, .paidNotRecorded: return PKPaymentAuthorizationResult(status: .success, errors: nil)
        case .refused: return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }
    }

    func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
        controller.dismiss {
            let outcome = self.outcome
            Task { @MainActor in self.done(outcome) }
        }
    }
}
