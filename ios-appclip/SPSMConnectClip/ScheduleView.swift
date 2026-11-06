import SwiftUI

/// `/c/schedule` — what is on at the church this week.
///
/// The most useful of the eight, and the one most worth being native: somebody
/// has tapped a tag in the narthex to find out whether there is a service on
/// Wednesday, and the answer should be on screen before a web page would have
/// finished laying out.
///
/// Drawn the way the website's week view is (`features/calendar/WeekView.tsx`
/// and the `.sched-*` rules in globals.css): a card per day with the weekday in
/// the serif and the date on the right, and each entry a time column and a
/// title, with a left rule in the colour of what the thing *is* — liturgical
/// red, teaching gold, gatherings azure. The bulletin's photograph sits at the
/// end of the row, as on the website's wide layout.
///
/// Two reads, the same two the website's calendar makes:
///
/// - `GET /api/calendar?from=&to=` — Breeze, merged server-side with the
///   parish's own entries. Unauthenticated, which is what that endpoint serves
///   by default; the servants' rota needs a token, and a clip has none.
/// - `GET /api/bulletin` — this week's announcements sheet, which is where the
///   photographs come from. Optional: if it fails the week still shows.
///
/// The two describe the same week under slightly different names, so they are
/// reconciled with a port of `mergeCalendarSources` from @spsm/shared, or every
/// liturgy would appear twice.
struct ScheduleView: View {
    @StateObject private var model = ScheduleModel()
    /// Past days start folded to a one-line peek, as the website's wheel shows
    /// the days that are not centred. Tapping one opens it.
    @State private var opened: Set<String> = []

    var body: some View {
        ClipScreen(destination: .schedule) {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 16) {
                    switch model.state {
                    case .loading:
                        ClipCard {
                            HStack(spacing: 10) {
                                ProgressView().tint(Ink.accent)
                                ClipBody(text: "Reading the church’s calendar…")
                            }
                        }

                    case .failed(let message):
                        ClipProblem(message: message) { model.load() }

                    case .loaded(let week):
                        WeekHeader(week: week) { day in
                            opened.insert(day.day)
                            withAnimation(.easeInOut(duration: 0.3)) {
                                proxy.scrollTo(day.day, anchor: .top)
                            }
                        }

                        VStack(spacing: 12) {
                            ForEach(week.days, id: \.day) { day in
                                if day.isPast && !opened.contains(day.day) {
                                    CollapsedDay(day: day) {
                                        withAnimation(.easeOut(duration: 0.2)) {
                                            _ = opened.insert(day.day)
                                        }
                                    }
                                    .id(day.day)
                                } else {
                                    DayCard(day: day).id(day.day)
                                }
                            }
                        }

                        Legend()
                    }

                    ClipFooter(
                        destination: .schedule,
                        readMore: "The church’s calendar has the whole month, and every event’s own page."
                    )
                }
            }
        }
        .task { model.loadIfNeeded() }
    }
}

/* ── The kinds ────────────────────────────────────────────────────────────── */

/// `OccurrenceKind` from @spsm/shared, with the website's colours.
enum OccurrenceKind: String {
    case liturgy, study, gathering, other

    /// The rule down the entry's left edge — `--sched-tone`.
    var tone: Color {
        switch self {
        case .liturgy: Ink.accent
        case .study: Ink.gold
        case .gathering: Ink.azure
        case .other: Ink.rule
        }
    }

    /// The start time's colour: `color-mix(tone 55%, ink)`, worked out here
    /// because the tone at full strength fails contrast on paper at this size.
    var timeTone: Color {
        switch self {
        case .liturgy: Color(hex: 0x61211B)
        case .study: Color(hex: 0x6D572E)
        case .gathering: Color(hex: 0x263D55)
        case .other: Color(hex: 0x887974)
        }
    }

    /// The same three words the website's legend uses.
    var legend: String {
        switch self {
        case .liturgy: "Liturgies & prayers"
        case .study: "Classes & studies"
        case .gathering: "Meetings & gatherings"
        case .other: "Everything else"
        }
    }

    private static let markers: [(OccurrenceKind, Set<String>)] = [
        (.liturgy, ["liturgy", "vespers", "tasbeha", "tesbeha", "praises", "matins", "feast", "nahda"]),
        (.study, ["class", "school", "study", "lesson", "catechism", "mahragan", "keraza", "hymns"]),
        (.gathering, [
            "meeting", "fellowship", "tournament", "trip", "camp", "meals", "retreat",
            "festival", "competition", "outing", "visit", "picnic",
        ]),
    ]

    /// `occurrenceKind(title)`: the first kind any of whose words is in the title.
    static func of(title: String) -> OccurrenceKind {
        let words = Set(normalisedWords(title))
        for (kind, words2) in markers where !words.isDisjoint(with: words2) {
            return kind
        }
        return .other
    }
}

/// Lowercased, everything but letters, digits and spaces turned to spaces.
private func normalisedWords(_ title: String) -> [String] {
    let cleaned = title.lowercased().map { character -> Character in
        (character.isASCII && (character.isLetter || character.isNumber)) || character == " " ? character : " "
    }
    return String(cleaned).split(whereSeparator: \.isWhitespace).map(String.init)
}

/* ── The week header ──────────────────────────────────────────────────────── */

/// The range in the serif, then the seven days the way the website's month
/// grid draws them: the weekday in tracked gold capitals, the date, and a dot
/// per entry in its kind's colour. Today's date sits in a red disc.
private struct WeekHeader: View {
    let week: ScheduleWeek
    let onPick: (ScheduleDay) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(week.rangeLabel)
                .font(Face.display(22, relativeTo: .title2))
                .foregroundStyle(Ink.ink)

            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(week.days, id: \.day) { day in
                        Text(day.shortWeekday.uppercased())
                            .font(Face.label)
                            .kerning(0.8)
                            .foregroundStyle(Ink.gold)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Ink.rule).frame(height: 1)
                }

                HStack(spacing: 0) {
                    ForEach(week.days, id: \.day) { day in
                        Button { onPick(day) } label: { DayPip(day: day) }
                            .buttonStyle(.plain)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct DayPip: View {
    let day: ScheduleDay

    var body: some View {
        VStack(spacing: 5) {
            Text(day.dateNumber)
                .font(.headline.monospacedDigit())
                .foregroundStyle(day.isToday ? Ink.inkInverse : Ink.ink)
                .frame(width: 34, height: 34)
                .background(Circle().fill(day.isToday ? Ink.accent : Color.clear))

            HStack(spacing: 2) {
                ForEach(Array(day.occurrences.prefix(5).enumerated()), id: \.offset) { _, item in
                    Circle().fill(item.kind.tone).frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }
}

/* ── A day ────────────────────────────────────────────────────────────────── */

/// `.sched-wheel__card`: raised paper, a hairline, 16pt corners, and for today
/// a red edge down the left and the weekday in red.
private struct DayCard: View {
    let day: ScheduleDay

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(day.weekday)
                    .font(Face.display(19, relativeTo: .headline))
                    .foregroundStyle(day.isToday ? Ink.accent : Ink.ink)

                if day.isToday {
                    Text("TODAY")
                        .font(.caption2.weight(.semibold))
                        .kerning(0.7)
                        .foregroundStyle(Ink.inkInverse)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Ink.accent))
                }

                Spacer(minLength: 0)

                Text(day.monthShort.uppercased())
                    .font(.caption)
                    .kerning(0.8)
                    .foregroundStyle(Ink.inkFaint)
                Text(day.dateNumber)
                    .font(Face.display(19, relativeTo: .headline).monospacedDigit())
                    .foregroundStyle(Ink.ink)
            }
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Ink.rule.opacity(0.7)).frame(height: 1)
            }

            if day.occurrences.isEmpty {
                Text("Nothing scheduled")
                    .font(Face.small.italic())
                    .foregroundStyle(Ink.inkFaint)
                    .padding(.vertical, 6)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(day.occurrences, id: \.id) { item in
                        EntryRow(occurrence: item)
                    }
                }
            }
        }
        .padding(.top, 10)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.paperRaised)
        .overlay(alignment: .leading) {
            if day.isToday {
                Rectangle().fill(Ink.accent).frame(width: 3)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(day.isToday ? Ink.accent.opacity(0.4) : Ink.rule, lineWidth: 1)
        )
        .shadow(color: Color(hex: 0x1C1614).opacity(0.08), radius: 4, y: 2)
    }
}

/// A past day, folded: "THU 5" and its dots, as the website's wheel shows the
/// days that are not in front.
private struct CollapsedDay: View {
    let day: ScheduleDay
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 10) {
                Text("\(day.shortWeekday.uppercased()) \(day.dateNumber)")
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.inkFaint)

                HStack(spacing: 3) {
                    ForEach(Array(day.occurrences.prefix(6).enumerated()), id: \.offset) { _, item in
                        Circle().fill(item.kind.tone).frame(width: 5, height: 5)
                    }
                }

                Spacer(minLength: 0)

                Text(day.occurrences.isEmpty ? "Nothing" : (day.occurrences.count == 1 ? "1 entry" : "\(day.occurrences.count) entries"))
                    .font(.caption)
                    .foregroundStyle(Ink.inkFaint)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Ink.inkFaint)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(Ink.paperRaised.opacity(0.6))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Ink.rule, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(day.accessibilityLabel). Show")
    }
}

/// `.sched-entry`: a 3pt rule in the kind's colour, the time right-aligned in a
/// fixed column with the end beneath it, then the title in the serif with the
/// location and note run on after it, dimmed. The photograph, when the bulletin
/// has one, at the end.
private struct EntryRow: View {
    let occurrence: Occurrence

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .trailing, spacing: 1) {
                if occurrence.allDay {
                    Text("ALL DAY")
                        .font(.caption.weight(.semibold))
                        .kerning(0.7)
                        .foregroundStyle(occurrence.kind.timeTone)
                } else {
                    Text(clock(occurrence.startTime))
                        .font(Face.small.weight(.semibold).monospacedDigit())
                        .foregroundStyle(occurrence.kind.timeTone)
                    if let end = occurrence.endTime, end != occurrence.startTime {
                        Text("until \(clock(end))")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(Ink.inkFaint)
                    }
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(width: 74, alignment: .trailing)
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(occurrence.title)
                        .font(Face.display(17, relativeTo: .body))
                        .foregroundStyle(Ink.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if occurrence.source == "manual" {
                        Text("ADDED")
                            .font(.system(size: 10, weight: .semibold))
                            .kerning(0.6)
                            .foregroundStyle(Ink.inkInverse)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(RoundedRectangle(cornerRadius: 4).fill(Ink.gold))
                    }
                }

                let aside = [occurrence.location, occurrence.description].filter { !$0.isEmpty }
                if !aside.isEmpty {
                    Text(aside.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(Ink.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let contact = occurrence.contact, !contact.isEmpty {
                    ContactLine(contact: contact)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let url = occurrence.imageURL {
                Thumb(url: url)
            }
        }
        .padding(.vertical, 6)
        .padding(.leading, 8)
        .padding(.trailing, 2)
        .overlay(alignment: .leading) {
            Rectangle().fill(occurrence.kind.tone).frame(width: 3)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The bulletin's photograph, or nothing at all if it will not load — a grey
/// box would read as the screen having failed rather than as an entry with no
/// picture. Same reasoning as the website's `Thumb`.
private struct Thumb: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Ink.rule, lineWidth: 1))
            case .empty:
                RoundedRectangle(cornerRadius: 6)
                    .fill(Ink.paperSunken)
                    .frame(width: 48, height: 48)
            default:
                EmptyView()
            }
        }
        .accessibilityHidden(true)
    }
}

/// "Servant Michael · (508) 555-0142", with the number dialable.
private struct ContactLine: View {
    let contact: String

    var body: some View {
        let parts = contact.components(separatedBy: " · ")
        HStack(spacing: 0) {
            Text(parts[0])
            if parts.count > 1, let tel = URL(string: "tel:" + parts[1].filter { $0.isNumber || $0 == "+" }) {
                Text(" · ")
                Link(parts[1], destination: tel).foregroundStyle(Ink.accent)
            }
        }
        .font(.caption)
        .foregroundStyle(Ink.inkFaint)
        .lineLimit(1)
    }
}

private struct Legend: View {
    var body: some View {
        // One line when it fits, otherwise two — the website's legend wraps.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 14) {
                key(.liturgy)
                key(.study)
                key(.gathering)
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 14) {
                    key(.liturgy)
                    key(.study)
                }
                key(.gathering)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityHidden(true)
    }

    private func key(_ kind: OccurrenceKind) -> some View {
        HStack(spacing: 5) {
            Circle().fill(kind.tone).frame(width: 8, height: 8)
            Text(kind.legend)
                .font(.caption)
                .foregroundStyle(Ink.inkFaint)
                .fixedSize()
        }
    }
}

/// `formatClock`: "7 PM", "5:30 PM".
private func clock(_ time: String?) -> String {
    guard let time else { return "" }
    let parts = time.split(separator: ":")
    guard parts.count >= 2, let hour = Int(parts[0]) else { return time }
    let minute = String(parts[1])
    let suffix = hour < 12 ? "AM" : "PM"
    let twelve = hour % 12 == 0 ? 12 : hour % 12
    return minute == "00" ? "\(twelve) \(suffix)" : "\(twelve):\(minute) \(suffix)"
}

/* ── The feeds ────────────────────────────────────────────────────────────── */

/// `CalendarOccurrence`, the fields the clip draws. `var` because the merge
/// lets a surviving entry borrow what its displaced twin knew.
struct Occurrence: Decodable {
    var id: String
    var title: String
    var day: String
    var endDay: String
    var startTime: String?
    var endTime: String?
    var allDay: Bool
    var location: String
    var description: String
    var source: String
    var imageUrl: String?
    var contact: String?
    var kindHint: String?

    var kind: OccurrenceKind {
        kindHint.flatMap(OccurrenceKind.init(rawValue:)) ?? .of(title: title)
    }

    var imageURL: URL? {
        guard let imageUrl, !imageUrl.isEmpty else { return nil }
        return URL(string: imageUrl)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, day, endDay, startTime, endTime, allDay, location, description, source, imageUrl, contact, kind
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        day = try c.decode(String.self, forKey: .day)
        endDay = try c.decodeIfPresent(String.self, forKey: .endDay) ?? day
        startTime = try c.decodeIfPresent(String.self, forKey: .startTime)
        endTime = try c.decodeIfPresent(String.self, forKey: .endTime)
        allDay = try c.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
        location = try c.decodeIfPresent(String.self, forKey: .location) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? "parish"
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        contact = try c.decodeIfPresent(String.self, forKey: .contact)
        kindHint = try c.decodeIfPresent(String.self, forKey: .kind)
    }

    /// `bulletinOccurrence`.
    init?(bulletin event: BulletinEvent, day: String, endDay: String) {
        let title = event.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, day.count == 10 else { return nil }

        let start = bulletinTime(event.time)
        id = "bulletin:\(event.sourceId)"
        self.title = title
        self.day = day
        self.endDay = endDay >= day ? endDay : day
        startTime = start
        endTime = bulletinTime(event.timeTo)
        allDay = start == nil
        location = ""
        description = event.notes?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        source = "bulletin"
        let image = event.image?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        imageUrl = image.isEmpty ? nil : image
        contact = event.contacts?.first.map { [$0.name, $0.phone ?? ""].filter { !$0.isEmpty }.joined(separator: " · ") }
        kindHint = nil
    }
}

private struct CalendarFeed: Decodable {
    let occurrences: [Occurrence]
}

struct BulletinEvent: Decodable {
    struct Contact: Decodable {
        let name: String
        let phone: String?
    }

    let sourceId: String
    let name: String
    let time: String?
    let timeTo: String?
    let notes: String?
    let image: String?
    let contacts: [Contact]?
    let startDate: String?
    let endDate: String?
}

private struct BulletinResponse: Decodable {
    struct Bulletin: Decodable {
        struct Day: Decodable {
            let date: String
            let events: [BulletinEvent]
        }

        let days: [Day]
        let multiDayEvents: [BulletinEvent]?
    }

    let bulletin: Bulletin?

    var occurrences: [Occurrence] {
        guard let bulletin else { return [] }
        var all: [Occurrence] = []
        for day in bulletin.days {
            for event in day.events {
                if let o = Occurrence(bulletin: event, day: day.date, endDay: day.date) { all.append(o) }
            }
        }
        for event in bulletin.multiDayEvents ?? [] {
            guard let start = event.startDate else { continue }
            if let o = Occurrence(bulletin: event, day: start, endDay: event.endDate ?? start) { all.append(o) }
        }
        return all
    }
}

/// `bulletinTime`: "5:30pm" → "17:30", "12am" → "00:00", anything else nil.
private func bulletinTime(_ value: String?) -> String? {
    guard let value else { return nil }
    // Swift 5 mode, so no regex literal: `^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$` by hand.
    var text = Substring(value.trimmingCharacters(in: .whitespaces).lowercased())

    let hourDigits = text.prefix { $0.isASCII && $0.isNumber }
    guard (1...2).contains(hourDigits.count), var hour = Int(hourDigits), (1...12).contains(hour) else { return nil }
    text = text.dropFirst(hourDigits.count)

    var minute = "00"
    if text.first == ":" {
        let digits = text.dropFirst().prefix { $0.isASCII && $0.isNumber }
        guard digits.count == 2 else { return nil }
        minute = String(digits)
        text = text.dropFirst(3)
    }

    text = text.drop { $0 == " " }
    guard let half = text.first, half == "a" || half == "p" else { return nil }
    text = text.dropFirst()
    if text.first == "." { text = text.dropFirst() }
    guard text.first == "m" else { return nil }
    text = text.dropFirst()
    if text.first == "." { text = text.dropFirst() }
    guard text.isEmpty else { return nil }

    if half == "p" { hour = hour == 12 ? 12 : hour + 12 } else { hour = hour == 12 ? 0 : hour }
    return String(format: "%02d:%@", hour, minute)
}

/* ── Reconciling the two ──────────────────────────────────────────────────── */

/// `mergeCalendarSources` from @spsm/shared: highest-precedence source first,
/// and an entry that names the same thing in the same slot as one already kept
/// is dropped — after the survivor takes anything it was missing, which is how
/// a Breeze liturgy ends up with the bulletin's photograph.
private enum Merge {
    static let rank: [String: Int] = ["manual": 0, "feature": 1, "bulletin": 2, "parish": 3, "servants": 4]

    static func sources(_ groups: [[Occurrence]]) -> [Occurrence] {
        var seen = Set<String>()
        let all = groups.flatMap { $0 }
            .enumerated()
            .sorted { (rank[$0.element.source] ?? 9, $0.offset) < (rank[$1.element.source] ?? 9, $1.offset) }
            .map(\.element)
            .filter { seen.insert($0.id).inserted }

        var kept: [Occurrence] = []
        for candidate in all {
            if let index = kept.firstIndex(where: { same($0, candidate) }) {
                if kept[index].endTime == nil { kept[index].endTime = candidate.endTime }
                if kept[index].location.isEmpty { kept[index].location = candidate.location }
                if kept[index].description.isEmpty { kept[index].description = candidate.description }
                if kept[index].imageUrl == nil { kept[index].imageUrl = candidate.imageUrl }
                continue
            }
            kept.append(candidate)
        }
        return kept
    }

    private static func same(_ a: Occurrence, _ b: Occurrence) -> Bool {
        if a.source == b.source { return false }
        if a.endDay < b.day || b.endDay < a.day { return false }
        if a.allDay != b.allDay { return false }
        if !a.allDay && !withinSlot(a.startTime, b.startTime) { return false }
        return titlesAgree(a.title, b.title)
    }

    private static func withinSlot(_ a: String?, _ b: String?) -> Bool {
        let at = minutes(a), bt = minutes(b)
        guard let at, let bt else { return at == bt }
        return abs(at - bt) <= 60
    }

    private static func minutes(_ time: String?) -> Int? {
        let parts = time?.split(separator: ":", omittingEmptySubsequences: false) ?? []
        guard parts.count == 2, (1...2).contains(parts[0].count), parts[1].count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return h * 60 + m
    }

    private static let ignored: Set<String> = [
        "the", "and", "for", "of", "a", "an", "in", "at", "to", "with", "on",
        "st", "saint", "spsm", "church",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ]

    private static func significant(_ title: String) -> [String] {
        normalisedWords(title).filter { $0.count > 1 && !ignored.contains($0) }
    }

    private static func titlesAgree(_ a: String, _ b: String) -> Bool {
        let first = significant(a), second = significant(b)
        guard !first.isEmpty, !second.isEmpty else { return false }
        let (shorter, longer) = first.count <= second.count ? (first, second) : (second, first)
        let matched = shorter.filter { word in longer.contains { wordsAgree(word, $0) } }.count
        return matched * 2 >= shorter.count
    }

    private static func wordsAgree(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        if a.count < 4 || b.count < 4 || abs(a.count - b.count) > 1 { return false }
        return editDistanceIsOne(Array(a), Array(b))
    }

    private static func editDistanceIsOne(_ a: [Character], _ b: [Character]) -> Bool {
        let (shorter, longer) = a.count <= b.count ? (a, b) : (b, a)
        var i = 0, j = 0, edits = 0
        while i < shorter.count && j < longer.count {
            if shorter[i] == longer[j] { i += 1; j += 1; continue }
            edits += 1
            if edits > 1 { return false }
            if shorter.count == longer.count { i += 1 }
            j += 1
        }
        return edits + (longer.count - j) <= 1
    }
}

/* ── The week ─────────────────────────────────────────────────────────────── */

struct ScheduleDay {
    let day: String
    let weekday: String
    let shortWeekday: String
    let monthShort: String
    let dateNumber: String
    let isToday: Bool
    let isPast: Bool
    let occurrences: [Occurrence]

    var accessibilityLabel: String {
        let count = occurrences.count
        let things = count == 0 ? "nothing on" : (count == 1 ? "1 entry" : "\(count) entries")
        return "\(weekday) \(monthShort) \(dateNumber)\(isToday ? ", today" : ""), \(things)"
    }
}

/// Monday to Sunday of the week we are in, every day present.
struct ScheduleWeek {
    let rangeLabel: String
    let days: [ScheduleDay]
}

@MainActor
final class ScheduleModel: ObservableObject {
    enum State {
        case loading
        case loaded(ScheduleWeek)
        case failed(String)
    }

    @Published private(set) var state: State = .loading
    private var started = false

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    func load() {
        state = .loading

        Task {
            do {
                state = .loaded(try await fetch())
            } catch {
                /*
                 * One sentence, never a status code. The reader is standing in
                 * a doorway and the only useful question is whether pressing
                 * again might work.
                 */
                state = .failed("The church’s calendar could not be reached. It may be the signal where you are standing.")
            }
        }
    }

    private func fetch() async throws -> ScheduleWeek {
        // The parish's own zone, so "this week" means the church's week rather
        // than the week of whoever is holding the phone. Matches
        // PARISH_TIME_ZONE in @spsm/shared.
        let zone = TimeZone(identifier: "America/New_York")!

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        calendar.firstWeekday = 2 // Monday

        let keyFormat = DateFormatter()
        keyFormat.calendar = calendar
        keyFormat.locale = Locale(identifier: "en_US_POSIX")
        keyFormat.dateFormat = "yyyy-MM-dd"
        keyFormat.timeZone = zone

        let today = calendar.startOfDay(for: Date())
        // .weekday is 1 for Sunday … 7 for Saturday; step back to Monday.
        let sinceMonday = (calendar.component(.weekday, from: today) + 5) % 7
        let monday = calendar.date(byAdding: .day, value: -sinceMonday, to: today)!
        let dates = (0..<7).map { calendar.date(byAdding: .day, value: $0, to: monday)! }
        let keys = dates.map(keyFormat.string)

        var components = URLComponents(url: ClipConfig.api("/api/calendar"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "from", value: keys.first),
            URLQueryItem(name: "to", value: keys.last),
        ]

        // Both at once; only the calendar is required.
        async let calendarData = Self.get(components.url!)
        async let bulletinData = try? Self.get(ClipConfig.api("/api/bulletin"))

        let feed = try JSONDecoder().decode(CalendarFeed.self, from: try await calendarData)
        let bulletin = (await bulletinData).flatMap { try? JSONDecoder().decode(BulletinResponse.self, from: $0) }

        let first = keys[0], last = keys[6]
        let fromBulletin = (bulletin?.occurrences ?? []).filter { $0.day <= last && $0.endDay >= first }
        let merged = Merge.sources([fromBulletin, feed.occurrences])

        return group(merged, dates: dates, keys: keys, today: keyFormat.string(from: today), zone: zone)
    }

    private static func get(_ url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    /// All seven days, Monday first. An entry appears on every day its span
    /// touches, as `groupByDay` does; anything outside the week is dropped by
    /// keying on the seven dates rather than on what came back.
    private func group(
        _ occurrences: [Occurrence],
        dates: [Date],
        keys: [String],
        today: String,
        zone: TimeZone
    ) -> ScheduleWeek {
        func format(_ pattern: String) -> DateFormatter {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US")
            f.dateFormat = pattern
            f.timeZone = zone
            return f
        }
        let weekday = format("EEEE")
        let short = format("EEE")
        let month = format("MMM")
        let number = format("d")

        let days = zip(dates, keys).map { date, key in
            let items = occurrences
                .filter { $0.day <= key && $0.endDay >= key }
                .sorted { lhs, rhs in
                    if lhs.allDay != rhs.allDay { return lhs.allDay }
                    let l = lhs.startTime ?? "", r = rhs.startTime ?? ""
                    if l != r { return l < r }
                    return lhs.title < rhs.title
                }
            return ScheduleDay(
                day: key,
                weekday: weekday.string(from: date),
                shortWeekday: short.string(from: date),
                monthShort: month.string(from: date),
                dateNumber: number.string(from: date),
                isToday: key == today,
                isPast: key < today,
                occurrences: items
            )
        }

        return ScheduleWeek(rangeLabel: Self.rangeLabel(dates[0], dates[6], zone: zone), days: days)
    }

    /// "November 2–8, 2026", or "October 26 – November 1, 2026" across a month.
    private static func rangeLabel(_ start: Date, _ end: Date, zone: TimeZone) -> String {
        let f = DateIntervalFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = zone
        f.dateTemplate = "MMMMdy"
        return f.string(from: start, to: end)
    }
}
