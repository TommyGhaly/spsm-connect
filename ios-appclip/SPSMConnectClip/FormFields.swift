import SwiftUI

/// One input per field type — the clip's `src/forms/Fields.tsx`.
///
/// Big boxes, the label above every one, the help line under it, and the
/// problem under that in the accent colour. Nothing is placeholder-only: a
/// placeholder disappears the moment somebody starts typing, which is exactly
/// when they need to remember what the box was for.
struct FieldInput: View {
    let field: FormField
    @Binding var answer: FormAnswer?
    let problem: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            switch field.type {
            case .heading:
                ClipHeading(text: field.label)
                    .padding(.top, 6)
                if let help = field.help { ClipBody(text: help) }

            case .consent:
                Toggle(isOn: flag) {
                    Text(field.label + (field.required ? "" : " (optional)"))
                        .font(Face.body)
                        .foregroundStyle(Ink.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .toggleStyle(CheckStyle())
                helpAndProblem

            default:
                FieldLabel(text: field.label, required: field.required)
                control
                helpAndProblem
            }
        }
    }

    @ViewBuilder private var control: some View {
        switch field.type {
        case .shortText, .email, .phone:
            TextField(field.placeholder ?? "", text: text)
                .textFieldStyle(BoxStyle(invalid: problem != nil))
                .keyboardType(field.type == .email ? .emailAddress : field.type == .phone ? .phonePad : .default)
                .textContentType(field.type == .email ? .emailAddress : field.type == .phone ? .telephoneNumber : nil)
                .textInputAutocapitalization(field.type == .email ? .never : .sentences)
                .autocorrectionDisabled(field.type != .shortText)

        case .longText:
            TextField(field.placeholder ?? "", text: text, axis: .vertical)
                .lineLimit(4...10)
                .textFieldStyle(BoxStyle(invalid: problem != nil))

        case .number:
            TextField(field.placeholder ?? "", text: numberText)
                .keyboardType(.decimalPad)
                .textFieldStyle(BoxStyle(invalid: problem != nil))

        case .date:
            DateAnswer(answer: $answer)

        case .select, .radio:
            // One list of big rows for both. A collapsed menu hides the
            // options, which is the wrong trade for somebody unsure what to
            // pick; the website's `select` is a space-saver this screen does
            // not need.
            VStack(spacing: 8) {
                ForEach(field.options, id: \.self) { option in
                    ChoiceRow(
                        label: option.label,
                        price: option.priceCents,
                        chosen: answer?.asText == option.value,
                        multiple: false
                    ) { answer = .text(option.value) }
                }
            }

        case .checkboxes:
            VStack(spacing: 8) {
                ForEach(field.options, id: \.self) { option in
                    let chosen = list.contains(option.value)
                    ChoiceRow(label: option.label, price: option.priceCents, chosen: chosen, multiple: true) {
                        var values = list
                        if chosen { values.removeAll { $0 == option.value } } else { values.append(option.value) }
                        answer = .list(values)
                    }
                }
            }

        default:
            EmptyView()
        }
    }

    @ViewBuilder private var helpAndProblem: some View {
        if let help = field.help, field.type != .heading {
            Text(help)
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
        if let problem {
            FieldProblem(text: problem)
        }
    }

    private var text: Binding<String> {
        Binding(get: { answer?.asText ?? "" }, set: { answer = .text($0) })
    }

    private var numberText: Binding<String> {
        Binding(
            get: { answer?.asText ?? "" },
            set: { typed in
                let cleaned = typed.replacingOccurrences(of: ",", with: ".")
                if cleaned.isEmpty { answer = nil } else if let value = Double(cleaned) { answer = .number(value) } else { answer = .text(cleaned) }
            }
        )
    }

    private var flag: Binding<Bool> {
        Binding(get: { if case .flag(let value) = answer { return value }; return false }, set: { answer = .flag($0) })
    }

    private var list: [String] {
        if case .list(let values) = answer { return values }
        return []
    }
}

/// A date as `yyyy-MM-dd`, which is what `<input type="date">` sends and what
/// the Function checks for. Blank until somebody picks one, so an optional date
/// is not silently answered with today.
private struct DateAnswer: View {
    @Binding var answer: FormAnswer?

    private static let format: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    var body: some View {
        if let text = answer?.asText, let date = Self.format.date(from: text) {
            HStack {
                DatePicker(
                    "Date",
                    selection: Binding(get: { date }, set: { answer = .text(Self.format.string(from: $0)) }),
                    displayedComponents: .date
                )
                .labelsHidden()
                Spacer()
                Button("Clear") { answer = nil }
                    .font(Face.body)
                    .foregroundStyle(Ink.accent)
                    .frame(minHeight: 44)
            }
        } else {
            Button {
                answer = .text(Self.format.string(from: Date()))
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

struct FieldLabel: View {
    let text: String
    var required = true

    var body: some View {
        // "(optional)" on the ones that are, rather than an asterisk on the
        // ones that are not: an asterisk is a convention, a word is not.
        Text(text + (required ? "" : " (optional)"))
            .font(Face.body.weight(.semibold))
            .foregroundStyle(Ink.ink)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct FieldProblem: View {
    let text: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "exclamationmark.circle.fill")
            Text(text).fixedSize(horizontal: false, vertical: true)
        }
        .font(Face.small.weight(.semibold))
        .foregroundStyle(Ink.accent)
    }
}

private struct ChoiceRow: View {
    let label: String
    let price: Int
    let chosen: Bool
    let multiple: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: multiple
                      ? (chosen ? "checkmark.square.fill" : "square")
                      : (chosen ? "largecircle.fill.circle" : "circle"))
                    .font(.title3)
                    .foregroundStyle(chosen ? Ink.accent : Ink.inkFaint)
                Text(label)
                    .font(Face.body)
                    .foregroundStyle(Ink.ink)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                if price > 0 {
                    Text("+" + Money.text(price))
                        .font(Face.small)
                        .foregroundStyle(Ink.inkSoft)
                }
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

/// A large tick box for consent and has-Taksis, where a switch would read as a
/// setting rather than an agreement.
struct CheckStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .font(.title2)
                    .foregroundStyle(configuration.isOn ? Ink.accent : Ink.inkFaint)
                configuration.label
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
        }
        .accessibilityAddTraits(configuration.isOn ? .isSelected : [])
    }
}

struct BoxStyle: TextFieldStyle {
    var invalid = false

    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(Face.body)
            .foregroundStyle(Ink.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(minHeight: 48)
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(invalid ? Ink.accent : Ink.rule, lineWidth: invalid ? 2 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

enum Money {
    static func text(_ cents: Int) -> String {
        cents % 100 == 0 ? "$\(cents / 100)" : String(format: "$%d.%02d", cents / 100, cents % 100)
    }
}

/* ── The vehicle registration ────────────────────────────────────────────── */

/// `src/forms/VehicleForm.tsx`, in SwiftUI: the car, then up to five drivers.
struct VehicleFields: View {
    @Binding var input: VehicleInput

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ClipHeading(text: "The car")
            labelled("License plate") {
                TextField("ABC 1234", text: $input.plate)
                    .textFieldStyle(BoxStyle())
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
            HStack(alignment: .top, spacing: 12) {
                labelled("Make", required: false) {
                    TextField("Toyota", text: $input.make).textFieldStyle(BoxStyle())
                }
                labelled("Model", required: false) {
                    TextField("Camry", text: $input.model).textFieldStyle(BoxStyle())
                }
            }
            labelled("Color", required: false) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
                    ForEach(VehicleInput.colors, id: \.value) { color in
                        let chosen = input.color == color.value
                        Button {
                            input.color = chosen ? "" : color.value
                        } label: {
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(Color(hex: color.hex))
                                    .overlay(Circle().strokeBorder(Ink.rule, lineWidth: 1))
                                    .frame(width: 20, height: 20)
                                Text(color.label)
                                    .font(Face.small)
                                    .foregroundStyle(Ink.ink)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 10)
                            .frame(minHeight: 44)
                            .background(chosen ? Ink.accentSoft : Ink.paperRaised)
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(chosen ? Ink.accent : Ink.rule, lineWidth: chosen ? 2 : 1))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .accessibilityLabel(color.label)
                        .accessibilityAddTraits(chosen ? .isSelected : [])
                    }
                }
            }

            Rectangle().fill(Ink.rule).frame(height: 1)

            ClipHeading(text: "Who drives it")
            ClipBody(text: "The parking team calls the first person if the car needs moving.")

            ForEach($input.drivers) { $driver in
                let index = input.drivers.firstIndex { $0.id == driver.id } ?? 0
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(index == 0 ? "Main driver" : "Driver \(index + 1)")
                            .font(Face.body.weight(.semibold))
                            .foregroundStyle(Ink.ink)
                        Spacer()
                        if index > 0 {
                            Button("Remove") { input.drivers.removeAll { $0.id == driver.id } }
                                .font(Face.body)
                                .foregroundStyle(Ink.accent)
                                .frame(minHeight: 44)
                        }
                    }
                    labelled(index == 0 ? "First and last name" : "Name", required: index == 0) {
                        TextField("", text: $driver.name)
                            .textFieldStyle(BoxStyle())
                            .textContentType(index == 0 ? .name : nil)
                    }
                    labelled("Phone", required: index == 0) {
                        TextField("", text: $driver.phone)
                            .textFieldStyle(BoxStyle())
                            .keyboardType(.phonePad)
                            .textContentType(index == 0 ? .telephoneNumber : nil)
                    }
                    Toggle(isOn: $driver.hasTaksis) {
                        Text("Already has the Taksis app")
                            .font(Face.body)
                            .foregroundStyle(Ink.ink)
                    }
                    .toggleStyle(CheckStyle())
                }
                .padding(12)
                .background(Ink.paperSunken)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            if input.drivers.count < VehicleInput.maxDrivers {
                ClipButton(label: "Add another driver", tone: .quiet) {
                    input.drivers.append(VehicleDriver())
                }
            }
        }
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
