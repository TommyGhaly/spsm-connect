import SwiftUI

/// The nomination for ordination, filled in and sent from the clip.
///
/// ---------------------------------------------------------------------------
/// The app's `src/ordination/NominationScreen.tsx`, which is the website's, in
/// SwiftUI and with the same words. It is what `/c/forms` shows when the office
/// has put `ordination` on the tag (`config/forms.nfcFormSlug`). It is not a
/// stored form, so `FormsView`'s engine cannot draw it, and handing it to
/// Safari is what a tag by the church door should not do.
///
/// Like the app: no sign-in, no choosing the ordination (the soonest open one
/// is taken), and nothing to read back once sent. The rules are
/// `validateOrdinationDraft` in `@spsm/shared`'s `schema/ordination.ts`, ported
/// line for line; `ordinationApply` checks again and its sentences are shown
/// as they come.
/// ---------------------------------------------------------------------------
struct OrdinationForm: View {
    @StateObject private var model = OrdinationModel()

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

            case .failed:
                ClipProblem(message: "The list of ordinations couldn’t be read. Check you have signal or Wi-Fi, then try again.") {
                    model.load()
                }

            case .none:
                ClipCard {
                    ClipHeading(text: OrdinationModel.title)
                    ClipBody(text: "The church is not taking nominations for ordination at the moment. Speak to one of the parish priests if you would like to be considered.")
                }

            case .sent:
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Sent")
                    ClipHeading(text: "Thank you")
                    ClipBody(text: "The nomination has gone to the parish priests. They will be in touch — it is a nomination, not an ordination, until they have reviewed it and the diocese has received it.")
                    Text("Nothing you sent can be read back from here. If something was wrong, send it again and say so in the note at the end.")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                }

            case .ready(let ordination):
                NominationBody(ordination: ordination, model: model)
            }
        }
        .task { model.loadIfNeeded() }
    }
}

/* ── The form ────────────────────────────────────────────────────────────── */

private struct NominationBody: View {
    let ordination: Ordination
    @ObservedObject var model: OrdinationModel

    var body: some View {
        let rank = model.draft.rank
        let info = rank?.info
        let age = Ordination.age(born: model.draft.dateOfBirth, on: ordination.date)

        ClipCard(spacing: 16) {
            ClipHeading(text: OrdinationModel.title)
            ClipBody(text: "For the ordination on \(Ordination.longDay(ordination.date)), please fill out this form by choosing the deacon rank you are asking for. Then the priests will review every nomination. You will be notified of their decision through one of the church deacons.")

            if !ordination.closesOn.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Last day to apply: \(Ordination.longDay(ordination.closesOn)).")
                        .font(Face.body.weight(.semibold))
                        .foregroundStyle(Ink.ink)
                    Text("Nominations close at the end of that day.")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkSoft)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Ink.paperSunken)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            section("Which rank")
            VStack(spacing: 8) {
                ForEach(OrdinationRank.allCases, id: \.self) { option in
                    RankRow(rank: option, chosen: rank == option) { model.draft.rank = option }
                }
            }
            if let info {
                hint("The diocese asks that a \(info.title.lowercased()) has completed \(info.minimumAge) years of age.")
            }

            if let rank, let info {
                section("About you")
                labelled("Your full name") {
                    TextField("", text: $model.draft.name)
                        .textFieldStyle(BoxStyle())
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                }
                labelled("Address") {
                    TextField("Street, city, state, ZIP", text: $model.draft.address)
                        .textFieldStyle(BoxStyle())
                        .textContentType(.fullStreetAddress)
                }
                labelled("Date of birth") {
                    BirthdayPicker(day: $model.draft.dateOfBirth)
                    if let age {
                        hint("\(age) on the day of the ordination" + (age < info.minimumAge ? " — younger than the \(info.minimumAge) the diocese asks for" : ""))
                    }
                }
                if info.minor {
                    labelled("School grade") {
                        TextField("e.g. 9th grade", text: $model.draft.schoolGrade).textFieldStyle(BoxStyle())
                    }
                } else {
                    labelled("Level of study or professional position") {
                        TextField("", text: $model.draft.occupation).textFieldStyle(BoxStyle())
                    }
                }
                labelled("Telephone", required: false) {
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
                hint("A telephone number or an email address — one of the two is needed.")
                labelled("Father of confession", required: false) {
                    TextField("e.g. Fr. Mina", text: $model.draft.fatherOfConfession).textFieldStyle(BoxStyle())
                    hint("The diocese asks the parish priests whether he has approved your nomination.")
                }

                if info.minor {
                    section("Parents")
                    hint(age.map { $0 < 18 } == true ? "At least one parent, since you are under 18." : "If applicable.")
                    ForEach(model.draft.parents.indices, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 10) {
                            labelled("Parent \(index + 1) name", required: false) {
                                TextField("", text: $model.draft.parents[index].name)
                                    .textFieldStyle(BoxStyle())
                                    .textInputAutocapitalization(.words)
                            }
                            labelled("Telephone", required: false) {
                                TextField("", text: $model.draft.parents[index].phone)
                                    .textFieldStyle(BoxStyle())
                                    .keyboardType(.phonePad)
                            }
                            labelled("Email", required: false) {
                                TextField("", text: $model.draft.parents[index].email)
                                    .textFieldStyle(BoxStyle())
                                    .keyboardType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            }
                        }
                        .padding(12)
                        .background(Ink.paperSunken)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }

                section("Anything else")
                labelled("Filling this in for your son? Your name", required: false) {
                    TextField("", text: $model.draft.submittedBy)
                        .textFieldStyle(BoxStyle())
                        .textInputAutocapitalization(.words)
                }
                labelled("A note for the parish priests", required: false) {
                    TextField("", text: $model.draft.message, axis: .vertical)
                        .lineLimit(3...8)
                        .textFieldStyle(BoxStyle())
                }

                // Above the button, which is where somebody who has just
                // pressed it is looking.
                if !model.errors.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(model.errors, id: \.self) { FieldProblem(text: $0) }
                    }
                }

                ClipButton(
                    label: model.sending ? "Sending…" : "Send my nomination for \(rank.label)",
                    busy: model.sending
                ) { model.send(for: ordination) }
                Text("It goes straight to the parish priests. You will not be able to read it back or change it here.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
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

private struct RankRow: View {
    let rank: OrdinationRank
    let chosen: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: chosen ? "largecircle.fill.circle" : "circle")
                    .font(.title3)
                    .foregroundStyle(chosen ? Ink.accent : Ink.inkFaint)
                Text(rank.label)
                    .font(Face.body)
                    .foregroundStyle(Ink.ink)
                Spacer(minLength: 8)
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

/// A date of birth as `yyyy-MM-dd`, which is what the Function parses.
///
/// Empty until chosen, and opening on a plausible birthday rather than today,
/// because a wheel that starts at this year is twenty spins from anybody's.
private struct BirthdayPicker: View {
    @Binding var day: String

    var body: some View {
        if let date = Ordination.dayFormat.date(from: day) {
            HStack {
                DatePicker(
                    "Date of birth",
                    selection: Binding(get: { date }, set: { day = Ordination.dayFormat.string(from: $0) }),
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
                let start = Calendar(identifier: .gregorian).date(byAdding: .year, value: -14, to: Date()) ?? Date()
                day = Ordination.dayFormat.string(from: start)
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

/* ── Model ───────────────────────────────────────────────────────────────── */

/// `ORDINATION_RANKS` and `ORDINATION_RANK_INFO`.
enum OrdinationRank: String, CaseIterable {
    case cantor, reader, subdeacon

    struct Info {
        let title: String
        let greek: String
        let minimumAge: Int
        /// A cantor and a reader may be children: a school grade and parents.
        let minor: Bool
    }

    var info: Info {
        switch self {
        case .cantor: return Info(title: "Cantor", greek: "Epsaltos", minimumAge: 8, minor: true)
        case .reader: return Info(title: "Reader", greek: "Anaghnostis", minimumAge: 16, minor: true)
        case .subdeacon: return Info(title: "Subdeacon", greek: "Epidiacon", minimumAge: 24, minor: false)
        }
    }

    /// `ordinationRankLabel`.
    var label: String { "\(info.title) (\(info.greek))" }
}

/// `Ordination`, the fields the form reads.
struct Ordination: Equatable {
    let id: String
    let date: String
    let open: Bool
    let closesOn: String

    static let dayFormat: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// `isCalendarDay`.
    static func isDay(_ text: String) -> Bool {
        text.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil && dayFormat.date(from: text) != nil
    }

    /// `ordinationAccepting`, against today in `PARISH_TIME_ZONE`.
    var accepting: Bool {
        let today = Self.dayFormat.string(from: Date())
        return open && (closesOn.isEmpty || today <= closesOn)
    }

    /// `longDay`: "29 November 2026".
    static func longDay(_ day: String) -> String {
        guard isDay(day) else { return day }
        let parts = day.split(separator: "-").compactMap { Int($0) }
        let months = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
        return "\(parts[2]) \(months[parts[1] - 1]) \(parts[0])"
    }

    /// `ageOn`.
    static func age(born: String, on day: String) -> Int? {
        guard isDay(born), isDay(day) else { return nil }
        let b = born.split(separator: "-").compactMap { Int($0) }
        let d = day.split(separator: "-").compactMap { Int($0) }
        var age = d[0] - b[0]
        if d[1] < b[1] || (d[1] == b[1] && d[2] < b[2]) { age -= 1 }
        return age
    }

    init?(id: String, _ fields: [String: FirestoreValue]) {
        let date = fields["date"]?.stringValue?.trimmingCharacters(in: .whitespaces) ?? ""
        let closes = fields["closesOn"]?.stringValue?.trimmingCharacters(in: .whitespaces) ?? ""
        self.id = id
        self.date = Self.isDay(date) ? date : ""
        self.open = fields["open"]?.boolValue == true
        self.closesOn = Self.isDay(closes) ? closes : ""
    }
}

struct OrdinationContact: Equatable {
    var name = ""
    var phone = ""
    var email = ""

    var json: [String: Any] { ["name": name.trimmed, "phone": phone.trimmed, "email": email.trimmed] }
}

/// `OrdinationApplicationDraft`, flattened for bindings.
struct OrdinationDraft: Equatable {
    var rank: OrdinationRank?
    var name = ""
    var address = ""
    var dateOfBirth = ""
    var schoolGrade = ""
    var occupation = ""
    var phone = ""
    var email = ""
    var fatherOfConfession = ""
    var parents = [OrdinationContact(), OrdinationContact()]
    var submittedBy = ""
    var message = ""

    /// `validateOrdinationDraft`, in the same order and with the same words.
    func problems(ordinationDate: String) -> [String] {
        var errors: [String] = []
        guard let rank else { return ["Choose the rank the nominee is put forward for."] }
        let info = rank.info

        if name.trimmed.isEmpty { errors.append("Enter the nominee’s full name.") }
        if address.trimmed.isEmpty { errors.append("Enter the nominee’s address.") }
        if dateOfBirth.isEmpty { errors.append("Enter the nominee’s date of birth.") }
        if phone.trimmed.isEmpty && email.trimmed.isEmpty {
            errors.append("Enter a telephone number or an email address for the nominee.")
        }
        if !email.trimmed.isEmpty && !Self.looksLikeEmail(email) {
            errors.append("The nominee’s email address does not look right.")
        }
        if info.minor && schoolGrade.trimmed.isEmpty { errors.append("Enter the nominee’s school grade.") }
        if !info.minor && occupation.trimmed.isEmpty {
            errors.append("Enter the nominee’s level of study or professional position.")
        }

        if info.minor {
            let parent = parents[0]
            if let age = Ordination.age(born: dateOfBirth, on: ordinationDate), age < 18 {
                if parent.name.trimmed.isEmpty { errors.append("Enter a parent’s name — the nominee is under 18.") }
                if parent.phone.trimmed.isEmpty && parent.email.trimmed.isEmpty {
                    errors.append("Enter a telephone number or an email address for the parent.")
                }
            }
            for (index, contact) in parents.enumerated() where !contact.email.trimmed.isEmpty && !Self.looksLikeEmail(contact.email) {
                errors.append("Parent \(index + 1)’s email address does not look right.")
            }
        }
        return errors
    }

    /// `looksLikeEmail` in `payments/squareCheckout.ts`.
    static func looksLikeEmail(_ value: String) -> Bool {
        value.trimmed.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, options: .regularExpression) != nil
    }

    /// The body `parseOrdinationDraft` reads.
    func json(ordinationId: String) -> [String: Any] {
        [
            "ordinationId": ordinationId,
            "rank": rank?.rawValue ?? "",
            "nominee": [
                "name": name.trimmed,
                "address": address.trimmed,
                "dateOfBirth": dateOfBirth,
                "schoolGrade": schoolGrade.trimmed,
                "occupation": occupation.trimmed,
                "phone": phone.trimmed,
                "email": email.trimmed,
                "fatherOfConfession": fatherOfConfession.trimmed,
            ],
            "parents": parents.map(\.json),
            "submittedBy": submittedBy.trimmed,
            "message": message.trimmed,
        ]
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

@MainActor
final class OrdinationModel: ObservableObject {
    static let title = "Nomination for ordination"

    enum State: Equatable {
        case loading
        case failed
        /// No ordination is taking nominations.
        case none
        case ready(Ordination)
        case sent
    }

    @Published private(set) var state: State = .loading
    @Published var draft = OrdinationDraft()
    @Published private(set) var errors: [String] = []
    @Published private(set) var sending = false

    private var started = false

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    /// `watchOpenOrdinations`, once: open, still accepting, soonest first.
    /// `ordinations` is world-readable for `open == true`.
    func load() {
        state = .loading
        Task {
            do {
                let rows = try await FirestoreREST.query("ordinations", where: "open", equals: true)
                let soonest = rows
                    .compactMap { Ordination(id: $0.id, $0.fields) }
                    .filter(\.accepting)
                    .sorted { $0.date < $1.date }
                    .first
                state = soonest.map { .ready($0) } ?? .none
            } catch {
                state = .failed
            }
        }
    }

    /// `sendNomination`: the same body to `/api/ordination/apply`, with no
    /// sign-in — the Function asks for none and rate-limits by address.
    func send(for ordination: Ordination) {
        guard !sending else { return }
        let problems = draft.problems(ordinationDate: ordination.date)
        errors = problems
        guard problems.isEmpty else { return }

        sending = true
        let body = draft.json(ordinationId: ordination.id)
        Task {
            let result = await Self.post(body)
            sending = false
            switch result {
            case .success: state = .sent
            case .failure(let refusal): errors = refusal.messages
            }
        }
    }

    struct Refusal: Error { let messages: [String] }

    private static func post(_ body: [String: Any]) async -> Result<Void, Refusal> {
        var request = URLRequest(url: ClipConfig.api("/api/ordination/apply"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .failure(Refusal(messages: ["Could not reach the church server. Check your connection and try again."]))
        }

        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return .failure(Refusal(messages: ["Could not send the nomination. Please try again shortly."]))
        }
        let errors = (json["errors"] as? [Any] ?? []).map { "\($0)" }.filter { !$0.isEmpty }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200..<300).contains(status) || !errors.isEmpty {
            return .failure(Refusal(messages: errors.isEmpty ? ["Could not send the nomination. Please try again."] : errors))
        }
        return .success(())
    }
}
