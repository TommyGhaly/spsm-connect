import SwiftUI
import UIKit

/// `/c/photos` — send a photograph to the church's galleries.
///
/// **Camera only, and that is Apple's rule rather than a simplification.**
/// PhotoKit provides no functionality at runtime inside an App Clip, so "choose
/// from my library" does not exist here and cannot be added. `UIImagePicker`
/// with `.camera` — or a camera of its own, which is `ClipCamera` — is the whole
/// of what a clip may do, which suits the errand:
/// somebody is at the church, now, looking at the thing worth photographing.
///
/// ## Written for somebody who does not use apps much
///
/// The person holding this may be a grandparent at camp pickup. So: one thing
/// to press per screen, a sentence saying what happens next, where the photo is
/// going said on every screen until it has gone, and a look at the photo before
/// it is sent — a shutter that sent at once filed every thumb over the lens
/// straight into the review queue, and "ask the office" was the only undo.
struct PhotosView: View {
    @StateObject private var model = PhotosModel()
    @State private var camera = false
    @State private var choosing = false

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
                    ClipHeading(text: "Share a photo with the church")
                    // The two controls first: the clip opens with the system's
                    // banner over its lower half, and what is under it is
                    // what nobody finds. The reading can wait below them.
                    TakeBox { camera = true }
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

            case .sending(let fraction):
                ClipCard(spacing: 12) {
                    ClipHeading(text: "Sending…")
                    ProgressView(value: fraction)
                        .tint(Ink.accent)
                        .accessibilityValue("\(Int(fraction * 100)) percent")
                    ClipBody(text: "Please keep this screen open until it says sent.")
                }

            case .sent:
                ClipCard(spacing: 12) {
                    ClipEyebrow(text: "Sent")
                    ClipHeading(text: "Thank you!")
                    ClipBody(text: "Your photo went to \(model.chosen?.label ?? "the church"). Someone from the church will look at it before it goes in the gallery.")
                    ClipButton(label: "Take another photo") {
                        model.again()
                        camera = true
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

            ClipFooter(
                destination: .photos,
                readMore: "The church’s galleries are on its website, arranged by event."
            )
        }
        .fullScreenCover(isPresented: $camera) {
            // The app's viewfinder, in Swift — see `ClipCamera.swift` for why
            // this is no longer the system picker.
            ClipCamera(goingTo: model.chosen?.label) { image in
                camera = false
                if let image { model.review(image) }
            }
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

/// Three plain facts, said before anyone has to wonder: what to take, that
/// they see it first, and who sees it next.
private struct GoodToKnow: View {
    private let lines: [(String, String)] = [
        ("camera.viewfinder", "One photo at a time, taken here and now."),
        ("eye", "You see it before it sends, and can take it again."),
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

/// The website's `.submit-drop`, for a camera instead of a file picker: a
/// sunken box with a dashed edge, the call in accent, a faint line under it.
/// The whole box is the button. Pressed, the edge goes solid on the soft
/// accent — the site's `is-over`, where the invitation has been accepted.
private struct TakeBox: View {
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(spacing: 8) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Ink.inkInverse)
                    .frame(width: 56, height: 56)
                    .background(Circle().fill(Ink.accent))
                    .overlay(Circle().strokeBorder(Ink.gold, lineWidth: 2).padding(-4))
                    .padding(.bottom, 4)
                Text("Take a photo")
                    .font(Face.heading)
                    .foregroundStyle(Ink.accentStrong)
                Text("Your iPhone will ask to use the camera. Tap Allow.")
                    .font(Face.small)
                    .foregroundStyle(Ink.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .padding(.horizontal, 16)
        }
        .buttonStyle(DropStyle())
        .accessibilityHint("Opens the camera")
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
                Section("Suggested by the church") {
                    row(destination.suggested, indent: false)
                }
                Section("All of \(destination.programName)") {
                    ForEach(destination.targets) { target in
                        row(target, indent: true)
                    }
                }
            }
            .navigationTitle("Where should it go?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
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
        case sending(Double)
        case sent
        case failed(String)
        case unavailable(String)
    }

    @Published private(set) var state: State = .preparing
    @Published private(set) var destination: UploadClient.Destination?
    @Published private(set) var chosen: UploadClient.Target?
    /// Kept after a failure so "Try sending again" does not need a new photo.
    private(set) var lastImage: UIImage?
    private var started = false

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
        state = .ready
    }

    func again() {
        lastImage = nil
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
                state = .sent
            } catch {
                state = .failed(
                    (error as? LocalizedError)?.errorDescription
                        ?? "Something went wrong while sending. Please try again."
                )
            }
        }
    }
}
