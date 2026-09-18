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

            case .loaded(let days) where days.isEmpty:
                ClipCard {
                    ClipEyebrow(text: "Nothing this week")
                    ClipBody(
                        text: "There is nothing in the church's calendar for the next seven days. The Liturgy still runs on Sunday."
                    )
                }

            case .loaded(let days):
                ForEach(days, id: \.day) { day in
                    ClipCard(spacing: 10) {
                        ClipEyebrow(text: day.heading)
                        ForEach(day.occurrences, id: \.id) { item in
                            OccurrenceRow(occurrence: item)
                            if item.id != day.occurrences.last?.id {
                                Divider().overlay(Ink.rule)
                            }
                        }
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

private struct OccurrenceRow: View {
    let occurrence: Occurrence

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(occurrence.timeLabel)
                .font(Face.small.weight(.semibold))
                .foregroundStyle(Ink.accent)
                .frame(width: 66, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(occurrence.title)
                    .font(Face.body.weight(.medium))
                    .foregroundStyle(Ink.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if !occurrence.location.isEmpty {
                    Text(occurrence.location)
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                }
            }
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
    let occurrences: [Occurrence]
}

@MainActor
final class ScheduleModel: ObservableObject {
    enum State {
        case loading
        case loaded([ScheduleDay])
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
                let days = try await fetch()
                state = .loaded(days)
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

    private func fetch() async throws -> [ScheduleDay] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        // The parish's own zone, so "this week" means the church's week rather
        // than the week of whoever is holding the phone. Matches
        // PARISH_TIME_ZONE in @spsm/shared.
        formatter.timeZone = TimeZone(identifier: "America/New_York")

        let today = Date()
        let from = formatter.string(from: today)
        let to = formatter.string(from: today.addingTimeInterval(7 * 24 * 60 * 60))

        var components = URLComponents(
            url: ClipConfig.api("/api/calendar"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "from", value: from),
            URLQueryItem(name: "to", value: to),
        ]

        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let feed = try JSONDecoder().decode(CalendarFeed.self, from: data)
        return group(feed.occurrences, formatter: formatter)
    }

    /// One card per day, in order, with the days that have nothing left out.
    private func group(_ occurrences: [Occurrence], formatter: DateFormatter) -> [ScheduleDay] {
        let byDay = Dictionary(grouping: occurrences, by: \.day)

        let heading = DateFormatter()
        heading.dateFormat = "EEEE d MMMM"
        heading.timeZone = TimeZone(identifier: "America/New_York")

        return byDay.keys.sorted().compactMap { day in
            guard let items = byDay[day], !items.isEmpty else { return nil }

            let label = formatter.date(from: day).map(heading.string) ?? day
            let sorted = items.sorted { lhs, rhs in
                (lhs.startTime ?? "00:00") < (rhs.startTime ?? "00:00")
            }
            return ScheduleDay(day: day, heading: label, occurrences: sorted)
        }
    }
}
