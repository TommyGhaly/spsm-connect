import SwiftUI
import UIKit

/// `/c/photos` — send a photograph to the church's galleries.
///
/// **Camera only, and that is Apple's rule rather than a simplification.**
/// PhotoKit provides no functionality at runtime inside an App Clip, so "choose
/// from my library" does not exist here and cannot be added. `UIImagePicker`
/// with `.camera` is the whole of what a clip may do, which suits the errand:
/// somebody is at the church, now, looking at the thing worth photographing.
struct PhotosView: View {
    @StateObject private var model = PhotosModel()
    @State private var camera = false

    var body: some View {
        ClipScreen(destination: .photos) {
            switch model.state {
            case .preparing:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Asking the church where photographs go…")
                    }
                }

            case .unavailable(let message):
                ClipCard {
                    ClipEyebrow(text: "Not from here")
                    ClipBody(text: message)
                    ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                }

            case .ready(let section):
                ClipCard {
                    ClipEyebrow(text: "Photographs go to")
                    ClipHeading(text: section.title)
                    ClipBody(
                        text: """
                        Take one photograph and send it. A servant reviews everything before it \
                        appears, and you can ask the office to remove it at any time.
                        """
                    )
                    ClipButton(label: "Open the camera") { camera = true }
                }

            case .sending(let fraction):
                ClipCard {
                    ClipEyebrow(text: "Sending")
                    ProgressView(value: fraction)
                        .tint(Ink.accent)
                    ClipBody(text: "Keep this on screen until it finishes. A sample cannot send in the background.")
                }

            case .sent:
                ClipCard {
                    ClipEyebrow(text: "Thank you")
                    ClipHeading(text: "It is with the church.")
                    ClipBody(text: "A servant will review it before it appears in the gallery.")
                    ClipButton(label: "Send another", tone: .quiet) { model.reset() }
                    ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                }

            case .failed(let message):
                ClipCard {
                    ClipEyebrow(text: "It did not send")
                    ClipBody(text: message)
                    ClipButton(label: "Try again", tone: .quiet) { model.reset() }
                    ClipButton(label: "Get SPSM Connect") { AppOffer.present() }
                }
            }

            ClipFooter(
                destination: .photos,
                readMore: "The church's galleries are on its website, arranged by event."
            )
        }
        .sheet(isPresented: $camera) {
            CameraPicker { image in
                camera = false
                if let image { model.send(image) }
            }
            .ignoresSafeArea()
        }
        .task { model.prepare() }
    }
}

@MainActor
final class PhotosModel: ObservableObject {
    enum State {
        case preparing
        case ready(UploadClient.Section)
        case sending(Double)
        case sent
        case failed(String)
        case unavailable(String)
    }

    @Published private(set) var state: State = .preparing
    private var section: UploadClient.Section?
    private var started = false

    func prepare() {
        guard !started else { return }
        started = true

        Task {
            do {
                let resolved = try await UploadClient.mainSection()
                section = resolved
                state = .ready(resolved)
            } catch {
                state = .unavailable(
                    (error as? LocalizedError)?.errorDescription
                        ?? "The church is not collecting photographs just now."
                )
            }
        }
    }

    func reset() {
        if let section { state = .ready(section) } else { state = .preparing; started = false; prepare() }
    }

    func send(_ image: UIImage) {
        guard let section else { return }
        state = .sending(0)

        Task {
            do {
                _ = try await UploadClient.send(image: image, to: section) { fraction in
                    Task { @MainActor in self.state = .sending(fraction) }
                }
                state = .sent
            } catch {
                state = .failed(
                    (error as? LocalizedError)?.errorDescription
                        ?? "That photograph could not be sent. Please try it again."
                )
            }
        }
    }
}

/// The camera, as the only picker a clip may present.
struct CameraPicker: UIViewControllerRepresentable {
    let finished: (UIImage?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(finished: finished) }

    func makeUIViewController(context: Context) -> UIViewController {
        /*
         * A simulator has no camera, and `UIImagePickerController` with
         * `.camera` on one throws rather than degrading. Falling back keeps the
         * screen testable in the simulator even though the picture it produces
         * is not a real capture.
         */
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            let controller = UIViewController()
            controller.view.backgroundColor = UIColor(Ink.deep)
            DispatchQueue.main.async { finished(nil) }
            return controller
        }

        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let finished: (UIImage?) -> Void
        init(finished: @escaping (UIImage?) -> Void) { self.finished = finished }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            finished(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            finished(nil)
        }
    }
}
