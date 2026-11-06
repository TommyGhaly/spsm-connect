import SwiftUI

/// `/c/schedule` — what is on at the church this week.
///
/// The most useful of the eight, and the one most worth being native: somebody
/// has tapped a tag in the narthex to find out whether there is a service on
/// Wednesday, and the answer should be on screen before a web page would have
/// finished laying out.
///
/// One `GET /api/calendar?from=&to=`, which is the endpoint the app uses and
/// where the church already merges the bulletin, the parish events and the
/// staff's own entries. The clip reads it unauthenticated, which is what that
/// endpoint serves by default — the servants' rota needs `scope=servants` and a
/// token, and a clip has neither and should not.
struct ScheduleView: View {
    @StateObject private var model = ScheduleModel()

    var body: some View {
        ClipScreen(destination: .schedule) {
            switch model.state {
            case .loading:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Reading the church's calendar…")
                    }
                }

            case .failed(let message):
                ClipProblem(message: message) { model.load() }

            case .loaded(let week):
                WeekStrip(week: week)

                if week.busyDays.isEmpty {
                    ClipCard {
                        ClipEyebrow(text: "Nothing this week")
                        ClipBody(
                            text: "There is nothing in the church's calendar between Monday and Sunday. The Liturgy still runs on Sunday."
                        )
                    }
                } else {
                    ForEach(week.busyDays, id: \.day) { day in
                        DayCard(day: day)
                    }
                }
            }

            ClipFooter(
                destination: .schedule,
                readMore: "The church's calendar has the whole month, and every event's own page."
            )
        }
        .task { model.loadIfNeeded() }
    }
}

/// Seven chips, Monday to Sunday, so the shape of the week reads at a glance:
/// which days have something on, and where today falls among them.
private struct WeekStrip: View {
    let week: ScheduleWeek

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(week.rangeLabel.uppercased())
                .font(Face.label)
                .kerning(0.8)
                .foregroundStyle(Ink.inkInverse.opacity(0.85))

            HStack(spacing: 6) {
                ForEach(week.days, id: \.day) { day in
                    DayChip(day: day)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(
                colors: [Ink.deep, Ink.accentStrong],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Ink.gold.opacity(0.6), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct DayChip: View {
    let day: ScheduleDay

    var body: some View {
        VStack(spacing: 4) {
            Text(day.initial)
                .font(Face.label)
                .foregroundStyle(day.isToday ? Ink.deep : Ink.inkInverse.opacity(0.75))
            Text(day.dateNumber)
                .font(Face.displayBold(17, relativeTo: .headline))
                .foregroundStyle(day.isToday ? Ink.deep : Ink.inkInverse)
            Circle()
                .fill(day.occurrences.isEmpty ? Color.clear : (day.isToday ? Ink.deep : Ink.gold))
                .frame(width: 6, height: 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(day.isToday ? Ink.gold : Ink.inkInverse.opacity(0.08))
        )
        .opacity(day.isPast ? 0.6 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.accessibilityLabel)
    }
}

/// One day's card: a maroon band along the top (the church's red for today),
/// and each entry's time in a pill of the accent.
private struct DayCard: View {
    let day: ScheduleDay

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(day.heading.uppercased())
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.inkInverse)
                Spacer(minLength: 0)
                if day.isToday {
                    Text("TODAY")
                        .font(Face.label)
                        .kerning(0.8)
                        .foregroundStyle(Ink.deep)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Ink.gold))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(day.isToday ? Ink.accent : Ink.deep)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(day.occurrences, id: \.id) { item in
                    OccurrenceRow(occurrence: item)
                    if item.id != day.occurrences.last?.id {
                        Divider().overlay(Ink.rule)
                    }
                }
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.paperRaised)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(day.isToday ? Ink.gold : Ink.rule, lineWidth: day.isToday ? 2 : 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .opacity(day.isPast ? 0.85 : 1)
    }
}

private struct OccurrenceRow: View {
    let occurrence: Occurrence

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(occurrence.timeLabel)
                .font(Face.small.weight(.semibold))
                .foregroundStyle(Ink.accent)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule().fill(Ink.accentSoft))
                .frame(width: 84, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(occurrence.title)
                    .font(Face.body.weight(.medium))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if !occurrence.location.isEmpty {
                    Label(occurrence.location, systemImage: "mappin.and.ellipse")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                        .labelStyle(.titleAndIcon)
                }
            }
            .padding(.top, 3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/* ── The feed ─────────────────────────────────────────────────────────────── */

struct Occurrence: Decodable {
    let id: String
    let title: String
    let day: String
    let startTime: String?
    let allDay: Bool
    let location: String

    /// What the row shows in its left column.
    var timeLabel: String {
        guard !allDay, let startTime, startTime.count >= 4 else { return "All day" }

        let parts = startTime.split(separator: ":")
        guard let hour = Int(parts.first ?? ""), parts.count >= 2 else { return startTime }

        let minute = String(parts[1])
        let suffix = hour < 12 ? "am" : "pm"
        let twelve = hour % 12 == 0 ? 12 : hour % 12
        return minute == "00" ? "\(twelve)\(suffix)" : "\(twelve):\(minute)\(suffix)"
    }
}

private struct CalendarFeed: Decodable {
    let occurrences: [Occurrence]
}

struct ScheduleDay {
    let day: String
    let heading: String
    let initial: String
    let dateNumber: String
    let isToday: Bool
    let isPast: Bool
    let occurrences: [Occurrence]

    var accessibilityLabel: String {
        let count = occurrences.count
        let things = count == 0 ? "nothing on" : (count == 1 ? "1 entry" : "\(count) entries")
        return "\(heading)\(isToday ? ", today" : ""), \(things)"
    }
}

/// Monday to Sunday of the week we are in, every day present so the strip can
/// draw all seven.
struct ScheduleWeek {
    let rangeLabel: String
    let days: [ScheduleDay]

    var busyDays: [ScheduleDay] { days.filter { !$0.occurrences.isEmpty } }
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
                let week = try await fetch()
                state = .loaded(week)
            } catch {
                /*
                 * One sentence, never a status code. The same rule the app's
                 * `upload/errors.ts` follows: the reader is standing in a
                 * doorway and the only useful question is whether pressing
                 * again might work.
                 */
                state = .failed("The church's calendar could not be reached. It may be the signal where you are standing.")
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

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = zone

        let now = Date()
        let today = calendar.startOfDay(for: now)
        // .weekday is 1 for Sunday … 7 for Saturday; step back to Monday.
        let sinceMonday = (calendar.component(.weekday, from: today) + 5) % 7
        let monday = calendar.date(byAdding: .day, value: -sinceMonday, to: today)!
        let dates = (0..<7).map { calendar.date(byAdding: .day, value: $0, to: monday)! }
        let keys = dates.map(formatter.string)

        var components = URLComponents(
            url: ClipConfig.api("/api/calendar"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "from", value: keys.first),
            URLQueryItem(name: "to", value: keys.last),
        ]

        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let feed = try JSONDecoder().decode(CalendarFeed.self, from: data)
        return group(feed.occurrences, dates: dates, keys: keys, today: formatter.string(from: today), zone: zone)
    }

    /// All seven days, Monday first. Anything the feed returns outside the
    /// week — however the endpoint treats `to` — is dropped by keying on the
    /// seven dates rather than on what came back.
    private func group(
        _ occurrences: [Occurrence],
        dates: [Date],
        keys: [String],
        today: String,
        zone: TimeZone
    ) -> ScheduleWeek {
        let byDay = Dictionary(grouping: occurrences, by: \.day)

        func format(_ pattern: String) -> DateFormatter {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US")
            f.dateFormat = pattern
            f.timeZone = zone
            return f
        }
        let heading = format("EEEE d MMMM")
        let initial = format("EEEEE")
        let number = format("d")
        let range = format("d MMMM")

        let days = zip(dates, keys).map { date, key in
            let items = (byDay[key] ?? []).sorted { lhs, rhs in
                (lhs.startTime ?? "00:00") < (rhs.startTime ?? "00:00")
            }
            return ScheduleDay(
                day: key,
                heading: heading.string(from: date),
                initial: initial.string(from: date),
                dateNumber: number.string(from: date),
                isToday: key == today,
                isPast: key < today,
                occurrences: items
            )
        }

        let label = "This week · \(range.string(from: dates[0])) – \(range.string(from: dates[6]))"
        return ScheduleWeek(rangeLabel: label, days: days)
    }
}
