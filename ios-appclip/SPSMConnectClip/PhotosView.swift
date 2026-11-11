import CryptoKit
import PhotosUI
import SwiftUI
import UIKit

/// `/c/photos` — send photographs to the church's galleries.
///
/// Two ways in: the camera, for the thing in front of somebody now, and the
/// camera roll, for the afternoon they have already taken.
///
/// ## The camera roll, and why it is allowed here
///
/// PhotoKit — `PHPhotoLibrary`, reading the library — provides nothing at
/// runtime inside an App Clip, and nothing here uses it. The system photo
/// picker (`PhotosPicker`) is a different thing: it runs out of process, shows
/// the person their own library, and hands back only what they chose, so the
/// clip never sees the library and never asks for permission to.
///
/// ## The website's rules, not new ones
///
/// `SubmitPhotos.tsx` on the website, and `submissionLimits.ts` in the shared
/// package, decide what a batch is, and this follows them:
///
///   - **Sixty at a time** (`MAX_FILES_PER_BATCH`). Choosing more keeps the
///     first sixty and says so, in the website's sentence.
///   - **The same photo twice is one photo.** Chosen again, it is dropped.
///   - **One at a time**, never all at once, so every row says what actually
///     happened to that photograph.
///   - **What was sent leaves the list; what failed stays**, with its reason,
///     and pressing Send again retries only those.
///   - **Refusals are the server's words** — the daily caps, a gallery that
///     has stopped collecting — because `galleryUploadUrl` is the only place
///     any of this is enforced.
///
/// ## Written for somebody who does not use apps much
///
/// The person holding this may be a grandparent at camp pickup. So: one thing
/// to press per screen, a sentence saying what happens next, where the photos
/// are going said on every screen until they have gone, and a look at every
/// photo before it is sent — a shutter that sent at once filed every thumb over
/// the lens straight into the review queue, and "ask the office" was the only
/// undo.
struct PhotosView: View {
    @StateObject private var model = PhotosModel()
    @State private var camera = false
    @State private var choosing = false
    @State private var library = false
    @State private var libraryPicks: [PhotosPickerItem] = []

    var body: some View {
        ClipScreen(destination: .photos) {
            switch model.state {
            case .preparing:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Finding out where photos go…")
                    }
                }

            case .unavailable(let message):
                ClipCard {
                    ClipEyebrow(text: "Not open right now")
                    ClipBody(text: message)
                    ClipButton(label: "Try again", tone: .quiet) { model.retry() }
                }

            case .ready:
                // The website's upload panel, in its order: heading, two
                // sentences, where it goes, then the dashed box to press.
                ClipCard(spacing: 14) {
                    if let program = model.destination?.programName {
                        ClipEyebrow(text: program)
                    }
                    ClipHeading(text: "Share photos with the church")
                    // The controls first: the clip opens with the system's
                    // banner over its lower half, and what is under it is
                    // what nobody finds. The reading can wait below them.
                    DropBox(
                        icon: "camera.fill",
                        title: "Take a photo",
                        caption: "Your iPhone will ask to use the camera. Tap Allow.",
                        hint: "Opens the camera"
                    ) { camera = true }
                    DropBox(
                        icon: "photo.on.rectangle.angled",
                        title: "Choose from your photos",
                        caption: "Pick up to \(PhotosModel.maxBatch) at once.",
                        hint: "Opens your photo library",
                        compact: true
                    ) { library = true }
                    DestinationRow(model: model) { choosing = true }
                    ClipBody(text: "Photographs from \(model.destination?.programName ?? "the church") are welcome — the moments the people running it are too busy to catch.")
                    GoodToKnow()
                }

            case .review(let image):
                ClipCard(spacing: 14) {
                    ClipHeading(text: "Send this photo?")
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .accessibilityLabel("The photo you just took")
                    DestinationRow(model: model) { choosing = true }
                    ClipButton(label: "Send this photo") { model.send(image) }
                    ClipButton(label: "Take it again", tone: .quiet) {
                        model.discard()
                        camera = true
                    }
                }

            case .batch:
                BatchCard(model: model, change: { choosing = true }, addMore: { library = true })

            case .sending(let fraction):
                ClipCard(spacing: 12) {
                    ClipHeading(text: "Sending…")
                    ProgressView(value: fraction)
                        .tint(Ink.accent)
                        .accessibilityValue("\(Int(fraction * 100)) percent")
                    ClipBody(text: "Please keep this screen open until it says sent.")
                }

            case .sent(let count):
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Sent")
                    ClipHeading(text: "Thank you!")
                    ClipBody(text: count == 1
                        ? "Your photo went to \(model.chosen?.label ?? "the church"). Someone from the church will look at it before it goes in the gallery."
                        : "Your \(count) photos went to \(model.chosen?.label ?? "the church"). Someone from the church will look at them before they go in the gallery.")
                    ClipButton(label: "Take another photo") {
                        model.again()
                        camera = true
                    }
                    ClipButton(label: "Choose more photos", tone: .quiet) {
                        model.again()
                        library = true
                    }
                }

            case .failed(let message):
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Not sent")
                    ClipHeading(text: "Your photo didn’t send")
                    ClipBody(text: message)
                    if let image = model.lastImage {
                        ClipButton(label: "Try sending again") { model.send(image) }
                    }
                    ClipButton(label: "Start over", tone: .quiet) { model.again() }
                }
            }
        }
        .fullScreenCover(isPresented: $camera) {
            // The app's viewfinder, in Swift — see `ClipCamera.swift` for why
            // this is no longer the system picker.
            ClipCamera(goingTo: model.chosen?.label) { image in
                camera = false
                if let image { model.review(image) }
            }
        }
        .photosPicker(
            isPresented: $library,
            selection: $libraryPicks,
            // What is left of the sixty, so the picker itself stops at the
            // limit rather than letting somebody choose photos to lose.
            maxSelectionCount: max(1, model.room),
            selectionBehavior: .ordered,
            matching: .images,
            preferredItemEncoding: .current
        )
        .onChange(of: libraryPicks) { picks in
            guard !picks.isEmpty else { return }
            model.add(picks)
            libraryPicks = []
        }
        .sheet(isPresented: $choosing) {
            if let destination = model.destination {
                TargetPicker(destination: destination, chosen: model.chosen) { target in
                    model.choose(target)
                    choosing = false
                }
            }
        }
        .task { model.prepare() }
    }
}

/// The chosen photographs, each with what has happened to it — the website's
/// list of rows, as a grid of thumbnails because a phone is narrow.
private struct BatchCard: View {
    @ObservedObject var model: PhotosModel
    let change: () -> Void
    let addMore: () -> Void

    private let columns = [GridItem(.adaptive(minimum: 92), spacing: 8)]

    var body: some View {
        ClipCard(spacing: 14) {
            ClipEyebrow(text: model.sendingBatch ? "Sending" : "Ready to send")
            ClipHeading(text: heading)

            if let notice = model.notice {
                ClipBody(text: notice, tone: Ink.ink)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Ink.paperSunken)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(model.batch) { row in
                    Tile(row: row, removable: !model.sendingBatch) { model.remove(row.id) }
                }
            }

            ForEach(Array(failures.enumerated()), id: \.offset) { _, message in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Ink.accent)
                    ClipBody(text: message, tone: Ink.ink)
                }
            }

            DestinationRow(model: model, change: change)
                .disabled(model.sendingBatch)

            if model.sendingBatch {
                ClipBody(text: "Please keep this screen open until it says sent.")
            }

            ClipButton(label: sendLabel, busy: model.sendingBatch || model.loadingAny) {
                model.sendBatch()
            }
            .disabled(model.unsent == 0)

            if !model.sendingBatch {
                if model.room > 0 {
                    ClipButton(label: "Add more photos", tone: .quiet, action: addMore)
                }
                ClipButton(label: "Start over", tone: .quiet) { model.again() }
            }
        }
    }

    private var heading: String {
        let count = model.batch.count
        return count == 1 ? "1 photo" : "\(count) photos"
    }

    private var sendLabel: String {
        if model.loadingAny && !model.sendingBatch { return "Getting your photos ready…" }
        if model.sendingBatch { return "Sending \(model.sentSoFar + 1) of \(model.queued)…" }
        let unsent = model.unsent
        if model.batch.contains(where: \.failed) { return unsent == 1 ? "Try it again" : "Try the \(unsent) again" }
        return unsent == 1 ? "Send this photo" : "Send these \(unsent) photos"
    }

    /// Each distinct reason once. Forty rows refused for the same daily cap
    /// are one sentence, not forty.
    private var failures: [String] {
        var seen = Set<String>()
        return model.batch.compactMap { row in
            guard case .failed(let message) = row.status, seen.insert(message).inserted else { return nil }
            return message
        }
    }
}

/// One chosen photograph: its thumbnail, and over it what has happened to it.
private struct Tile: View {
    let row: PhotosModel.Picked
    let removable: Bool
    let remove: () -> Void

    var body: some View {
        ZStack {
            Rectangle().fill(Ink.paperSunken)
            if let thumb = row.thumb {
                Image(uiImage: thumb)
                    .resizable()
                    .scaledToFill()
            }
            overlay
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .topTrailing) {
            if removable, row.status != .sent {
                Button(action: remove) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(Ink.inkInverse, Ink.ink.opacity(0.7))
                        .padding(4)
                }
                .accessibilityLabel("Take this photo out")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }

    @ViewBuilder private var overlay: some View {
        switch row.status {
        case .loading:
            ProgressView().tint(Ink.accent)
        case .waiting:
            EmptyView()
        case .sending(let fraction):
            ZStack {
                Rectangle().fill(Ink.ink.opacity(0.35))
                ProgressView(value: fraction)
                    .tint(Ink.inkInverse)
                    .padding(.horizontal, 12)
            }
        case .sent:
            ZStack {
                Rectangle().fill(Ink.ink.opacity(0.35))
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Ink.inkInverse)
            }
        case .failed:
            ZStack {
                Rectangle().fill(Ink.ink.opacity(0.35))
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Ink.inkInverse)
            }
        }
    }

    private var label: String {
        switch row.status {
        case .loading: return "Photo, getting ready"
        case .waiting: return "Photo, ready to send"
        case .sending: return "Photo, sending"
        case .sent: return "Photo, sent"
        case .failed(let why): return "Photo, not sent. \(why)"
        }
    }
}

/// Three plain facts, said before anyone has to wonder: what to send, that
/// they see it first, and who sees it next.
private struct GoodToKnow: View {
    private let lines: [(String, String)] = [
        ("photo.stack", "Take one now, or choose up to \(PhotosModel.maxBatch) from your photos."),
        ("eye", "You see every photo before it sends, and can take any of them out."),
        ("checkmark.seal", "Someone from the church looks at every photo before it goes in the gallery."),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(lines, id: \.1) { icon, line in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: icon)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Ink.accent)
                        .frame(width: 22)
                    Text(line)
                        .font(Face.small)
                        .foregroundStyle(Ink.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The website's `.submit-drop`: a sunken box with a dashed edge, the call in
/// accent, a faint line under it. The whole box is the button. Pressed, the
/// edge goes solid on the soft accent — the site's `is-over`, where the
/// invitation has been accepted. `compact` is the second box, a row rather
/// than a stack, so the camera stays the first thing the eye lands on.
private struct DropBox: View {
    let icon: String
    let title: String
    let caption: String
    let hint: String
    var compact = false
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            Group {
                if compact {
                    HStack(spacing: 14) {
                        badge(size: 44, symbol: 18)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title)
                                .font(Face.body.weight(.semibold))
                                .foregroundStyle(Ink.accentStrong)
                            Text(caption)
                                .font(Face.small)
                                .foregroundStyle(Ink.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    .multilineTextAlignment(.leading)
                    .padding(.vertical, 14)
                } else {
                    VStack(spacing: 8) {
                        badge(size: 56, symbol: 22)
                            .padding(.bottom, 4)
                        Text(title)
                            .font(Face.heading)
                            .foregroundStyle(Ink.accentStrong)
                        Text(caption)
                            .font(Face.small)
                            .foregroundStyle(Ink.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 24)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
        }
        .buttonStyle(DropStyle())
        .accessibilityHint(hint)
    }

    private func badge(size: CGFloat, symbol: CGFloat) -> some View {
        Image(systemName: icon)
            .font(.system(size: symbol, weight: .semibold))
            .foregroundStyle(Ink.inkInverse)
            .frame(width: size, height: size)
            .background(Circle().fill(Ink.accent))
            .overlay(Circle().strokeBorder(Ink.gold, lineWidth: 2).padding(-4))
    }
}

private struct DropStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .background(pressed ? Ink.accent.opacity(0.2) : Ink.accentSoft)
            .overlay(
                RoundedRectangle(cornerRadius: 10).strokeBorder(
                    pressed ? Ink.accent : Ink.accent.opacity(0.45),
                    style: StrokeStyle(lineWidth: 1, dash: pressed ? [] : [5, 4])
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .contentShape(RoundedRectangle(cornerRadius: 10))
            .animation(.easeOut(duration: 0.15), value: pressed)
    }
}

/// "Your photo goes to: Summer Camp 2026, Week 1 ›". Shown on every screen
/// before sending, so the place is never a surprise — and when there is more
/// than one place, the whole row is the control, the way a Settings row is.
private struct DestinationRow: View {
    @ObservedObject var model: PhotosModel
    let change: () -> Void

    private var changeable: Bool { (model.destination?.targets.count ?? 0) > 1 }

    var body: some View {
        Button(action: change) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "photo.stack")
                    .font(.system(size: 18))
                    .foregroundStyle(Ink.gold)
                VStack(alignment: .leading, spacing: 2) {
                    Text("GOING TO")
                        .font(Face.label)
                        .kerning(0.8)
                        .foregroundStyle(Ink.gold)
                    Text(model.chosen?.label ?? "")
                        .font(Face.body.weight(.semibold))
                        .foregroundStyle(Ink.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                if changeable {
                    HStack(spacing: 4) {
                        Text("Change")
                            .font(Face.small.weight(.semibold))
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                    }
                    .foregroundStyle(Ink.accent)
                }
            }
            .padding(12)
            .padding(.leading, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.paperSunken)
            .overlay(alignment: .leading) { Rectangle().fill(Ink.gold).frame(width: 4) }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .disabled(!changeable)
        .accessibilityElement(children: .combine)
        .accessibilityHint(changeable ? "Choose a different event for your photo" : "")
    }
}

/// Every place in the ministry, as one list — the parish's choice on top,
/// marked, then the whole tree indented the way the website's picker is.
private struct TargetPicker: View {
    let destination: UploadClient.Destination
    let chosen: UploadClient.Target?
    let pick: (UploadClient.Target) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row(destination.suggested, indent: false)
                } header: {
                    header("Suggested by the church")
                }
                Section {
                    ForEach(destination.targets) { target in
                        row(target, indent: true)
                    }
                } header: {
                    header("All of \(destination.programName)")
                }
            }
            // The only system list in the clip. Every other screen paints its
            // own paper, but a `List` follows the phone's appearance, so in
            // dark mode it put `Ink.ink` on black. `Ink` has no dark values —
            // the clip is light throughout — so the sheet is pinned light and
            // painted in the same paper as the screen behind it.
            .scrollContentBackground(.hidden)
            .background(Ink.paper)
            .navigationTitle("Where should it go?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .toolbarBackground(Ink.paperRaised, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .tint(Ink.accent)
        .preferredColorScheme(.light)
    }

    private func header(_ text: String) -> some View {
        Text(text)
            .font(Face.label)
            .foregroundStyle(Ink.inkSoft)
    }

    private func row(_ target: UploadClient.Target, indent: Bool) -> some View {
        Button { pick(target) } label: {
            HStack {
                Text(indent ? target.title : target.label)
                    .font(target.depth == 0 ? Face.body.weight(.semibold) : Face.body)
                    .foregroundStyle(Ink.ink)
                    .padding(.leading, indent ? CGFloat(max(0, target.depth - 1)) * 18 : 0)
                Spacer()
                if target.id == chosen?.id {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Ink.accent)
                        .accessibilityLabel("Chosen")
                }
            }
            .frame(minHeight: 36)
        }
        .listRowBackground(Ink.paperRaised)
        // A row's own title is "Week 1" or "Monday", which says nothing read
        // aloud on its own; the trail says which year and week it is.
        .accessibilityLabel(target.label)
    }
}

@MainActor
final class PhotosModel: ObservableObject {
    enum State {
        case preparing
        case ready
        case review(UIImage)
        /// Photographs chosen from the camera roll, on their way or waiting.
        case batch
        case sending(Double)
        /// How many went.
        case sent(Int)
        case failed(String)
        case unavailable(String)
    }

    /// `MAX_FILES_PER_BATCH` in `@spsm/shared`'s `submissionLimits.ts`.
    static let maxBatch = 60

    /// One photograph chosen from the camera roll.
    ///
    /// The picker's item, not its bytes: sixty photographs held in memory is
    /// a clip the system kills. The bytes are read twice, briefly — once for
    /// the thumbnail and the duplicate check, once when it is sent.
    struct Picked: Identifiable {
        enum Status: Equatable {
            case loading
            case waiting
            case sending(Double)
            case sent
            case failed(String)
        }

        let id = UUID()
        let item: PhotosPickerItem
        /// A digest of the bytes — the website's `identity(file)`, which a
        /// photo picker gives no name or date to build from.
        var key: String?
        var thumb: UIImage?
        var status: Status = .loading

        var failed: Bool { if case .failed = status { return true } else { return false } }
    }

    @Published private(set) var state: State = .preparing
    @Published private(set) var destination: UploadClient.Destination?
    @Published private(set) var chosen: UploadClient.Target?
    @Published private(set) var batch: [Picked] = []
    @Published private(set) var notice: String?
    @Published private(set) var sendingBatch = false
    /// For "Sending 3 of 12": how many this press of Send means, and how many
    /// of those have gone.
    @Published private(set) var queued = 0
    @Published private(set) var sentSoFar = 0
    /// Kept after a failure so "Try sending again" does not need a new photo.
    private(set) var lastImage: UIImage?
    private var started = false

    /// What is left of the sixty.
    var room: Int { max(0, Self.maxBatch - batch.count) }
    var unsent: Int { batch.filter { $0.status != .sent && $0.status != .loading }.count }
    var loadingAny: Bool { batch.contains { $0.status == .loading } }

    func prepare() {
        guard !started else { return }
        started = true

        Task {
            do {
                let resolved = try await UploadClient.destination()
                destination = resolved
                chosen = resolved.suggested
                state = .ready
            } catch {
                started = false
                state = .unavailable(
                    (error as? LocalizedError)?.errorDescription
                        ?? "The church isn’t collecting photos just now, or couldn’t be reached."
                )
            }
        }
    }

    func retry() {
        state = .preparing
        prepare()
    }

    func choose(_ target: UploadClient.Target) {
        chosen = target
    }

    func review(_ image: UIImage) {
        lastImage = image
        state = .review(image)
    }

    func discard() {
        lastImage = nil
        state = batch.isEmpty ? .ready : .batch
    }

    func again() {
        lastImage = nil
        batch = []
        notice = nil
        state = destination == nil ? .preparing : .ready
        if destination == nil { prepare() }
    }

    func send(_ image: UIImage) {
        guard let destination, let chosen else { return }
        lastImage = image
        state = .sending(0)

        Task {
            do {
                _ = try await UploadClient.send(image: image, to: chosen, in: destination.programId) { fraction in
                    Task { @MainActor in
                        // A late progress report must not drag a finished
                        // send back to the bar.
                        if case .sending = self.state { self.state = .sending(fraction) }
                    }
                }
                lastImage = nil
                state = .sent(1)
            } catch {
                state = .failed(
                    (error as? LocalizedError)?.errorDescription
                        ?? "Something went wrong while sending. Please try again."
                )
            }
        }
    }

    /* ── The camera roll ─────────────────────────────────────────────────── */

    /// What the picker handed back, added to the list.
    func add(_ items: [PhotosPickerItem]) {
        guard !sendingBatch else { return }

        // The website's sentence, word for word, and the website's trim: the
        // first sixty stay and the rest are not added at all.
        if batch.count + items.count > Self.maxBatch {
            notice = "That is more than \(Self.maxBatch) photographs at once. The first \(Self.maxBatch) are below — send those, then choose the rest."
        } else {
            notice = nil
        }
        let incoming = items.prefix(room).map { Picked(item: $0) }
        guard !incoming.isEmpty else { return }

        batch.append(contentsOf: incoming)
        state = .batch

        /*
         * Thumbnails and duplicate checks one at a time, as the website
         * condenses one at a time: each read is a full photograph, and sixty
         * at once on a phone is how the clip gets killed. The tiles are
         * already on screen with a spinner, so the wait is visible.
         */
        Task {
            for row in incoming {
                await load(row.id)
            }
        }
    }

    private func load(_ id: UUID) async {
        guard let row = batch.first(where: { $0.id == id }) else { return }
        do {
            guard let data = try await row.item.loadTransferable(type: Data.self) else {
                throw UploadClient.Failure.refused("")
            }
            let (key, thumb) = await Task.detached(priority: .userInitiated) {
                (
                    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(),
                    UploadClient.image(from: data, maxEdge: 360)
                )
            }.value

            // A duplicate never reaches the list — `SubmitPhotos.tsx` again.
            if batch.contains(where: { $0.id != id && $0.key == key }) {
                batch.removeAll { $0.id == id }
                if batch.isEmpty { state = .ready }
                return
            }
            update(id) {
                $0.key = key
                $0.thumb = thumb
                $0.status = thumb == nil
                    ? .failed("That photo couldn’t be opened. Please choose another.")
                    : .waiting
            }
        } catch {
            update(id) {
                $0.status = .failed("That photo couldn’t be opened. If it is in iCloud, it may still be downloading — try again in a moment.")
            }
        }
    }

    func remove(_ id: UUID) {
        guard !sendingBatch else { return }
        batch.removeAll { $0.id == id }
        if batch.count < Self.maxBatch { notice = nil }
        if batch.isEmpty { state = .ready }
    }

    /// Everything not yet sent, one photograph at a time.
    func sendBatch() {
        guard let destination, let chosen, !sendingBatch, !loadingAny else { return }

        /*
         * Over a snapshot of ids, and only what has not gone: pressing Send
         * again after a partial failure retries the failures and does not send
         * the successes twice.
         */
        let queue = batch.filter { $0.status != .sent }.map(\.id)
        guard !queue.isEmpty else { return }

        sendingBatch = true
        notice = nil
        queued = queue.count
        sentSoFar = 0

        Task {
            var sent = 0
            var stoppedFor: String?

            for id in queue {
                guard let row = batch.first(where: { $0.id == id }) else { continue }
                update(id) { $0.status = .sending(0) }
                do {
                    guard let data = try await row.item.loadTransferable(type: Data.self),
                          let image = await Task.detached(priority: .userInitiated, operation: {
                              UploadClient.image(from: data)
                          }).value
                    else {
                        throw UploadClient.Failure.refused("That photo couldn’t be opened. Please choose another.")
                    }
                    _ = try await UploadClient.send(image: image, to: chosen, in: destination.programId) { fraction in
                        Task { @MainActor in
                            if case .sending = self.status(of: id) { self.update(id) { $0.status = .sending(fraction) } }
                        }
                    }
                    update(id) { $0.status = .sent }
                    sent += 1
                    sentSoFar = sent
                } catch let failure as UploadClient.Failure {
                    let message = failure.errorDescription ?? "It could not be sent."
                    update(id) { $0.status = .failed(message) }
                    /*
                     * The one difference from the website, and for the phone's
                     * sake: when the clip itself cannot be vouched for, every
                     * remaining photograph would fail the same way, each after
                     * its own round trip to Apple. So it stops, and says why.
                     */
                    if case .unattested = failure {
                        stoppedFor = message
                        break
                    }
                } catch {
                    update(id) { $0.status = .failed("That photo didn’t finish sending. Please try again.") }
                }
            }

            sendingBatch = false

            // The sent go and the failures stay, with their reasons.
            batch.removeAll { $0.status == .sent }

            if sent == queue.count {
                state = .sent(sent)
                batch = []
            } else if let stoppedFor {
                notice = sent > 0 ? "\(sent) of \(queue.count) were sent. \(stoppedFor)" : stoppedFor
            } else if sent > 0 {
                notice = "\(sent) of \(queue.count) were sent. The rest are still below — you can try again."
            }
        }
    }

    private func status(of id: UUID) -> Picked.Status? {
        batch.first { $0.id == id }?.status
    }

    private func update(_ id: UUID, _ change: (inout Picked) -> Void) {
        guard let index = batch.firstIndex(where: { $0.id == id }) else { return }
        change(&batch[index])
    }
}
