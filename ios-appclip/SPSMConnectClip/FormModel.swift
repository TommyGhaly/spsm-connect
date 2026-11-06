import Foundation

/// A parish form, its answers, and the rules over both — in Swift.
///
/// ---------------------------------------------------------------------------
/// ## A copy of `@spsm/shared`, and which parts of it
///
/// The definitions, the visibility rule, the running total and the field
/// checks are ports of `schema/forms.ts`; the vehicle checks are
/// `schema/taksis.ts`. Each function below names the one it copies, and that
/// name is the thing to grep for when the TypeScript changes.
///
/// **None of this is the guarantee.** `formSubmit` loads the stored definition
/// and runs the TypeScript originals again over whatever arrives, prices the
/// form itself, and answers with the reasons it refused. What the clip's copy
/// buys is the person hearing "Phone is required" before pressing send rather
/// than after — so if the two ever disagree, the server wins and the clip shows
/// what the server said.
///
/// ## What the clip does not do
///
/// Photo fields. A form photograph is uploaded before submit, to a URL that
/// `/api/forms/upload-url` mints only for an App Check token, and the clip has
/// none until `AppAttest.clipAppId` exists. A form with a photo field is sent
/// to the website rather than half-filled here — see `FormsView`.
/// ---------------------------------------------------------------------------

enum FieldType: String {
    case shortText, longText, email, phone, number, date, select, radio, checkboxes, photo, consent, heading

    var isChoice: Bool { self == .select || self == .radio || self == .checkboxes }
    var isDecorative: Bool { self == .heading }
}

struct FormOption: Hashable {
    let value: String
    let label: String
    let priceCents: Int
}

struct FieldCondition {
    enum Test: String { case equals, includes, filled }
    let field: String
    let test: Test
    let value: String
}

struct FormField: Identifiable {
    let key: String
    let type: FieldType
    let label: String
    let help: String?
    let placeholder: String?
    let required: Bool
    let options: [FormOption]
    let showWhen: FieldCondition?
    let unitPriceCents: Int
    let min: Double?
    let max: Double?

    var id: String { key }
}

enum FormKind: String {
    case native, embed, external, vehicle
}

struct ParishForm {
    let slug: String
    let title: String
    let blurb: String
    let published: Bool
    let open: Bool
    let closedMessage: String?
    let kind: FormKind
    let externalUrl: String?
    let fields: [FormField]
    let paymentEnabled: Bool
    let baseCents: Int
    let paymentLabel: String
    let confirmationMessage: String

    var hasPhotoField: Bool { fields.contains { $0.type == .photo } }

    /// The car park registration, for when the stored form cannot be read.
    ///
    /// `vehicleRegistrationForm()` in `schema/builtInForms.ts`: the tag in the
    /// car park is printed, so a failed read must still give it a form.
    static let builtInVehicle = ParishForm(
        slug: "vehicle-registration",
        title: "Register a vehicle",
        blurb: "So the parking team can reach you if your car needs moving. Visitors and guests are welcome to register too — no account needed.",
        published: true,
        open: true,
        closedMessage: nil,
        kind: .vehicle,
        externalUrl: nil,
        fields: [],
        paymentEnabled: false,
        baseCents: 0,
        paymentLabel: "",
        confirmationMessage: "Your vehicle is registered and waiting to be approved. Once it has been, your license plate is recognised at the lot — there is no sticker to collect. Contact the church office with any questions."
    )
}

/// One answer: `FormAnswer` in `schema/forms.ts`, which is a string, a number,
/// a boolean or a list of strings, and nothing else.
enum FormAnswer: Equatable {
    case text(String)
    case number(Double)
    case flag(Bool)
    case list([String])

    var isBlank: Bool {
        switch self {
        case .text(let value): return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .list(let values): return values.isEmpty
        case .flag(let value): return !value
        case .number: return false
        }
    }

    /// `String(answer)` in TypeScript, which is what a condition compares.
    var asText: String {
        switch self {
        case .text(let value): return value
        case .number(let value): return value == value.rounded() ? String(Int(value)) : String(value)
        case .flag(let value): return value ? "true" : "false"
        case .list(let values): return values.joined(separator: ",")
        }
    }

    var json: Any {
        switch self {
        case .text(let value): return value
        case .number(let value): return value == value.rounded() ? Int(value) as Any : value
        case .flag(let value): return value
        case .list(let values): return values
        }
    }
}

typealias FormAnswers = [String: FormAnswer]

enum FormRules {
    /// `MAX_ANSWER_LENGTH`, `MAX_SELECTIONS`, `MAX_FORM_QUANTITY`.
    static let maxAnswerLength = 4000
    static let maxSelections = 40
    static let maxQuantity = 999

    /// `isFieldVisible`.
    static func isVisible(_ field: FormField, _ answers: FormAnswers) -> Bool {
        guard let condition = field.showWhen else { return true }
        let other = answers[condition.field]
        switch condition.test {
        case .filled: return !(other?.isBlank ?? true)
        case .includes:
            if case .list(let values) = other { return values.contains(condition.value) }
            return false
        case .equals: return (other?.asText ?? "") == condition.value
        }
    }

    /// `visibleFields`: a field hidden because the one it depends on is hidden
    /// stays hidden, which is why the answers are replayed in order.
    static func visible(_ fields: [FormField], _ answers: FormAnswers) -> [FormField] {
        var live: FormAnswers = [:]
        var shown: [FormField] = []
        for field in fields {
            guard isVisible(field, live) else { continue }
            shown.append(field)
            if let answer = answers[field.key] { live[field.key] = answer }
        }
        return shown
    }

    /// `submissionAnswers`: visible, not decorative, not blank.
    static func submission(_ fields: [FormField], _ answers: FormAnswers) -> FormAnswers {
        var result: FormAnswers = [:]
        for field in visible(fields, answers) where !field.type.isDecorative {
            if let answer = answers[field.key], !answer.isBlank { result[field.key] = answer }
        }
        return result
    }

    /// `computeTotalCents` — for the figure on screen and in the Apple Pay
    /// sheet. The Function computes it again and charges its own answer.
    static func totalCents(_ form: ParishForm, _ answers: FormAnswers) -> Int {
        guard form.paymentEnabled else { return 0 }
        var total = form.baseCents
        let live = submission(form.fields, answers)

        for field in form.fields {
            guard let answer = live[field.key] else { continue }
            if field.type == .number && field.unitPriceCents > 0 {
                let quantity: Double
                if case .number(let value) = answer { quantity = value } else { quantity = Double(answer.asText) ?? 0 }
                guard quantity.isFinite, quantity > 0 else { continue }
                total += field.unitPriceCents * min(Int(quantity.rounded(.down)), maxQuantity)
                continue
            }
            guard field.type.isChoice else { continue }
            let chosen: [String]
            if case .list(let values) = answer { chosen = values } else { chosen = [answer.asText] }
            for value in chosen {
                if let option = field.options.first(where: { $0.value == value }) { total += option.priceCents }
            }
        }
        return total
    }

    /// `validateSubmissionFields`, keyed by field so each problem can sit under
    /// its own box.
    static func problems(_ form: ParishForm, _ answers: FormAnswers) -> [String: String] {
        var found: [String: String] = [:]

        for field in visible(form.fields, answers) where !field.type.isDecorative {
            let answer = answers[field.key]
            let blank = answer?.isBlank ?? true

            if field.required && blank {
                found[field.key] = field.type == .consent
                    ? "Please agree to “\(field.label)”."
                    : "\(field.label) is required."
                continue
            }
            guard let answer, !blank else { continue }

            let text = answer.asText
            if text.count > maxAnswerLength {
                found[field.key] = "\(field.label) is too long."
                continue
            }

            switch field.type {
            case .email:
                if text.trimmingCharacters(in: .whitespaces).range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) == nil {
                    found[field.key] = "\(field.label) is not an email address."
                }
            case .phone:
                let digits = text.filter(\.isNumber).count
                if digits < 10 || digits > 11 { found[field.key] = "\(field.label) is not a phone number." }
            case .date:
                if text.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) == nil {
                    found[field.key] = "\(field.label) is not a date."
                }
            case .number:
                let value: Double? = { if case .number(let v) = answer { return v }; return Double(text) }()
                if let value, value.isFinite {
                    if let min = field.min, value < min {
                        found[field.key] = "\(field.label) must be \(format(min)) or more."
                    } else if let max = field.max, value > max {
                        found[field.key] = "\(field.label) must be \(format(max)) or less."
                    }
                } else {
                    found[field.key] = "\(field.label) must be a number."
                }
            case .select, .radio:
                if !field.options.contains(where: { $0.value == text }) {
                    found[field.key] = "Choose one of the options for \(field.label)."
                }
            case .checkboxes:
                if case .list(let values) = answer {
                    if values.count > maxSelections {
                        found[field.key] = "Too many options chosen for \(field.label)."
                    } else if values.contains(where: { value in !field.options.contains { $0.value == value } }) {
                        found[field.key] = "Choose from the options for \(field.label)."
                    }
                }
            default:
                break
            }
        }
        return found
    }

    private static func format(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}

/* ── The vehicle registration ────────────────────────────────────────────── */

/// `TaksisDriver`, in Taksis's own field names.
struct VehicleDriver: Equatable, Identifiable {
    /// The row's identity on screen only; never sent.
    let id = UUID()
    var name = ""
    var phone = ""
    var hasTaksis = false
}

struct VehicleInput: Equatable {
    var plate = ""
    var make = ""
    var model = ""
    var color = ""
    var drivers = [VehicleDriver()]

    /// `TAKSIS_COLORS`, in Taksis's order. Anything else will not match at the
    /// lot, which is why it is a fixed list rather than a text box.
    static let colors: [(label: String, value: String, hex: UInt32)] = [
        ("White", "white", 0xFFFFFF),
        ("Black", "black", 0x1A1A1A),
        ("Silver", "silver", 0xC0C0C0),
        ("Gray", "gray", 0x808080),
        ("Red", "red", 0xD32F2F),
        ("Blue", "blue", 0x1976D2),
        ("Green", "green", 0x388E3C),
        ("Brown", "brown", 0x795548),
        ("Beige", "beige", 0xD4C5A9),
        ("Orange", "orange", 0xF57C00),
        ("Yellow", "yellow", 0xFBC02D),
        ("Gold", "gold", 0xFFD700),
    ]

    /// `MAX_DRIVERS`.
    static let maxDrivers = 5

    /// `validateVehicleRegistration`, message for message.
    func problems() -> [String] {
        var errors: [String] = []
        let cleanPlate = plate.trimmingCharacters(in: .whitespaces).uppercased()
        if cleanPlate.count < 2 { errors.append("Enter a license plate.") }
        if cleanPlate.count > 12 { errors.append("That plate looks too long — please check it.") }
        if !color.isEmpty && !Self.colors.contains(where: { $0.value == color }) {
            errors.append("Choose a color from the list.")
        }

        let first = drivers.first
        let firstName = first?.name.trimmingCharacters(in: .whitespaces) ?? ""
        if firstName.isEmpty {
            errors.append("Enter the name of the main driver.")
        } else if firstName.split(whereSeparator: \.isWhitespace).count < 2 {
            errors.append("Enter the main driver’s first and last name.")
        }
        if (first?.phone.trimmingCharacters(in: .whitespaces) ?? "").isEmpty {
            errors.append("Enter a phone number for the main driver.")
        }
        if drivers.count > Self.maxDrivers { errors.append("Up to \(Self.maxDrivers) drivers can be listed.") }
        for (index, driver) in drivers.enumerated().dropFirst() {
            if !driver.name.trimmingCharacters(in: .whitespaces).isEmpty
                && driver.phone.trimmingCharacters(in: .whitespaces).isEmpty {
                errors.append("Enter a phone number for driver \(index + 1), or clear their name.")
            }
        }
        return errors
    }

    /// The answers `VehicleForm.tsx` sends. `drivers` is a JSON **string**,
    /// exactly as the website sends it: the Function parses that one field by
    /// name, and a repeating record is not a shape `FormAnswer` has.
    func answers() -> [String: Any] {
        let list = drivers.map { ["name": $0.name, "phone": $0.phone, "has_taksis": $0.hasTaksis] as [String: Any] }
        let encoded = (try? JSONSerialization.data(withJSONObject: list)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        return ["plate": plate, "make": make, "model": model, "color": color, "drivers": encoded]
    }
}

/* ── Reading and sending ─────────────────────────────────────────────────── */

enum FormsAPI {
    /// `DEFAULT_FORMS_PAGE_CONFIG.nfcFormSlug`.
    static let defaultSlug = "vehicle-registration"

    /// The tag names a form that is unpublished or gone. Nothing the person
    /// holding the phone can fix, and pressing again will not help.
    struct NotPublic: Error {}

    /*
     * The two forms that are not in the `forms` collection and never will be:
     * each is a screen of its own at `/forms/<slug>` on the website and in the
     * app (`ORDINATION_FORM_SLUG` and `CAMP_FORM_SLUG` in `schema/config.ts`),
     * and in the clip — `OrdinationView.swift` and `CampSignUpView.swift`.
     * Reading `forms/ordination` is refused because there is no such document,
     * so either on the tag is recognised by slug before any read. Thrown rather
     * than returned because the answer is not a `ParishForm`; not failures.
     */
    struct OrdinationTagged: Error {}
    struct CampTagged: Error {}

    /// The form the office has put on the tag, and only that one.
    ///
    /// A single-document read, which the `forms` rule allows for a published
    /// form — the list the screen used to make was refused, because a list
    /// must state `published == true` to be allowed at all. The document id is
    /// usually the slug; when it is not (a slug renamed in the builder), the
    /// filtered query finds it.
    static func taggedForm() async throws -> ParishForm {
        var slug = defaultSlug
        if let config = try? await FirestoreREST.document("config/forms"),
           let chosen = config["nfcFormSlug"]?.stringValue, !chosen.isEmpty {
            slug = chosen
        }
        #if DEBUG
            /*
             * Try any form on the tag without changing the live setting:
             * `SIMCTL_CHILD_SPSM_TAG_FORM=summer-camp xcrun simctl launch …`.
             * Debug builds only, like `_XCAppClipURL`.
             */
            if let override = ProcessInfo.processInfo.environment["SPSM_TAG_FORM"], !override.isEmpty {
                slug = override
            }
        #endif
        if slug == "ordination" { throw OrdinationTagged() }
        if slug == "summer-camp" { throw CampTagged() }

        /*
         * Refused is not fatal yet: the id may not be the slug, and the query
         * below states `published == true`, which the rules always allow. It
         * is when the query finds nothing either that the tag is pointing at a
         * form the public cannot see.
         */
        var fields: [String: FirestoreValue]
        do {
            fields = try await FirestoreREST.document("forms/\(slug)")
        } catch is FirestoreREST.Refused {
            fields = [:]
        }
        if fields.isEmpty {
            let found = try await FirestoreREST.query(
                "forms",
                matching: [("slug", .string(slug)), ("published", .bool(true))]
            )
            fields = found.first?.fields ?? [:]
        }

        if fields.isEmpty {
            if slug == defaultSlug { return .builtInVehicle }
            throw NotPublic()
        }
        return parse(id: slug, fields)
    }

    /// `parseFormDefinition`, with its defaults.
    static func parse(id: String, _ record: [String: FirestoreValue]) -> ParishForm {
        let fields = (record["fields"]?.arrayValue ?? []).compactMap { $0.mapValue.flatMap(parseField) }.prefix(60)
        let payment = record["payment"]?.mapValue ?? [:]
        let kind = FormKind(rawValue: record["kind"]?.stringValue ?? "") ?? .native
        let confirmation = (record["confirmationMessage"]?.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        return ParishForm(
            slug: nonEmpty(record["slug"]) ?? id,
            title: nonEmpty(record["title"]) ?? "Untitled form",
            blurb: nonEmpty(record["blurb"]) ?? "",
            published: record["published"]?.boolValue ?? false,
            // Absent means open — a form that has never been closed has no field.
            open: record["open"]?.boolValue ?? true,
            closedMessage: nonEmpty(record["closedMessage"]),
            kind: kind,
            externalUrl: nonEmpty(record["externalUrl"]),
            fields: Array(fields),
            paymentEnabled: payment["enabled"]?.boolValue ?? false,
            baseCents: cents(payment["baseCents"]),
            paymentLabel: nonEmpty(payment["label"]) ?? "",
            confirmationMessage: confirmation.isEmpty
                ? "Thank you — the church office has your submission."
                : confirmation
        )
    }

    private static func parseField(_ record: [String: FirestoreValue]) -> FormField? {
        guard let key = nonEmpty(record["key"]),
              let type = FieldType(rawValue: record["type"]?.stringValue ?? "")
        else { return nil }

        let options: [FormOption] = type.isChoice
            ? (record["options"]?.arrayValue ?? []).compactMap { raw in
                guard let option = raw.mapValue, let value = nonEmpty(option["value"]) else { return nil }
                return FormOption(value: value, label: nonEmpty(option["label"]) ?? value, priceCents: cents(option["priceCents"]))
            }
            : []

        let condition: FieldCondition? = record["showWhen"]?.mapValue.flatMap { raw in
            guard let field = nonEmpty(raw["field"]) else { return nil }
            return FieldCondition(
                field: field,
                test: FieldCondition.Test(rawValue: raw["test"]?.stringValue ?? "") ?? .equals,
                value: raw["value"]?.stringValue ?? ""
            )
        }

        return FormField(
            key: key,
            type: type,
            label: nonEmpty(record["label"]) ?? key,
            help: nonEmpty(record["help"]),
            placeholder: nonEmpty(record["placeholder"]),
            required: !type.isDecorative && (record["required"]?.boolValue ?? false),
            options: Array(options.prefix(FormRules.maxSelections)),
            showWhen: condition,
            unitPriceCents: type == .number ? cents(record["unitPriceCents"]) : 0,
            min: record["min"]?.numberValue,
            max: record["max"]?.numberValue
        )
    }

    private static func nonEmpty(_ value: FirestoreValue?) -> String? {
        guard let text = value?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
    }

    /// `cents`: an integer between 0 and `MAX_PRICE_CENTS`.
    private static func cents(_ value: FirestoreValue?) -> Int {
        Swift.min(Swift.max(Int((value?.numberValue ?? 0).rounded()), 0), 500_00)
    }

    /// What `formSubmit` said.
    enum Outcome {
        case sent
        /// Charged, but the church's record did not save. The person must be
        /// told not to pay again — `PAID BUT NOT RECORDED` in `submit.ts`.
        case paidNotRecorded(String)
        case refused([String])
    }

    /// `submitForm()` in `src/forms/data.ts`: the same body, the same endpoint.
    /// No sign-in and no App Check header — the Function asks for neither and
    /// rate-limits by address, exactly as it does for the website's visitors.
    static func submit(slug: String, answers: [String: Any], cardToken: String?) async -> Outcome {
        var request = URLRequest(url: ClipConfig.api("/api/forms/submit"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["slug": slug, "answers": answers]
        if let cardToken { body["cardToken"] = cardToken }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .refused(["The church couldn’t be reached. Check you have signal or Wi-Fi, then try again."])
        }

        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let errors = (json?["errors"] as? [String]) ?? []
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if (200..<300).contains(status) {
            if !errors.isEmpty, json?["paymentId"] is String { return .paidNotRecorded(errors.joined(separator: " ")) }
            return .sent
        }
        return .refused(errors.isEmpty ? ["That didn’t send. Please try again in a minute."] : errors)
    }
}

extension ParishForm {
    /// The answers in the shape the Function reads: visible, non-blank, and as
    /// JSON values — `submissionAnswers` before it leaves the phone.
    func payload(_ answers: FormAnswers) -> [String: Any] {
        FormRules.submission(fields, answers).mapValues(\.json)
    }
}
