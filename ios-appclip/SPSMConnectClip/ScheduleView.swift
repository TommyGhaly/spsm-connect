import SwiftUI

/// `/c/schedule` — what is on at the church this week.
///
/// The most useful of the eight, and the one most worth being native: somebody
/// has tapped a tag in the narthex to find out whether there is a service on
/// Wednesday, and the answer should be on screen before a web page would have
/// finished laying out.
///
/// Drawn the way the website's week view is (`features/calendar/WeekView.tsx`
/// and the `.sched-*` rules in globals.css): a wheel you turn up and down a day
/// at a time, the centred day a card and its neighbours a one-line peek, with
/// the week's dates across the top as tabs. Each card has the weekday in
/// the serif and the date on the right, and each entry a time column and a
/// title, with a left rule in the colour of what the thing *is* — liturgical
/// red, teaching gold, gatherings azure. The bulletin's photograph sits at the
/// end of the row, as on the website's wide layout.
///
/// Two reads, the same two the website's calendar makes:
///
/// - `GET /api/bulletin` — the active announcements sheet. Read first, because
///   it decides *which* week is shown: the website's homepage shows whichever
///   bulletin is active, and staff put next week's up before this one is over,
///   so the clip shows the sheet's week rather than the calendar week. Optional:
///   if it fails, the clip falls back to the week we are in.
/// - `GET /api/calendar?from=&to=` — Breeze, merged server-side with the
///   parish's own entries, for that week. Unauthenticated, which is what that
///   endpoint serves by default; the servants' rota needs a token, and a clip
///   has none.
///
/// Re-read every minute while on screen and on every return to the clip, as the
/// website's homepage does, so a sheet made active meanwhile appears without
/// relaunching.
///
/// The two describe the same week under slightly different names, so they are
/// reconciled with a port of `mergeCalendarSources` from @spsm/shared, or every
/// liturgy would appear twice.
struct ScheduleView: View {
    @StateObject private var model = ScheduleModel()
    @StateObject private var month = ScheduleMonthModel()
    /// Week first, as the app opens: the week is the view a phone can finish a
    /// question in. The month is one tap away.
    @State private var mode: ScheduleMode = .week
    /// The day in the middle of the wheel. `nil` until the week arrives, then
    /// today — or the week's first day, for a week today is not in.
    @State private var centred: Int?
    /// The month's day open in the sheet, by `yyyy-MM-dd`.
    @State private var sheetDay: String?

    var body: some View {
        GeometryReader { screen in
        ClipScreen(destination: .schedule) {
            VStack(alignment: .leading, spacing: 16) {
                ModeSwitch(mode: $mode)

                switch mode {
                case .week:
                    weekBody(screenBottom: screen.frame(in: .global).maxY)
                case .month:
                    monthBody
                }
            }
        }
        }
        .task { model.loadIfNeeded() }
        // The website's `POLL_MS`. Cancelled with the view, so a clip that has
        // been put away stops asking.
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                if Task.isCancelled { break }
                await model.refresh()
                await month.refresh()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task {
                await model.refresh()
                await month.refresh()
            }
        }
        .onChange(of: mode) { next in
            // The month the week is in, the first time it is asked for; after
            // that, whichever month the reader stepped to.
            if next == .month { month.show(monthOf: openingDay) }
        }
        .onChange(of: month.anchor) { _ in sheetDay = nil }
        .sheet(isPresented: Binding(
            get: { sheetDay != nil },
            set: { if !$0 { sheetDay = nil } }
        )) {
            if case .loaded(let shown) = month.state, let day = sheetDay {
                DaySheet(days: shown.days, monthKey: shown.monthKey, day: Binding(
                    get: { day },
                    set: { sheetDay = $0 }
                )) { sheetDay = nil }
            }
        }
    }

    /// The day the week opens on, which decides the month the month view opens
    /// on: today, or the bulletin's first day for a sheet today is not in.
    private var openingDay: String? {
        guard case .loaded(let week) = model.state else { return nil }
        return week.days[week.opensOn].day
    }

    @ViewBuilder
    private func weekBody(screenBottom: CGFloat) -> some View {
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
            let index = min(centred ?? week.opensOn, week.days.count - 1)

            // The dates across the top are the wheel's tabs: the
            // website hangs pips down the side instead, but on a
            // phone that costs the cards the width their pictures
            // need, and this strip was already here saying the same.
            WeekHeader(week: week, centred: index) { picked in
                withAnimation(.spring(response: 0.4, dampingFraction: 0.86)) {
                    centred = picked
                }
            }

            DayWheel(days: week.days, centred: Binding(
                get: { index },
                set: { centred = $0 }
            ), screenBottom: screenBottom)

            Legend()
        }
    }

    @ViewBuilder
    private var monthBody: some View {
        MonthHeader(label: month.label) { month.step($0) }

        switch month.state {
        case .idle, .loading:
            ClipCard {
                HStack(spacing: 10) {
                    ProgressView().tint(Ink.accent)
                    ClipBody(text: "Reading the church’s calendar…")
                }
            }

        case .failed(let message):
            ClipProblem(message: message) { month.reload() }

        case .loaded(let shown):
            MonthGrid(month: shown, picked: sheetDay) { sheetDay = $0 }
            Legend()
        }
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
    let centred: Int
    let onPick: (Int) -> Void

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
                    ForEach(Array(week.days.enumerated()), id: \.element.day) { index, day in
                        Button { onPick(index) } label: { DayPip(day: day, isCentred: index == centred) }
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
    /// The day the wheel is on: a solid red disc with the date in white, so the
    /// tab follows the wheel in one mark rather than an outline. Today, when
    /// it is not that day, is its date in bold red — how the phone's own
    /// Calendar marks it — so a turned wheel never loses where today went and
    /// the two never look alike.
    let isCentred: Bool

    var body: some View {
        VStack(spacing: 5) {
            Text(day.dateNumber)
                .font(.headline.monospacedDigit().weight(isCentred || day.isToday ? .bold : .semibold))
                .foregroundStyle(isCentred ? Ink.inkInverse : (day.isToday ? Ink.accent : Ink.ink))
                .frame(width: 34, height: 34)
                .background(Circle().fill(isCentred ? Ink.accent : Color.clear))
                .animation(.easeOut(duration: 0.15), value: isCentred)

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
        .accessibilityAddTraits(isCentred ? [.isButton, .isSelected] : .isButton)
    }
}

/* ── A day ────────────────────────────────────────────────────────────────── */

/// `.sched-wheel__card`: raised paper, a hairline, 16pt corners, and for today
/// a red edge down the left and the weekday in red.
private struct DayCard: View {
    let day: ScheduleDay
    /// How far the entries are scrolled, inside a wheel slot too short for
    /// the whole day. The heading stays put, as `.sched-wheel__list` scrolls
    /// under the website's.
    var scroll: CGFloat = 0
    /// How far the entries *can* scroll: 0 for a day that fits, which then
    /// shows no bar and no "More".
    var overflow: CGFloat = 0

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
                // Its own full height whatever the slot offers, so a short
                // slot clips the list rather than squeezing the titles.
                .fixedSize(horizontal: false, vertical: true)
                .offset(y: -scroll)
                // `minHeight: 0`, or the frame is never smaller than the list
                // and nothing clips: the card draws at full height and spills
                // out of its slot.
                .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
                .clipped()
                .overlay { if overflow > 1 { ScrollCue(scroll: scroll, overflow: overflow) } }
            }
        }
        .padding(.top, 10)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        // Fills its wheel slot, which is as tall as the week's busiest day.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

/* ── The wheel ────────────────────────────────────────────────────────────── */

/// `WeekView`'s wheel: one day centred and whole, the day either side tilted
/// away, faded, and folded to a line at the edge nearest the middle.
///
/// Every slot is as tall as the busiest day, as `grid-auto-rows: 1fr` makes
/// them on the website — otherwise centring a day would resize it and move
/// everything else. Here that height is read off a hidden stack of all seven
/// cards, which is exactly as tall as the tallest.
///
/// Turned by a drag rather than a `ScrollView`: paging scroll views are iOS 17
/// and the clip runs on 16.4, and a drag gives the website's
/// `scroll-snap-stop: always` directly — one day per flick, however hard.
private struct DayWheel: View {
    let days: [ScheduleDay]
    @Binding var centred: Int
    /// The bottom of the screen, in global space, so the wheel can stop short
    /// of it rather than run off the end.
    let screenBottom: CGFloat

    /// Each day's card at its full height, by `day`.
    @State private var natural: [String: CGFloat] = [:]
    /// Where the wheel's top sat when it first appeared.
    @State private var top: CGFloat?
    @State private var drag: CGFloat = 0
    /// How far the centred day's entries are scrolled.
    @State private var scroll: CGFloat = 0
    @State private var scrollAtStart: CGFloat?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How much of the day above and below shows: one folded line.
    private let peek: CGFloat = 40
    /// Kept clear at the foot for the system's "Get the full app" banner,
    /// which `ClipScreen` puts up over every screen but /c/apps.
    private let banner: CGFloat = 140

    var body: some View {
        ZStack(alignment: .top) {
            // The sizer: never seen, only measured.
            ZStack {
                ForEach(days, id: \.day) { day in
                    // Each card at its *own* height. Without this the ZStack
                    // lays every card out again at its own size — the
                    // tallest's — and all seven measure as the busiest day,
                    // so a three-service Tuesday scrolled for nothing.
                    DayCard(day: day)
                        .fixedSize(horizontal: false, vertical: true)
                        .background(GeometryReader { proxy in
                            Color.clear.preference(key: CardHeights.self, value: [day.day: proxy.size.height])
                        })
                }
            }
            // Natural height, whatever the frame below offers: a card offered
            // nothing would measure as nothing.
            .fixedSize(horizontal: false, vertical: true)
            .hidden()
            .accessibilityHidden(true)
            .frame(height: 0, alignment: .top)

            if slot > 0 { wheel }
        }
        .frame(height: slot > 0 ? slot + 2 * peek : nil)
        .background(GeometryReader { proxy in
            Color.clear.onAppear { top = proxy.frame(in: .global).minY }
        })
        .onPreferenceChange(CardHeights.self) { natural = $0 }
        .onChange(of: centred) { _ in scroll = 0 }
    }

    /// One slot's height. As tall as the busiest day, the way the website's
    /// `grid-auto-rows: 1fr` makes it, but never taller than the room between
    /// the wheel's top and the banner — past that a day scrolls inside its
    /// card, as `.sched-wheel__list` does under `max-height`.
    private var slot: CGFloat {
        let busiest = natural.values.max() ?? 0
        guard busiest > 0 else { return 0 }
        guard let top else { return busiest }
        let room = screenBottom - top - banner - 2 * peek
        return min(busiest, max(room, 240))
    }

    /// How far a day's entries can scroll in a slot this tall.
    private func overflow(_ index: Int) -> CGFloat {
        guard days.indices.contains(index) else { return 0 }
        return max(0, (natural[days[index].day] ?? 0) - slot)
    }

    /// Where the wheel is, in days, with the finger's pull included — 2.4 is
    /// Wednesday, most of the way to Thursday.
    private var position: CGFloat {
        CGFloat(centred) - drag / slot
    }

    private var wheel: some View {
        let height = slot + 2 * peek

        return VStack(spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.element.day) { index, day in
                let distance = CGFloat(index) - position
                let depth = min(abs(distance), 3)
                let isCentred = abs(distance) < 0.5
                let own = index == centred ? scroll : 0

                ZStack {
                    DayCard(day: day, scroll: own, overflow: overflow(index))
                        .opacity(isCentred ? 1 : 0)
                        .allowsHitTesting(isCentred)
                    WheelPeek(day: day)
                        .frame(maxHeight: .infinity, alignment: distance < 0 ? .bottom : .top)
                        .opacity(isCentred ? 0 : 1)
                }
                .frame(height: slot)
                .rotation3DEffect(
                    .degrees(reduceMotion ? 0 : Double(distance) * -14),
                    axis: (x: 1, y: 0, z: 0),
                    perspective: 0.35
                )
                .scaleEffect(reduceMotion ? 1 : 1 - depth * 0.04)
                // The neighbours a step down from the card, not a ghost of it:
                // 0.85 one day out, so their dates read at a glance.
                .opacity(max(0.3, 1 - Double(depth) * 0.15))
                .accessibilityHidden(!isCentred)
            }
        }
        .offset(y: peek - position * slot)
        .frame(height: height, alignment: .top)
        .frame(maxWidth: .infinity)
        // Fades out at both ends instead of stopping square: most of what
        // makes a picker read as a wheel rather than a list in a box. Only
        // the outer edge of each peek, though — fading across the whole of
        // it left the neighbouring days too faint to read.
        .mask(LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: .black, location: peek * 0.35 / height),
                .init(color: .black, location: 1 - peek * 0.35 / height),
                .init(color: .clear, location: 1),
            ],
            startPoint: .top, endPoint: .bottom
        ))
        // The selection band: two gold hairlines around the centred slot.
        .background(alignment: .top) {
            VStack(spacing: 0) {
                Rectangle().fill(Ink.gold.opacity(0.4)).frame(height: 1)
                Spacer(minLength: 0)
                Rectangle().fill(Ink.gold.opacity(0.4)).frame(height: 1)
            }
            .frame(height: slot)
            .padding(.top, peek)
        }
        .contentShape(Rectangle())
        // One drag does both jobs, in the order the website's nested scroll
        // chains them: it scrolls a long day's entries to their end first, and
        // only what is left over turns the wheel. Two gestures would fight —
        // a scroll view inside a dragged wheel never gets the touch.
        .highPriorityGesture(
            DragGesture(minimumDistance: 8)
                .onChanged { value in
                    let start = scrollAtStart ?? scroll
                    scrollAtStart = start
                    let limit = overflow(centred)
                    let wanted = start - value.translation.height
                    // A drag that began mid-list only rubber-bands at its end;
                    // turning the day takes a fresh drag from there.
                    let fromTop = start <= 0.5
                    let fromEnd = start >= limit - 0.5

                    if wanted < 0 {
                        scroll = 0
                        drag = centred == 0 || !fromTop ? -wanted * 0.35 : -wanted
                    } else if wanted > limit {
                        scroll = limit
                        let pull = -(wanted - limit)
                        drag = centred == days.count - 1 || !fromEnd ? pull * 0.35 : pull
                    } else {
                        scroll = wanted
                        drag = 0
                    }
                }
                .onEnded { value in
                    let start = scrollAtStart ?? scroll
                    scrollAtStart = nil
                    let limit = overflow(centred)
                    let landing = start - value.predictedEndTranslation.height
                    let threshold = min(slot * 0.25, 60)

                    var next = centred
                    var settle = min(max(landing, 0), limit)
                    // Only a pull past the end of the list turns the day, and
                    // only from a drag that started there — so a flick through
                    // Monday's services stops at the last one, as momentum in
                    // the website's inner list stops at its end.
                    if start >= limit - 0.5, landing - limit > threshold {
                        next += 1
                        settle = 0
                    } else if start <= 0.5, -landing > threshold {
                        next -= 1
                        settle = 0
                    }
                    next = max(0, min(days.count - 1, next))
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.86)) {
                        centred = next
                        drag = 0
                        scroll = settle
                    }
                }
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Day by day")
        .accessibilityHint("Swipe up or down with three fingers to change day")
        .accessibilityScrollAction { edge in
            withAnimation {
                if edge == .bottom { centred = min(days.count - 1, centred + 1) }
                if edge == .top { centred = max(0, centred - 1) }
            }
        }
    }
}

private struct CardHeights: PreferenceKey {
    static var defaultValue: [String: CGFloat] = [:]
    static func reduce(value: inout [String: CGFloat], nextValue: () -> [String: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: max)
    }
}

/// A day above or below the centre: its date, Today if it is, and a dot per
/// entry — a position indicator, not a second schedule, so no titles.
private struct WheelPeek: View {
    let day: ScheduleDay

    var body: some View {
        HStack(spacing: 8) {
            Text("\(day.shortWeekday.uppercased()) \(day.dateNumber)")
                .font(Face.label.monospacedDigit())
                .kerning(0.8)
                .foregroundStyle(day.isToday ? Ink.accent : Ink.inkSoft)

            if day.isToday {
                Text("TODAY")
                    .font(.system(size: 10, weight: .semibold))
                    .kerning(0.6)
                    .foregroundStyle(Ink.inkInverse)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Capsule().fill(Ink.accent))
            }

            if day.occurrences.isEmpty {
                Text("Nothing scheduled")
                    .font(.caption)
                    .foregroundStyle(Ink.inkSoft)
            } else {
                HStack(spacing: 3) {
                    ForEach(Array(day.occurrences.enumerated()), id: \.offset) { _, item in
                        Circle().fill(item.kind.tone).frame(width: 6, height: 6)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

/// `.sched-entry`: a 3pt rule in the kind's colour, the time right-aligned in a
/// fixed column with the end beneath it, then the title in the serif with the
/// location and note run on after it, dimmed. The photograph, when the bulletin
/// has one, at the end.
private struct EntryRow: View {
    let occurrence: Occurrence
    /// The picture's box: larger in the month's day sheet, which has the room.
    var thumb: CGFloat = Thumb.box

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
                Thumb(url: url, box: thumb)
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

/// What says a day's list scrolls, drawn only on a day that does.
///
/// The website leaves this to the browser's own scrollbar. A drag-driven list
/// has none, and a card cut off at its foot otherwise looks like a card that
/// ends there — so: a fade under the last visible row, a "More" pill until the
/// last service is in view, a fade under the heading once the first has gone
/// up, and a thin bar down the right edge, always shown, saying how much is
/// left and where you are in it.
private struct ScrollCue: View {
    let scroll: CGFloat
    let overflow: CGFloat

    var body: some View {
        GeometryReader { proxy in
            let visible = proxy.size.height
            let progress = min(max(scroll / overflow, 0), 1)
            let thumb = max(28, visible * visible / (visible + overflow))
            let atEnd = progress > 0.98

            ZStack {
                VStack(spacing: 0) {
                    LinearGradient(colors: [Ink.paperRaised, Ink.paperRaised.opacity(0)], startPoint: .top, endPoint: .bottom)
                        .frame(height: 18)
                        .opacity(progress > 0.02 ? 1 : 0)
                    Spacer(minLength: 0)
                    LinearGradient(colors: [Ink.paperRaised.opacity(0), Ink.paperRaised], startPoint: .top, endPoint: .bottom)
                        .frame(height: 44)
                        .opacity(atEnd ? 0 : 1)
                }

                HStack(spacing: 4) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                    Text("More")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(Ink.accent)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Ink.paperRaised))
                .overlay(Capsule().strokeBorder(Ink.accent.opacity(0.35), lineWidth: 1))
                .shadow(color: Color(hex: 0x1C1614).opacity(0.1), radius: 3, y: 1)
                .frame(maxHeight: .infinity, alignment: .bottom)
                .padding(.bottom, 4)
                .opacity(atEnd ? 0 : 1)

                // The bar sits in the card's right margin, clear of the
                // pictures.
                ZStack(alignment: .top) {
                    Capsule().fill(Ink.rule.opacity(0.6))
                    Capsule().fill(Ink.accent.opacity(0.75))
                        .frame(height: thumb)
                        .offset(y: progress * (visible - thumb))
                }
                .frame(width: 3)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .offset(x: 10)
            }
            .animation(.easeOut(duration: 0.2), value: atEnd)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The bulletin's photograph, at its own shape, in a fixed box.
///
/// `.week__thumb` on the website: the parish's pictures run from tall icons to
/// wide flyers, and a square at `fill` cut most of them in half. So the box is
/// fixed — it keeps the times lined up down the day and stops a tall icon
/// making its row tall — and the picture is scaled to *fit* inside it, with
/// the corners and hairline on the picture itself so they trace its real edge.
///
/// Nothing at all if it will not load: a grey box would read as the screen
/// having failed rather than as an entry with no picture.
private struct Thumb: View {
    let url: URL
    var box: CGFloat = Thumb.box

    /// 56pt: no taller than a two-line title, so a picture never sets the
    /// row's height, and large enough that a wide flyer fitted into it is
    /// still readable as a picture.
    static let box: CGFloat = 56

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                    .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Ink.ink.opacity(0.12), lineWidth: 1))
            case .empty:
                RoundedRectangle(cornerRadius: 5)
                    .fill(Ink.paperSunken)
            default:
                EmptyView()
            }
        }
        .frame(width: box, height: box)
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

    /// The first day on the sheet, if it has a well-formed one.
    var firstDay: String? {
        bulletin?.days.map(\.date).filter { $0.count == 10 }.min()
    }

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

/// The bulletin's week (or, without one, Monday to Sunday of the week we are
/// in), every day present.
struct ScheduleWeek {
    let rangeLabel: String
    let days: [ScheduleDay]

    /// Where the wheel opens: today, or the first day of a week today is not in.
    var opensOn: Int {
        days.firstIndex(where: \.isToday) ?? 0
    }

    /// Enough to tell whether a re-read changed anything worth redrawing.
    var signature: String {
        days.map { day in
            day.day + (day.isToday ? "*" : "") + day.occurrences
                .map { [$0.id, $0.title, $0.startTime ?? "", $0.endTime ?? "", $0.location, $0.description, $0.imageUrl ?? ""].joined(separator: "|") }
                .joined(separator: ";")
        }.joined(separator: "/")
    }
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

    /// A quiet re-read: replaces what is on screen only when the new answer
    /// arrived and differs, and never shows the spinner or an error over a week
    /// that is already there.
    func refresh() async {
        guard case .loaded(let current) = state, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        guard let next = try? await fetch() else { return }
        if next.signature != current.signature { state = .loaded(next) }
    }

    private var refreshing = false

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
        let todayKey = keyFormat.string(from: today)

        // The sheet first: it says which week to ask the calendar for.
        let bulletin = (try? await Self.get(ClipConfig.api("/api/bulletin")))
            .flatMap { try? JSONDecoder().decode(BulletinResponse.self, from: $0) }

        let start: Date
        if let first = bulletin?.firstDay, let firstDate = keyFormat.date(from: first) {
            // The sheet's own seven days, starting on its first one, however
            // far that is from today — the website's homepage does the same.
            start = firstDate
        } else {
            // .weekday is 1 for Sunday … 7 for Saturday; step back to Monday.
            let sinceMonday = (calendar.component(.weekday, from: today) + 5) % 7
            start = calendar.date(byAdding: .day, value: -sinceMonday, to: today)!
        }
        let dates = (0..<7).map { calendar.date(byAdding: .day, value: $0, to: start)! }
        let keys = dates.map(keyFormat.string)

        var components = URLComponents(url: ClipConfig.api("/api/calendar"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "from", value: keys.first),
            URLQueryItem(name: "to", value: keys.last),
        ]

        // Only the calendar is required.
        let feed = try JSONDecoder().decode(CalendarFeed.self, from: try await Self.get(components.url!))

        let first = keys[0], last = keys[6]
        let fromBulletin = (bulletin?.occurrences ?? []).filter { $0.day <= last && $0.endDay >= first }
        let merged = Merge.sources([fromBulletin, feed.occurrences])

        return group(merged, dates: dates, keys: keys, today: todayKey, zone: zone)
    }

    fileprivate static func get(_ url: URL) async throws -> Data {
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
        let days = Self.days(occurrences, dates: dates, keys: keys, today: today, zone: zone)
        return ScheduleWeek(rangeLabel: Self.rangeLabel(dates[0], dates[6], zone: zone), days: days)
    }

    /// Every date asked for, each with what is on it — shared by the week and
    /// the month, so the two cannot disagree about a day.
    fileprivate static func days(
        _ occurrences: [Occurrence],
        dates: [Date],
        keys: [String],
        today: String,
        zone: TimeZone
    ) -> [ScheduleDay] {
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

        return zip(dates, keys).map { date, key in
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

/* ── The month ────────────────────────────────────────────────────────────── */

/// Week or month. The clip opens on the week, as the app does.
enum ScheduleMode: Hashable {
    case week, month
}

/// The app's `ViewSwitch`: a pill riding on a sunken track, the chosen half in
/// the accent.
private struct ModeSwitch: View {
    @Binding var mode: ScheduleMode

    var body: some View {
        HStack(spacing: 0) {
            option(.week, "Week")
            option(.month, "Month")
        }
        .padding(2)
        .background(Capsule().fill(Ink.paperSunken))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Calendar view")
    }

    private func option(_ value: ScheduleMode, _ title: String) -> some View {
        let on = mode == value
        return Button {
            withAnimation(.easeOut(duration: 0.15)) { mode = value }
        } label: {
            Text(title)
                .font(Face.small.weight(on ? .semibold : .regular))
                .foregroundStyle(on ? Ink.inkInverse : Ink.ink)
                .padding(.horizontal, 16)
                .frame(minWidth: 44, minHeight: 34)
                .background(Capsule().fill(on ? Ink.accent : Color.clear))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }
}

/// The month between its arrows, as the website's stepper sets it.
private struct MonthHeader: View {
    let label: String
    let onStep: (Int) -> Void

    var body: some View {
        HStack(spacing: 8) {
            arrow("chevron.left", "Previous month", -1)
            Text(label)
                .font(Face.display(22, relativeTo: .title2))
                .foregroundStyle(Ink.ink)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)
            arrow("chevron.right", "Next month", 1)
        }
    }

    private func arrow(_ symbol: String, _ name: String, _ by: Int) -> some View {
        Button { onStep(by) } label: {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Ink.accent)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(name)
    }
}

/// `MonthView`: a date and one dot per entry in each cell, and nothing else —
/// enough to see that Saturdays are heavy and where the liturgies fall. A day
/// with something on it is a button that raises the day sheet; an empty one
/// is not, because pressing it to be told "nothing" a second time is a
/// control with no work to do.
private struct MonthGrid: View {
    let month: ScheduleMonth
    let picked: String?
    let onPick: (String) -> Void

    /// Monday first, matching `WEEK_STARTS_ON` in @spsm/shared and the dates
    /// the model pads the month out with.
    private let weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { name in
                    Text(name)
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
            .accessibilityHidden(true)

            VStack(spacing: 2) {
                ForEach(0..<(month.days.count / 7), id: \.self) { row in
                    HStack(spacing: 2) {
                        ForEach(month.days[(row * 7)..<(row * 7 + 7)], id: \.day) { day in
                            MonthCell(
                                day: day,
                                inMonth: day.day.hasPrefix(month.monthKey),
                                isPicked: day.day == picked
                            ) { onPick(day.day) }
                        }
                    }
                }
            }
        }
    }
}

private struct MonthCell: View {
    let day: ScheduleDay
    let inMonth: Bool
    /// The day the sheet is about, ringed rather than filled: today is already
    /// the filled disc, and a second filled thing would read as a second today.
    let isPicked: Bool
    let onPick: () -> Void

    var body: some View {
        if day.occurrences.isEmpty {
            face
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(day.accessibilityLabel)
        } else {
            Button(action: onPick) { face }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(day.accessibilityLabel)
                .accessibilityHint("Opens the day")
                .accessibilityAddTraits(.isButton)
        }
    }

    private var face: some View {
        VStack(spacing: 4) {
            Text(day.dateNumber)
                .font(.footnote.monospacedDigit().weight(day.isToday ? .bold : .medium))
                .foregroundStyle(day.isToday ? Ink.inkInverse : (inMonth ? Ink.ink : Ink.inkFaint))
                .frame(width: 26, height: 26)
                .background(Circle().fill(day.isToday ? Ink.accent : Color.clear))

            HStack(spacing: 2) {
                ForEach(Array(day.occurrences.prefix(3).enumerated()), id: \.offset) { _, item in
                    Circle().fill(item.kind.tone).frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
        }
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, minHeight: 54, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 6).fill(inMonth ? Ink.paperRaised : Color.clear))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .strokeBorder(Ink.accent, lineWidth: isPicked ? 1.5 : 0)
        )
        .contentShape(Rectangle())
    }
}

/* ── The day sheet ────────────────────────────────────────────────────────── */

/// The website's `DaySheet`: one day of the month, risen from the foot of the
/// screen, so the answer to a tap is where the thumb already is rather than a
/// scroll below the grid.
///
/// The system's own sheet, which gives the handle, the pull to put it away and
/// the dimmed grid behind for nothing, opened at about three quarters of the
/// screen (the website's `min(74dvh, 46rem)`) and pullable to nine tenths.
/// Along its top, the day's week as a strip of dates to hop between; the list
/// below swipes sideways a day at a time, across the whole padded month the
/// grid is drawing, so past Sunday is next week's Monday and the strip follows.
private struct DaySheet: View {
    let days: [ScheduleDay]
    let monthKey: String
    @Binding var day: String
    let onShut: () -> Void

    /// The side the new day comes in from: the way the reader moved.
    @State private var cameFromTrailing = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The sheet's pictures, given the room every narrower list on a phone
    /// does not have — `.sched-daysheet .sched-entry__thumb`'s 5.5rem.
    private let thumb: CGFloat = 88

    private var index: Int { days.firstIndex { $0.day == day } ?? 0 }
    private var current: ScheduleDay { days[index] }
    private var week: ArraySlice<ScheduleDay> {
        let start = index / 7 * 7
        return days[start..<min(start + 7, days.count)]
    }

    private func go(to next: Int) {
        guard days.indices.contains(next), next != index else { return }
        cameFromTrailing = next > index
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.32, dampingFraction: 0.9)) {
            day = days[next].day
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                HStack(alignment: .center, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(current.weekday)
                            .font(Face.display(24, relativeTo: .title2))
                            .foregroundStyle(current.isToday ? Ink.accent : Ink.ink)
                        Text("\(current.monthShort) \(current.dateNumber)")
                            .font(Face.small.weight(.semibold))
                            .foregroundStyle(Ink.inkSoft)
                        if current.isToday {
                            Text("TODAY")
                                .font(.caption2.weight(.semibold))
                                .kerning(0.7)
                                .foregroundStyle(Ink.inkInverse)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Ink.accent))
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isHeader)

                    Spacer(minLength: 0)

                    Button(action: onShut) {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Ink.inkSoft)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, -10)
                    .accessibilityLabel("Close")
                }

                HStack(spacing: 2) {
                    ForEach(week, id: \.day) { each in
                        Button {
                            if let at = days.firstIndex(where: { $0.day == each.day }) { go(to: at) }
                        } label: {
                            StripDay(day: each, isPicked: each.day == day, inMonth: each.day.hasPrefix(monthKey))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 10)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Choose a day")
            }
            .padding(.horizontal, 16)
            .padding(.top, 22)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Ink.gold.opacity(0.3)).frame(height: 1)
            }

            ScrollView {
                ZStack(alignment: .top) {
                    page
                        .id(day)
                        .transition(.asymmetric(
                            insertion: .offset(x: reduceMotion ? 0 : (cameFromTrailing ? 40 : -40)).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
                .padding(16)
                .padding(.bottom, 24)
            }
            // Clearly sideways, so a slightly diagonal scroll of the list never
            // turns the day out from under the reader.
            .simultaneousGesture(
                DragGesture(minimumDistance: 20).onEnded { value in
                    let dx = value.translation.width, dy = value.translation.height
                    guard abs(dx) >= 56, abs(dx) >= abs(dy) * 1.5 else { return }
                    go(to: index + (dx < 0 ? 1 : -1))
                }
            )
            .accessibilityScrollAction { edge in
                if edge == .trailing { go(to: index + 1) }
                if edge == .leading { go(to: index - 1) }
            }
        }
        .background(Ink.paperRaised)
        .overlay(alignment: .top) {
            Rectangle().fill(Ink.gold).frame(height: 3)
        }
        .presentationDetents([.fraction(0.74), .fraction(0.9)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Ink.paperRaised)
        .presentationCornerRadius(16)
    }

    @ViewBuilder
    private var page: some View {
        if current.occurrences.isEmpty {
            Text("Nothing scheduled")
                .font(Face.small)
                .foregroundStyle(Ink.inkSoft)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(current.occurrences, id: \.id) { item in
                    EntryRow(occurrence: item, thumb: thumb)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// One date in the sheet's strip, marked as the grid marks them: today in red
/// numerals with a ring, the picked day a filled disc — deep red, or the accent
/// when it is also today — and the months either side dimmed.
private struct StripDay: View {
    let day: ScheduleDay
    let isPicked: Bool
    let inMonth: Bool

    var body: some View {
        VStack(spacing: 3) {
            Text(String(day.shortWeekday.prefix(1)).uppercased())
                .font(.system(size: 11, weight: .semibold))
                .kerning(0.7)
                .foregroundStyle(Ink.inkSoft)

            Text(day.dateNumber)
                .font(.callout.monospacedDigit().weight(.semibold))
                .foregroundStyle(isPicked ? Ink.inkInverse : (day.isToday ? Ink.accent : Ink.ink))
                .frame(width: 30, height: 30)
                .background(Circle().fill(isPicked ? (day.isToday ? Ink.accent : Ink.deep) : Color.clear))
                .overlay(Circle().strokeBorder(Ink.accent, lineWidth: day.isToday && !isPicked ? 1.5 : 0))
                .animation(.easeOut(duration: 0.15), value: isPicked)

            HStack(spacing: 2) {
                ForEach(Array(day.occurrences.prefix(3).enumerated()), id: \.offset) { _, item in
                    Circle().fill(item.kind.tone).frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
        }
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, minHeight: 56)
        .opacity(inMonth ? 1 : 0.5)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.accessibilityLabel)
        .accessibilityAddTraits(isPicked ? [.isButton, .isSelected] : .isButton)
    }
}

/* ── The month's feed ─────────────────────────────────────────────────────── */

/// The parish's calendar arithmetic: its own zone, so "this month" is the
/// church's month rather than that of whoever holds the phone, and Monday
/// first, as `WEEK_STARTS_ON` in @spsm/shared.
private enum Parish {
    static let zone = TimeZone(identifier: "America/New_York")!

    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        calendar.firstWeekday = 2
        return calendar
    }()

    static let keyFormat: DateFormatter = {
        let format = DateFormatter()
        format.calendar = calendar
        format.locale = Locale(identifier: "en_US_POSIX")
        format.dateFormat = "yyyy-MM-dd"
        format.timeZone = zone
        return format
    }()

    static let monthLabel: DateFormatter = {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US")
        format.dateFormat = "MMMM yyyy"
        format.timeZone = zone
        return format
    }()
}

/// A month, padded out to whole Monday-to-Sunday weeks, every day present.
struct ScheduleMonth {
    let label: String
    /// `yyyy-MM`, so the padding days either side can be dimmed.
    let monthKey: String
    let days: [ScheduleDay]

    var signature: String {
        days.map { day in
            day.day + (day.isToday ? "*" : "") + day.occurrences
                .map { [$0.id, $0.title, $0.startTime ?? "", $0.endTime ?? "", $0.location, $0.description, $0.imageUrl ?? ""].joined(separator: "|") }
                .joined(separator: ";")
        }.joined(separator: "/")
    }
}

/// The month view's reads: the same two the week makes, over the whole padded
/// month, and only once the month is first asked for — most people who tap
/// the tag want this week and never open it.
@MainActor
final class ScheduleMonthModel: ObservableObject {
    enum State {
        case idle
        case loading
        case loaded(ScheduleMonth)
        case failed(String)
    }

    @Published private(set) var state: State = .idle
    /// The first of the month on screen, `yyyy-MM-01`. `nil` until first shown.
    @Published private(set) var anchor: String?

    /// Bumped per request, so a slow answer for a month already stepped past
    /// never lands over the one on screen — the guard the app's arrows use.
    private var sequence = 0
    private var refreshing = false

    var label: String {
        guard let anchor, let date = Parish.keyFormat.date(from: anchor) else { return "" }
        return Parish.monthLabel.string(from: date)
    }

    /// Open on the month `day` is in, the first time only; after that the
    /// month is whichever one the reader stepped to.
    func show(monthOf day: String?) {
        guard anchor == nil else { return }
        let key = day ?? Parish.keyFormat.string(from: Date())
        anchor = String(key.prefix(7)) + "-01"
        reload()
    }

    func step(_ by: Int) {
        guard let anchor,
              let date = Parish.keyFormat.date(from: anchor),
              let next = Parish.calendar.date(byAdding: .month, value: by, to: date) else { return }
        self.anchor = Parish.keyFormat.string(from: next)
        reload()
    }

    func reload() {
        guard let anchor else { return }
        sequence += 1
        let mine = sequence
        state = .loading

        Task {
            do {
                let month = try await Self.fetch(anchor)
                guard mine == sequence else { return }
                state = .loaded(month)
            } catch {
                guard mine == sequence else { return }
                state = .failed("The church’s calendar could not be reached. It may be the signal where you are standing.")
            }
        }
    }

    /// A quiet re-read, as the week's: replaces the month only when the answer
    /// arrived, is still for the month on screen, and differs.
    func refresh() async {
        guard case .loaded(let current) = state, let anchor, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        let mine = sequence
        guard let next = try? await Self.fetch(anchor), mine == sequence else { return }
        if next.signature != current.signature { state = .loaded(next) }
    }

    private static func fetch(_ anchor: String) async throws -> ScheduleMonth {
        let calendar = Parish.calendar
        let keyFormat = Parish.keyFormat

        guard let first = keyFormat.date(from: anchor),
              let length = calendar.range(of: .day, in: .month, for: first)?.count,
              let last = calendar.date(byAdding: .day, value: length - 1, to: first) else {
            throw URLError(.badURL)
        }

        // .weekday is 1 for Sunday … 7 for Saturday: back to the Monday on or
        // before the 1st, on to the Sunday on or after the last.
        let lead = (calendar.component(.weekday, from: first) + 5) % 7
        let trail = (8 - calendar.component(.weekday, from: last)) % 7
        let start = calendar.date(byAdding: .day, value: -lead, to: first)!
        let dates = (0..<(lead + length + trail)).map { calendar.date(byAdding: .day, value: $0, to: start)! }
        let keys = dates.map(keyFormat.string)

        async let bulletinData = try? ScheduleModel.get(ClipConfig.api("/api/bulletin"))

        var components = URLComponents(url: ClipConfig.api("/api/calendar"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "from", value: keys.first),
            URLQueryItem(name: "to", value: keys.last),
        ]
        // Only the calendar is required; the bulletin adds its photographs and
        // the few entries Breeze does not carry.
        let feed = try JSONDecoder().decode(CalendarFeed.self, from: try await ScheduleModel.get(components.url!))
        let bulletin = (await bulletinData).flatMap { try? JSONDecoder().decode(BulletinResponse.self, from: $0) }

        let from = keys[0], to = keys[keys.count - 1]
        let fromBulletin = (bulletin?.occurrences ?? []).filter { $0.day <= to && $0.endDay >= from }
        let merged = Merge.sources([fromBulletin, feed.occurrences])

        let today = keyFormat.string(from: Date())
        return ScheduleMonth(
            label: Parish.monthLabel.string(from: first),
            monthKey: String(anchor.prefix(7)),
            days: ScheduleModel.days(merged, dates: dates, keys: keys, today: today, zone: Parish.zone)
        )
    }
}
