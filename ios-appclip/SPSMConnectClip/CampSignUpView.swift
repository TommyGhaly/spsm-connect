import PassKit
import SquareInAppPaymentsSDK
import SwiftUI

/// The camp's servant sign-up, filled in and sent from the clip.
///
/// ---------------------------------------------------------------------------
/// The app's `src/camp/ServantSignUp.tsx` (with `DayGrid.tsx` and
/// `WeekRoles.tsx`), which is the website's, in SwiftUI and with the same
/// words. It is what `/c/forms` shows when the office has put `summer-camp` on
/// the tag. Not a stored form — a week/day grid, roles by week and by half of
/// the camp, an age-dependent waiver and one flat charge — so it is a screen of
/// its own here as it is everywhere else.
///
/// Like the app: no sign-in, nothing to read back, and the Function writes a
/// *request* an administrator accepts. The rules are `validateServantSignUp`
/// in `@spsm/shared`'s `schema/camp.ts`, ported line for line. The Function
/// sets the season and the charge from `config/camp` itself, so the body
/// carries only what the person said.
///
/// When the camp charges its servants, the answers travel *with* the Apple Pay
/// token in one request, as on a paid form: a declined card sends nothing.
/// ---------------------------------------------------------------------------
struct CampSignUpForm: View {
    @StateObject private var model = CampSignUpModel()

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Opening the form…")
                    }
                }

            case .closed:
                ClipCard {
                    ClipHeading(text: "Sign-ups are closed")
                    ClipBody(text: "The camp is not taking servant sign-ups at the moment. Speak to the church office if you would like to help.")
                }

            case .sent:
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Sent")
                    ClipHeading(text: "Thank you")
                    ClipBody(text: "Your sign-up has gone to the people running the camp. They will be in touch — you are not on the roster until they have said so.")
                    Text("Nothing you sent can be read back from here. If something was wrong, send another one and say so, or ring the church office.")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                }

            case .ready(let config):
                CampBody(config: config, model: model)
            }
        }
        .task { model.loadIfNeeded() }
    }
}

/* ── The form ────────────────────────────────────────────────────────────── */

private struct CampBody: View {
    let config: CampConfig
    @ObservedObject var model: CampSignUpModel

    var body: some View {
        let draft = model.draft
        let age = Camp.age(draft.dateOfBirth)
        let needsGuardian = !draft.dateOfBirth.isEmpty && Camp.needsGuardian(draft.dateOfBirth)
        let charge = config.servantChargeCents
        let chargeLabel = config.chargeLabel

        ClipCard(spacing: 16) {
            AsyncImage(url: ClipConfig.page("/img/stock-camp-1000.webp")) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Ink.paperSunken
            }
            .frame(height: 140)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .accessibilityHidden(true)

            ClipHeading(text: "Serve at summer camp \(config.season)")
            if !config.note.isEmpty { ClipBody(text: config.note) }
            ClipBody(text: "Tell the camp who you are and which days you can be there. Somebody will be in touch — this is a sign-up, not a place on the roster.")
            if charge > 0 {
                ClipBody(text: "There is a \(Money.text(charge)) charge for your \(chargeLabel.lowercased()), paid at the end of this form. It is the same whether you serve one week or both.")
            }

            /* About you */
            section("About you")
            labelled("Your name") {
                TextField("", text: $model.draft.name)
                    .textFieldStyle(BoxStyle())
                    .textContentType(.name)
                    .textInputAutocapitalization(.words)
            }
            labelled("Phone", required: false) {
                TextField("", text: $model.draft.phone)
                    .textFieldStyle(BoxStyle())
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
            }
            labelled("Email", required: false) {
                TextField("", text: $model.draft.email)
                    .textFieldStyle(BoxStyle())
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            hint("A phone number or an email address — one of the two, so the camp can reach you.")
            labelled("Date of birth") {
                CampBirthday(day: $model.draft.dateOfBirth)
                hint(age.map { "\($0) years old" } ?? "The camp places under-18s differently.")
            }
            labelled("Male or female") {
                HStack(spacing: 8) {
                    ForEach(Camp.genders, id: \.value) { gender in
                        Choice(label: gender.label, chosen: draft.gender == gender.value, radio: true) {
                            model.draft.gender = gender.value
                        }
                    }
                }
                hint("The camp splits its groups by it, so it needs to know before it can place you.")
            }
            labelled("Shirt size") {
                Menu {
                    Picker("Shirt size", selection: $model.draft.shirtSize) {
                        ForEach(Camp.shirtSizes, id: \.self) { Text(Camp.shirtLabel($0)).tag($0) }
                    }
                } label: {
                    HStack {
                        Text(Camp.shirtLabel(draft.shirtSize)).foregroundStyle(Ink.ink)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down").foregroundStyle(Ink.inkFaint)
                    }
                    .font(Face.body)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 48)
                    .background(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Ink.rule, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }

            /* Emergency contact */
            section("Emergency contact")
            labelled("Contact name") {
                TextField("", text: $model.draft.emergencyName)
                    .textFieldStyle(BoxStyle())
                    .textInputAutocapitalization(.words)
            }
            labelled("Contact phone") {
                TextField("", text: $model.draft.emergencyPhone)
                    .textFieldStyle(BoxStyle())
                    .keyboardType(.phonePad)
            }
            labelled("Relationship to you", required: false) {
                TextField("Mother, father, friend", text: $model.draft.emergencyRelationship).textFieldStyle(BoxStyle())
            }

            /* Sections */
            section("Where you would like to be")
            VStack(spacing: 8) {
                ForEach(Camp.sections, id: \.self) { section in
                    Choice(
                        label: Camp.sectionLabel(section),
                        detail: Camp.sectionGrades(section),
                        chosen: draft.sections.contains(section),
                        radio: false
                    ) { model.toggleSection(section) }
                }
            }
            hint("Tick both if you do not mind — the two halves run different things, so you will be asked about each.")

            /* Days */
            section("Which weeks you are coming")
            hint("Tick a week and you have the whole of it; untick any day you cannot make.")
            if config.weeks < 1 {
                ClipBody(text: "The camp has not published its weeks. Ring the church office to say you would like to serve.")
            }
            ForEach(1...max(1, config.weeks), id: \.self) { week in
                WeekDays(config: config, week: week, days: $model.draft.days)
            }

            /* Roles */
            section("What you would like to do")
            hint("Tap as many as you like. The camp decides in the end, but it does read this.")
            RoleChooser(config: config, model: model)
            labelled("Anything about your times", required: false) {
                TextField("Mornings only in the second week. I can drive.", text: $model.draft.availability, axis: .vertical)
                    .lineLimit(3...8)
                    .textFieldStyle(BoxStyle())
            }

            /* Waiver */
            if config.waiverInForce {
                section("Before you send this")
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(config.waiverParagraphs.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph)
                            .font(Face.small)
                            .foregroundStyle(Ink.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(12)
                .background(Ink.paperSunken)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                // The version is stamped when the box is ticked, so a waiver
                // edited afterwards is not retroactively what was agreed to.
                Toggle(isOn: Binding(
                    get: { model.draft.waiverAgreed },
                    set: { model.draft.waiverAgreed = $0; model.draft.waiverVersion = $0 ? config.waiverVersion : "" }
                )) {
                    Text(needsGuardian
                         ? "I am this servant’s parent or guardian, I have read this and I agree to it."
                         : "I have read this and agree to it.")
                        .font(Face.body)
                        .foregroundStyle(Ink.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .toggleStyle(CheckStyle())

                labelled(needsGuardian ? "Parent or guardian’s name" : "Type your name to sign") {
                    TextField("", text: $model.draft.signedName)
                        .textFieldStyle(BoxStyle())
                        .textInputAutocapitalization(.words)
                    if needsGuardian {
                        hint("You are under 18, so a parent or guardian signs this — their name, not yours.")
                    }
                }
                if needsGuardian {
                    labelled("How they are related to you") {
                        TextField("Mother, father, guardian", text: $model.draft.signedRelationship).textFieldStyle(BoxStyle())
                    }
                }
            }

            if !model.errors.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(model.errors, id: \.self) { FieldProblem(text: $0) }
                }
            }

            /* Send */
            if charge > 0 {
                section("Payment")
                HStack {
                    Text(chargeLabel).font(Face.body).foregroundStyle(Ink.inkSoft)
                    Spacer()
                    Text(Money.text(charge)).font(Face.heading).foregroundStyle(Ink.ink)
                }
                hint("Paid once, whether you serve one week or both.")
                if Checkout.available {
                    ApplePayButton(type: .continue) { model.payAndSend(config: config) }
                        .frame(height: 50)
                        .disabled(model.sending)
                        .opacity(model.sending ? 0.5 : 1)
                        .accessibilityLabel("Pay \(Money.text(charge)) with Apple Pay and send")
                } else {
                    ClipBody(text: "This sign-up takes a \(Money.text(charge)) payment, and Apple Pay isn’t set up on this iPhone. Get SPSM Connect below to pay by card.")
                }
                hint("Your answers are sent with the payment, in one step. If the card is declined, nothing is sent and nothing is charged. You will not be able to read this back or change it afterwards.")
            } else {
                ClipButton(label: model.sending ? "Sending…" : "Send my sign-up", busy: model.sending) {
                    model.send(config: config)
                }
                hint("You will not be able to read this back or change it — it goes straight to the people running the camp.")
            }
        }
    }

    private func section(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(Ink.rule).frame(height: 1)
            ClipEyebrow(text: text)
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(Face.small)
            .foregroundStyle(Ink.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func labelled<Content: View>(
        _ label: String,
        required: Bool = true,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            FieldLabel(text: label, required: required)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// One week of `DayGrid`: tick the week for all five days, untick a day.
private struct WeekDays: View {
    let config: CampConfig
    let week: Int
    @Binding var days: [String]

    var body: some View {
        let keys = Camp.weekKeys(week)
        let any = keys.contains { days.contains($0) }
        let all = keys.allSatisfy { days.contains($0) }
        let range = Camp.weekRange(config.weekStarts, week)

        VStack(alignment: .leading, spacing: 8) {
            Choice(label: range == "Week \(week)" ? "Week \(week)" : "Week \(week) — \(range)", chosen: any, radio: false) {
                if any { days.removeAll { keys.contains($0) } } else { days.append(contentsOf: keys.filter { !days.contains($0) }) }
            }
            if any {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                    ForEach(Camp.weekdays, id: \.self) { day in
                        let key = Camp.dayKey(week, day)
                        Choice(
                            label: Camp.weekdayLabel(day),
                            detail: Camp.dayOfMonth(config.weekStarts, key),
                            chosen: days.contains(key),
                            radio: false
                        ) {
                            if days.contains(key) { days.removeAll { $0 == key } } else { days.append(key) }
                        }
                    }
                }
                Text(all ? "The whole week. Untick any day you cannot make." : "Some of the week.")
                    .font(Face.label)
                    .foregroundStyle(Ink.inkFaint)
            }
        }
        .padding(12)
        .background(Ink.paperSunken)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/// `WeekRoles`: the weeks and halves chosen, or everything until they are.
private struct RoleChooser: View {
    let config: CampConfig
    @ObservedObject var model: CampSignUpModel

    var body: some View {
        let chosenSections = Camp.sections.filter { model.draft.sections.contains($0) }
        let chosenWeeks = Camp.weeksOf(model.draft.days)
        let sections = chosenSections.isEmpty ? Camp.sections : chosenSections
        let weeks = chosenWeeks.isEmpty ? Array(1...max(1, config.weeks)) : chosenWeeks

        VStack(alignment: .leading, spacing: 10) {
            if chosenSections.isEmpty || chosenWeeks.isEmpty {
                Text("Everything the camp runs, week by week. Tick a half of the camp and your weeks above and this narrows to yours.")
                    .font(Face.label)
                    .foregroundStyle(Ink.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(weeks, id: \.self) { week in
                let range = Camp.weekRange(config.weekStarts, week)
                VStack(alignment: .leading, spacing: 8) {
                    ClipEyebrow(text: range == "Week \(week)" ? "Week \(week)" : "Week \(week) — \(range)")
                    ForEach(sections, id: \.self) { section in
                        if sections.count > 1 {
                            Text(Camp.sectionLabel(section)).font(Face.label).foregroundStyle(Ink.inkSoft)
                        }
                        ForEach(config.roleOptions(week: week, section: section), id: \.self) { role in
                            Choice(label: role, chosen: model.hasRole(role, week: week, section: section), radio: false) {
                                model.toggleRole(role, week: week, section: section)
                            }
                        }
                    }
                }
                .padding(12)
                .background(Ink.paperSunken)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

/// A tick box or a radio button as a full-width row.
private struct Choice: View {
    let label: String
    var detail: String? = nil
    let chosen: Bool
    let radio: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: radio
                      ? (chosen ? "largecircle.fill.circle" : "circle")
                      : (chosen ? "checkmark.square.fill" : "square"))
                    .font(.title3)
                    .foregroundStyle(chosen ? Ink.accent : Ink.inkFaint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(Face.body).foregroundStyle(Ink.ink).multilineTextAlignment(.leading)
                    if let detail, !detail.isEmpty {
                        Text(detail).font(Face.label).foregroundStyle(Ink.inkSoft)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(chosen ? Ink.accentSoft : Ink.paperRaised)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(chosen ? Ink.accent : Ink.rule, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

/// A date of birth as `yyyy-MM-dd`, empty until chosen.
private struct CampBirthday: View {
    @Binding var day: String

    var body: some View {
        if let date = Camp.dayFormat.date(from: day) {
            HStack {
                DatePicker(
                    "Date of birth",
                    selection: Binding(get: { date }, set: { day = Camp.dayFormat.string(from: $0) }),
                    in: ...Date(),
                    displayedComponents: .date
                )
                .labelsHidden()
                Spacer()
                Button("Clear") { day = "" }
                    .font(Face.body)
                    .foregroundStyle(Ink.accent)
                    .frame(minHeight: 44)
            }
        } else {
            Button {
                // Opens on a teenager's birthday: half the camp's servants are.
                let start = Calendar(identifier: .gregorian).date(byAdding: .year, value: -16, to: Date()) ?? Date()
                day = Camp.dayFormat.string(from: start)
            } label: {
                HStack {
                    Image(systemName: "calendar")
                    Text("Choose a date")
                }
                .font(Face.body.weight(.semibold))
                .foregroundStyle(Ink.accent)
                .frame(maxWidth: .infinity, minHeight: 48)
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Ink.rule, lineWidth: 1))
            }
        }
    }
}

/* ── The shared rules, in Swift ──────────────────────────────────────────── */

/// The parts of `schema/camp.ts` and `schema/config.ts` the sign-up uses.
enum Camp {
    static let sections = ["elementary", "middle-school"]
    static let weekdays = ["mon", "tue", "wed", "thu", "fri"]
    static let genders: [(value: String, label: String)] = [("male", "Male"), ("female", "Female")]
    static let shirtSizes = ["YXS", "YS", "YM", "YL", "YXL", "AS", "AM", "AL", "AXL", "A2XL", "A3XL"]
    static let maxRoles = 12

    /// `CAMP_ROLE_SUGGESTIONS`, for a week the camp has listed nothing for.
    static let roleSuggestions = [
        "Crew leader", "Sports", "Arts and crafts", "Music", "Kitchen",
        "Lifeguard", "First aid", "Transport", "Photography", "Setup and cleanup",
    ]

    static let dayFormat: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func sectionLabel(_ section: String) -> String {
        section == "elementary" ? "Elementary" : "Middle school"
    }

    /// The grades under a half's name: `campGradesForSection`, as a range.
    static func sectionGrades(_ section: String) -> String {
        section == "elementary" ? "Kindergarten – Grade 5" : "Grade 6 – Grade 8"
    }

    /// `shirtSizeLabel`.
    static func shirtLabel(_ size: String) -> String {
        let words = ["XS": "Extra small", "S": "Small", "M": "Medium", "L": "Large",
                     "XL": "Extra large", "2XL": "2X large", "3XL": "3X large"]
        let rest = String(size.dropFirst())
        return "\(size.hasPrefix("Y") ? "Youth" : "Adult") \(words[rest] ?? rest)"
    }

    static func weekdayLabel(_ day: String) -> String { day.prefix(1).uppercased() + day.dropFirst() }

    /// `campDayKey`: `w1-mon`.
    static func dayKey(_ week: Int, _ day: String) -> String { "w\(week)-\(day)" }

    static func weekKeys(_ week: Int) -> [String] { weekdays.map { dayKey(week, $0) } }

    /// `campWeeksOf`.
    static func weeksOf(_ days: [String]) -> [Int] {
        Set(days.compactMap { key -> Int? in
            guard key.range(of: #"^w[1-9]-(mon|tue|wed|thu|fri)$"#, options: .regularExpression) != nil else { return nil }
            return Int(String(key.dropFirst().prefix(1)))
        }).sorted()
    }

    /// `campWeekRoleKey(week, section)`: `w1_elementary`, `w1_middle`.
    static func roleKey(_ week: Int, _ section: String?) -> String {
        guard let section else { return "w\(week)" }
        return "w\(week)_\(section == "elementary" ? "elementary" : "middle")"
    }

    /// `campDayDate`.
    static func date(_ weekStarts: [String], _ key: String) -> Date? {
        let parts = key.split(separator: "-")
        guard parts.count == 2, let week = Int(parts[0].dropFirst()), let offset = weekdays.firstIndex(of: String(parts[1])),
              week >= 1, week <= weekStarts.count, let start = dayFormat.date(from: weekStarts[week - 1]) else { return nil }
        return Calendar(identifier: .gregorian).date(byAdding: .day, value: offset, to: start)
    }

    /// The day of the month under a weekday, when the camp has been dated.
    static func dayOfMonth(_ weekStarts: [String], _ key: String) -> String? {
        date(weekStarts, key).map { String(Calendar(identifier: .gregorian).component(.day, from: $0)) }
    }

    /// `campWeekRangeLabel`: "Jul 13 – 17", or "Week 1" until dated.
    static func weekRange(_ weekStarts: [String], _ week: Int) -> String {
        guard let first = date(weekStarts, dayKey(week, "mon")), let last = date(weekStarts, dayKey(week, "fri")) else {
            return "Week \(week)"
        }
        let month = DateFormatter()
        month.locale = Locale(identifier: "en_US")
        month.dateFormat = "MMM"
        let day = { (date: Date) in Calendar(identifier: .gregorian).component(.day, from: date) }
        let a = month.string(from: first), b = month.string(from: last)
        return a == b ? "\(a) \(day(first)) – \(day(last))" : "\(a) \(day(first)) – \(b) \(day(last))"
    }

    /// `campAge`, against today on this phone.
    static func age(_ dateOfBirth: String) -> Int? {
        let parts = dateOfBirth.split(separator: "-").compactMap { Int($0) }
        guard dateOfBirth.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil, parts.count == 3,
              (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        let now = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: Date())
        var age = (now.year ?? 0) - parts[0]
        if (now.month ?? 0) < parts[1] || ((now.month ?? 0) == parts[1] && (now.day ?? 0) < parts[2]) { age -= 1 }
        return (0..<130).contains(age) ? age : nil
    }

    /// `campNeedsGuardian`: under 18, or an age that cannot be read.
    static func needsGuardian(_ dateOfBirth: String) -> Bool {
        guard let age = age(dateOfBirth) else { return true }
        return age < 18
    }
}

/// `CampConfig`, the fields the sign-up reads, parsed as `parseCampConfig`.
struct CampConfig: Equatable {
    var season: String
    var servantChargeCents: Int
    var servantChargeLabel: String
    var weeks: Int
    var weekStarts: [String]
    var weekRoles: [String: [String]]
    var waiverVersion: String
    var waiverText: String
    var note: String
    var servantSignUp: Bool

    var waiverInForce: Bool { !waiverText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    var chargeLabel: String { servantChargeLabel.isEmpty ? "Servant charge" : servantChargeLabel }

    /// Split on blank lines, as the app does.
    var waiverParagraphs: [String] {
        waiverText.components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// `campWeekRoleOptions`: the half's own list, else the week's, else the suggestions.
    func roleOptions(week: Int, section: String) -> [String] {
        if let own = weekRoles[Camp.roleKey(week, section)], !own.isEmpty { return own }
        if let shared = weekRoles[Camp.roleKey(week, nil)], !shared.isEmpty { return shared }
        return Camp.roleSuggestions
    }

    init(_ fields: [String: FirestoreValue]) {
        func text(_ key: String) -> String {
            fields[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        func cents(_ key: String) -> Int {
            guard let value = fields[key]?.numberValue, value >= 0, value <= 500_000, value == value.rounded() else { return 0 }
            return Int(value)
        }

        season = text("season").isEmpty ? String(Calendar(identifier: .gregorian).component(.year, from: Date())) : text("season")
        servantChargeCents = cents("servantChargeCents")
        servantChargeLabel = text("servantChargeLabel")
        let count = fields["weeks"]?.numberValue.map { Int($0) } ?? 2
        weeks = (1...6).contains(count) ? count : 2
        let given = fields["weekStarts"]?.arrayValue?.map { $0.stringValue?.trimmingCharacters(in: .whitespaces) ?? "" } ?? []
        weekStarts = (0..<weeks).map { index in
            let entry = index < given.count ? given[index] : ""
            return Camp.dayFormat.date(from: entry) != nil ? entry : ""
        }
        var roles: [String: [String]] = [:]
        for (key, value) in fields["weekRoles"]?.mapValue ?? [:] {
            guard key.range(of: #"^w[1-9](_(elementary|middle))?$"#, options: .regularExpression) != nil else { continue }
            var seen = Set<String>()
            let list = (value.arrayValue ?? [])
                .compactMap { $0.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty && seen.insert($0).inserted }
            if !list.isEmpty { roles[key] = Array(list.prefix(30)) }
        }
        weekRoles = roles
        waiverVersion = text("waiverVersion")
        waiverText = fields["waiverText"]?.stringValue ?? ""
        note = text("note")
        servantSignUp = fields["servantSignUp"]?.boolValue ?? true
    }
}

/// `blankServantSignUp`, flattened for bindings.
struct CampDraft: Equatable {
    var name = ""
    var phone = ""
    var email = ""
    var dateOfBirth = ""
    var gender = ""
    var shirtSize = "AM"
    var emergencyName = ""
    var emergencyPhone = ""
    var emergencyRelationship = ""
    var sections: [String] = []
    var days: [String] = []
    var desiredRolesByWeek: [String: [String]] = [:]
    var availability = ""
    var waiverAgreed = false
    var waiverVersion = ""
    var signedName = ""
    var signedRelationship = ""

    /// `validateServantSignUp`, in the same order and with the same words.
    func problems(waiverInForce: Bool) -> [String] {
        var errors: [String] = []
        if name.trimmed.isEmpty { errors.append("Enter your name.") }
        if phone.trimmed.isEmpty && email.trimmed.isEmpty {
            errors.append("Enter a phone number or an email address, so the camp can reach you.")
        }
        if emergencyName.trimmed.isEmpty || emergencyPhone.trimmed.isEmpty {
            errors.append("Enter an emergency contact — somebody to ring if we cannot reach you.")
        }
        if dateOfBirth.trimmed.isEmpty { errors.append("Enter your date of birth — the camp needs it to build the groups.") }
        if gender != "male" && gender != "female" { errors.append("Choose male or female — the camp splits its groups by it.") }
        if sections.isEmpty {
            errors.append("Choose which group you would like to serve — elementary, middle school, or both.")
        }
        if days.isEmpty { errors.append("Choose the days you can come.") }
        for week in Camp.weeksOf(days) {
            for section in sections where (desiredRolesByWeek[Camp.roleKey(week, section)] ?? []).isEmpty {
                errors.append("Choose at least one thing you would like to do in \(Camp.sectionLabel(section).lowercased()), week \(week).")
            }
        }
        if !Camp.shirtSizes.contains(shirtSize) { errors.append("Choose a shirt size.") }

        if waiverInForce {
            let guardian = !dateOfBirth.trimmed.isEmpty && Camp.needsGuardian(dateOfBirth)
            if !waiverAgreed || signedName.trimmed.isEmpty {
                errors.append(guardian
                              ? "Your parent or guardian has to agree to the waiver and sign it with their name."
                              : "The waiver has not been signed.")
            }
            if guardian && signedRelationship.trimmed.isEmpty {
                errors.append("Say how the person signing is related to you — mother, father, guardian.")
            }
        }
        return errors
    }

    /// The body `/api/camp/servant-request` reads: a `CampRegistrationDraft`.
    /// Season, programme and billing are the Function's to set; they are sent
    /// blank because `parseCampRegistration` expects the shape.
    func json(season: String) -> [String: Any] {
        [
            "registration": [
                "programId": "summercamp",
                "season": season,
                "kind": "servant",
                "status": "registered",
                "contact": [
                    "name": name.trimmed, "email": email.trimmed, "phone": phone.trimmed,
                    "altName": "", "altPhone": "", "address": "",
                ],
                "emergency": [
                    "name": emergencyName.trimmed, "phone": emergencyPhone.trimmed,
                    "relationship": emergencyRelationship.trimmed,
                ],
                "children": [Any](),
                "servant": [
                    "uid": NSNull(),
                    "dateOfBirth": dateOfBirth,
                    "gender": gender,
                    "sections": Camp.sections.filter { sections.contains($0) },
                    "desiredRolesByWeek": desiredRolesByWeek,
                    "shirtSize": shirtSize,
                    "days": days,
                    "availability": availability.trimmed,
                ],
                "waiver": [
                    "version": waiverVersion, "agreed": waiverAgreed,
                    "signedName": signedName.trimmed, "signedRelationship": signedRelationship.trimmed,
                    "signedAt": NSNull(), "signedByUid": NSNull(),
                ],
                "billing": [
                    "baseCents": 0, "chargeCents": 0, "chargeLabel": "",
                    "discounts": [Any](), "payments": [Any](),
                ],
                "note": "",
                "takenByUid": NSNull(),
            ],
            "message": "",
        ]
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

@MainActor
final class CampSignUpModel: ObservableObject {
    enum State: Equatable {
        case loading
        case closed
        case ready(CampConfig)
        case sent
    }

    @Published private(set) var state: State = .loading
    @Published var draft = CampDraft()
    @Published private(set) var errors: [String] = []
    @Published private(set) var sending = false

    private var started = false
    private var payment: CampPaymentSheet?

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    /// `useCampConfig`, once. A failed read gets the defaults, as in the app —
    /// the Function holds the real settings and refuses what they refuse.
    func load() {
        state = .loading
        Task {
            let fields = (try? await FirestoreREST.document("config/camp")) ?? [:]
            let config = CampConfig(fields)
            state = config.servantSignUp ? .ready(config) : .closed
        }
    }

    /// Unticking a half takes its roles with it (`clearDesiredRolesForSection`).
    func toggleSection(_ section: String) {
        if draft.sections.contains(section) {
            draft.sections.removeAll { $0 == section }
            let suffix = section == "elementary" ? "_elementary" : "_middle"
            draft.desiredRolesByWeek = draft.desiredRolesByWeek.filter { !$0.key.hasSuffix(suffix) }
        } else {
            draft.sections.append(section)
        }
    }

    func hasRole(_ role: String, week: Int, section: String) -> Bool {
        draft.desiredRolesByWeek[Camp.roleKey(week, section)]?.contains(role) == true
    }

    /// `toggleDesiredRole`.
    func toggleRole(_ role: String, week: Int, section: String) {
        let key = Camp.roleKey(week, section)
        var list = draft.desiredRolesByWeek[key] ?? []
        if list.contains(role) { list.removeAll { $0 == role } } else if list.count < Camp.maxRoles { list.append(role) }
        draft.desiredRolesByWeek[key] = list.isEmpty ? nil : list
    }

    private func complete(_ config: CampConfig) -> Bool {
        errors = draft.problems(waiverInForce: config.waiverInForce)
        return errors.isEmpty
    }

    func send(config: CampConfig) {
        guard !sending, complete(config) else { return }
        sending = true
        let body = draft.json(season: config.season)
        Task {
            let result = await CampAPI.post(body)
            sending = false
            if case .refused(let messages) = result { errors = messages } else { state = .sent }
        }
    }

    func payAndSend(config: CampConfig) {
        guard !sending, complete(config) else { return }
        sending = true
        let sheet = CampPaymentSheet(
            cents: config.servantChargeCents,
            label: config.chargeLabel,
            body: draft.json(season: config.season)
        ) { [weak self] outcome in
            guard let self else { return }
            self.sending = false
            self.payment = nil
            switch outcome {
            case .none: break // Closed without paying. Nothing to say.
            case .sent?: self.state = .sent
            case .refused(let messages)?: self.errors = messages
            }
        }
        payment = sheet
        sheet.present()
    }
}

enum CampAPI {
    enum Outcome: Equatable {
        case sent
        case refused([String])
    }

    /// `sendServantSignUp`: no sign-in, as the Function asks for none.
    static func post(_ body: [String: Any], cardToken: String? = nil) async -> Outcome {
        var payload = body
        if let cardToken { payload["cardToken"] = cardToken }

        var request = URLRequest(url: ClipConfig.api("/api/camp/servant-request"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .refused(["Could not reach the church server. Check your connection and try again."])
        }
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return .refused(["Could not send the sign-up. Please try again shortly."])
        }
        let errors = (json["errors"] as? [Any] ?? []).map { "\($0)" }.filter { !$0.isEmpty }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200..<300).contains(status) || !errors.isEmpty {
            return .refused(errors.isEmpty ? ["Could not send the sign-up. Please try again."] : errors)
        }
        return .sent
    }
}

/// Apple Pay for the servant charge, sending the sign-up inside the sheet —
/// `FormPaymentSheet` with the camp's endpoint. A refusal fails the sheet, so
/// a declined card or a refused sign-up never looks like it went through.
final class CampPaymentSheet: NSObject, PKPaymentAuthorizationControllerDelegate {
    private let cents: Int
    private let label: String
    private let body: [String: Any]
    private let done: @MainActor (CampAPI.Outcome?) -> Void
    private var controller: PKPaymentAuthorizationController?
    private var outcome: CampAPI.Outcome?

    init(cents: Int, label: String, body: [String: Any], done: @escaping @MainActor (CampAPI.Outcome?) -> Void) {
        self.cents = cents
        self.label = label
        self.body = body
        self.done = done
    }

    func present() {
        let request = PKPaymentRequest.squarePaymentRequest(
            merchantIdentifier: ClipConfig.applePayMerchantId,
            countryCode: "US",
            currencyCode: "USD"
        )
        let amount = NSDecimalNumber(mantissa: UInt64(cents), exponent: -2, isNegative: false)
        request.paymentSummaryItems = [
            PKPaymentSummaryItem(label: label, amount: amount),
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
        let result = await CampAPI.post(body, cardToken: nonce)
        outcome = result
        return PKPaymentAuthorizationResult(status: result == .sent ? .success : .failure, errors: nil)
    }

    func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
        controller.dismiss {
            let outcome = self.outcome
            Task { @MainActor in self.done(outcome) }
        }
    }
}
