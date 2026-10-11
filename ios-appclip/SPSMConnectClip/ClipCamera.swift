import AVFoundation
import SwiftUI
import UIKit

/// The clip's camera — the app's viewfinder, in Swift.
///
/// ---------------------------------------------------------------------------
/// ## Why not `UIImagePickerController`
///
/// The system picker was the whole camera here once, and it is the one camera
/// on the phone that does not behave like the phone's camera: it opens the
/// main lens alone, with a digital zoom over it, so the ultra wide and the
/// telephoto that somebody uses every day in the Camera app are simply not
/// there. The app's viewfinder (`src/send/CameraScreen.tsx`) was rebuilt to
/// offer the phone's own lenses behind the phone's own numbers, and a tag on a
/// wall should not give a worse camera to somebody who has not installed it.
///
/// So this is the same camera, written against AVFoundation directly because
/// the clip has no JavaScript: the same virtual device, the same pills, the
/// same pinch across lenses, the same quality-first capture. Photographs only —
/// the clip has never recorded clips, and an audio input would be a second
/// permission prompt on a sample somebody opened ten seconds ago.
///
/// ## Which device, and where 1× is
///
/// The back camera is the most capable *virtual* device the phone has — triple,
/// then dual wide, then dual — because that is the device that hands the
/// picture from one piece of glass to the next as the zoom crosses it. Its
/// zoom counts from its widest lens, so on a phone with an ultra wide a factor
/// of 1 is the Camera app's 0.5× and the main camera starts at the first
/// switch-over. `lensStops` reads those switch-overs, which is what makes the
/// pills say 3 on a 3× phone and 5 on a 5× one without a table of models.
/// It is `lensModel` in `CameraScreen.tsx`, line for line; change them together.
/// ---------------------------------------------------------------------------
struct ClipCamera: View {
    /// A photograph, or nil for "closed without taking one".
    let finished: (UIImage?) -> Void

    @StateObject private var camera = ClipCameraModel()
    @State private var pinchBase: CGFloat?
    @State private var focus: (point: CGPoint, at: Date)?

    var body: some View {
        ZStack {
            Ink.deep.ignoresSafeArea()

            switch camera.state {
            case .starting, .running:
                CameraPreview(
                    session: camera.session,
                    onTap: { viewPoint, devicePoint in
                        focus = (viewPoint, Date())
                        camera.focus(at: devicePoint)
                    },
                    onDoubleTap: { camera.flip() },
                    onPinch: { scale, began in
                        if began || pinchBase == nil { pinchBase = camera.zoom }
                        camera.setZoom((pinchBase ?? camera.zoom) * scale, ramp: false)
                    }
                )
                .ignoresSafeArea()

            case .denied:
                notice("Camera access is turned off for SPSM Connect. You can turn it on in Settings, under SPSM Connect.")

            case .unavailable:
                notice("This device has no camera that the sample can use.")
            }

            if let focus {
                FocusSquare(at: focus.point)
                    .id(focus.at)
            }

            VStack(spacing: 14) {
                HStack(spacing: 10) {
                    Round(systemName: "xmark", label: "Close the camera") { finished(nil) }
                    Spacer()
                    if camera.hasFlash {
                        Round(
                            systemName: camera.flash == .off ? "bolt.slash.fill" : "bolt.fill",
                            label: "Flash \(flashWord(camera.flash)). Press to change.",
                            badge: camera.flash == .auto ? "A" : nil
                        ) { camera.cycleFlash() }
                    }
                    if camera.state == .running {
                        Round(
                            systemName: "arrow.triangle.2.circlepath",
                            label: "Switch between the front and back cameras"
                        ) { camera.flip() }
                    }
                }
                .padding(.horizontal, 16)

                Spacer()

                ZoomRow(
                    stops: camera.stops,
                    neutral: camera.neutral,
                    zoom: camera.zoom
                ) { target in camera.setZoom(target, ramp: true) }

                Button {
                    camera.capture { image in
                        // A capture that failed leaves the camera open to try
                        // again, which is what the app's shutter does too.
                        if let image { finished(image) }
                    }
                } label: {
                    ZStack {
                        Circle().stroke(Ink.inkInverse, lineWidth: 5).frame(width: 76, height: 76)
                        Circle().fill(Ink.inkInverse).frame(width: 62, height: 62)
                    }
                    .opacity(camera.state != .running || camera.capturing ? 0.4 : 1)
                }
                .disabled(camera.state != .running || camera.capturing)
                .accessibilityLabel("Take a photograph")
                .padding(.bottom, 24)
            }
            .padding(.top, 8)
        }
        .onAppear { camera.start() }
        .onDisappear { camera.stop() }
    }

    private func notice(_ text: String) -> some View {
        Text(text)
            .font(Face.body)
            .foregroundColor(Ink.inkInverse)
            .multilineTextAlignment(.center)
            .padding(32)
    }

    private func flashWord(_ mode: AVCaptureDevice.FlashMode) -> String {
        switch mode {
        case .on: return "on"
        case .auto: return "auto"
        default: return "off"
        }
    }
}

// MARK: - The session

final class ClipCameraModel: NSObject, ObservableObject, @unchecked Sendable {
    enum State { case starting, running, denied, unavailable }

    /// One pill: what it says, and the session zoom that frames like it.
    struct Stop: Equatable {
        let factor: CGFloat
        let zoom: CGFloat
    }

    let session = AVCaptureSession()

    @Published private(set) var state: State = .starting
    @Published private(set) var zoom: CGFloat = 1
    @Published private(set) var neutral: CGFloat = 1
    @Published private(set) var stops: [Stop] = []
    @Published private(set) var hasFlash = false
    @Published private(set) var flash: AVCaptureDevice.FlashMode = .off
    @Published private(set) var capturing = false

    /// Everything that touches the session runs here, off the main thread —
    /// `startRunning` blocks for as long as the hardware takes to open.
    private let queue = DispatchQueue(label: "org.spsm.connect.clip.camera")
    private let output = AVCapturePhotoOutput()
    private var input: AVCaptureDeviceInput?
    private var position: AVCaptureDevice.Position = .back
    private var minZoom: CGFloat = 1
    private var maxZoom: CGFloat = 1
    private var inFlight: PhotoDelegate?

    private var device: AVCaptureDevice? { input?.device }

    func start() {
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            open()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted { self.open() } else { self.publish { $0.state = .denied } }
            }
        default:
            state = .denied
        }
    }

    func stop() {
        UIDevice.current.endGeneratingDeviceOrientationNotifications()
        queue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    private func open() {
        queue.async {
            guard self.configure(.back) else {
                self.publish { $0.state = .unavailable }
                return
            }
            self.session.startRunning()
            self.publish { $0.state = .running }
        }
    }

    func flip() {
        guard state == .running, !capturing else { return }
        let next: AVCaptureDevice.Position = position == .back ? .front : .back
        queue.async { _ = self.configure(next) }
    }

    func cycleFlash() {
        // Off → on → auto, the order every phone camera cycles in.
        switch flash {
        case .off: flash = .on
        case .on: flash = .auto
        default: flash = .off
        }
    }

    /// Called on `queue`. False when this side of the phone has no camera.
    private func configure(_ wanted: AVCaptureDevice.Position) -> Bool {
        guard let device = Self.bestDevice(at: wanted),
              let newInput = try? AVCaptureDeviceInput(device: device)
        else { return false }

        session.beginConfiguration()
        session.sessionPreset = .photo
        if let input { session.removeInput(input) }
        guard session.canAddInput(newInput) else {
            if let input { session.addInput(input) }
            session.commitConfiguration()
            return false
        }
        session.addInput(newInput)
        if !session.outputs.contains(output), session.canAddOutput(output) {
            session.addOutput(output)
        }
        /*
         * `.quality` is what lets iOS run Deep Fusion and the full Smart HDR
         * pass — the single biggest difference between this and the Camera
         * app's sharpness — and 12 MP is the main camera's own size. The upload
         * is condensed to 3840 on the long edge either way, so 48 MP would be
         * four times the wait for a picture that arrives the same size.
         */
        output.maxPhotoQualityPrioritization = .quality
        let sizes = device.activeFormat.supportedMaxPhotoDimensions
        let area = { (size: CMVideoDimensions) in Int(size.width) * Int(size.height) }
        if let chosen = sizes.filter({ area($0) <= 12_600_000 }).max(by: { area($0) < area($1) })
            ?? sizes.min(by: { area($0) < area($1) })
        {
            output.maxPhotoDimensions = chosen
        }
        session.commitConfiguration()

        input = newInput
        position = wanted

        let lens = Self.lensStops(for: device, at: wanted)
        minZoom = device.minAvailableVideoZoomFactor
        maxZoom = lens.max

        if (try? device.lockForConfiguration()) != nil {
            device.videoZoomFactor = lens.neutral
            if device.isGeometricDistortionCorrectionSupported {
                device.isGeometricDistortionCorrectionEnabled = true
            }
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            device.unlockForConfiguration()
        }

        publish {
            $0.neutral = lens.neutral
            $0.stops = lens.stops
            $0.zoom = lens.neutral
            $0.hasFlash = device.hasFlash
        }
        return true
    }

    /// The most capable device on one side — the virtual one, on the back.
    private static func bestDevice(at position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        let types: [AVCaptureDevice.DeviceType] = position == .back
            ? [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera]
            : [.builtInWideAngleCamera]
        let found = AVCaptureDevice.DiscoverySession(
            deviceTypes: types,
            mediaType: .video,
            position: position
        ).devices
        for type in types {
            if let device = found.first(where: { $0.deviceType == type }) { return device }
        }
        return nil
    }

    /// `lensModel` in `CameraScreen.tsx`. See this file's header.
    private static func lensStops(
        for device: AVCaptureDevice,
        at position: AVCaptureDevice.Position
    ) -> (neutral: CGFloat, max: CGFloat, stops: [Stop]) {
        let switches = device.virtualDeviceSwitchOverVideoZoomFactors.map { CGFloat(truncating: $0) }
        let hasUltraWide = device.constituentDevices.contains { $0.deviceType == .builtInUltraWideCamera }
        let neutral = hasUltraWide ? (switches.first ?? 1) : 1
        let min = device.minAvailableVideoZoomFactor

        var factors: [CGFloat] = []
        func add(_ factor: CGFloat) {
            if !factors.contains(where: { abs($0 - factor) < 0.05 }) { factors.append(factor) }
        }

        // The ultra wide, when there is room below the main camera for it.
        if min < neutral * 0.95 { add(min / neutral) }
        add(1)
        for factor in switches where factor > neutral * 1.05 { add(factor / neutral) }

        // The 2× that is the middle of a 48 MP sensor rather than a lens.
        let near2 = factors.contains { $0 > 1.5 && $0 < 2.6 }
        let sensorCrop = position == .back && device.formats.contains { format in
            format.supportedMaxPhotoDimensions.contains { Int($0.width) * Int($0.height) >= 40_000_000 }
        }
        if !near2, sensorCrop, device.maxAvailableVideoZoomFactor >= neutral * 2 { add(2) }

        factors.sort()
        let longest = factors.last ?? 1
        let max = Swift.min(device.maxAvailableVideoZoomFactor, neutral * Swift.max(10, longest * 5))

        return (neutral, max, factors.map { Stop(factor: $0, zoom: $0 * neutral) })
    }

    /// From the main thread: a pinch step, or a pill's glide.
    func setZoom(_ value: CGFloat, ramp: Bool) {
        let target = Swift.min(Swift.max(value, minZoom), maxZoom)
        zoom = target
        queue.async {
            guard let device = self.device, (try? device.lockForConfiguration()) != nil else { return }
            if ramp {
                // Doublings per second: 1× to 3× in about a fifth of one,
                // which is the Camera app's own speed.
                device.ramp(toVideoZoomFactor: target, withRate: 8)
            } else {
                device.cancelVideoZoomRamp()
                device.videoZoomFactor = target
            }
            device.unlockForConfiguration()
        }
    }

    /// Focus *and* exposure at the point, the way the Camera app does it.
    func focus(at point: CGPoint) {
        queue.async {
            guard let device = self.device, (try? device.lockForConfiguration()) != nil else { return }
            if device.isFocusPointOfInterestSupported {
                device.focusPointOfInterest = point
                device.focusMode = device.isFocusModeSupported(.continuousAutoFocus) ? .continuousAutoFocus : .autoFocus
            }
            if device.isExposurePointOfInterestSupported {
                device.exposurePointOfInterest = point
                device.exposureMode = .continuousAutoExposure
            }
            device.unlockForConfiguration()
        }
    }

    func capture(_ done: @escaping (UIImage?) -> Void) {
        guard state == .running, !capturing else { return }
        capturing = true
        let flash = self.flash
        let orientation = Self.videoOrientation(for: UIDevice.current.orientation)

        queue.async {
            let settings = AVCapturePhotoSettings()
            settings.photoQualityPrioritization = .quality
            settings.maxPhotoDimensions = self.output.maxPhotoDimensions
            if self.output.supportedFlashModes.contains(flash) { settings.flashMode = flash }
            if self.output.isVirtualDeviceFusionSupported { settings.isAutoVirtualDeviceFusionEnabled = true }
            if self.output.isContentAwareDistortionCorrectionSupported {
                settings.isAutoContentAwareDistortionCorrectionEnabled = true
            }

            if let connection = self.output.connection(with: .video) {
                if connection.isVideoOrientationSupported { connection.videoOrientation = orientation }
                /*
                 * The front camera is a mirror in the file as well as the
                 * preview, which is the app's decision too — see `mirrorMode`
                 * in `CameraScreen.tsx` for why it is that way round.
                 */
                if connection.isVideoMirroringSupported {
                    connection.automaticallyAdjustsVideoMirroring = false
                    connection.isVideoMirrored = self.position == .front
                }
            }

            let delegate = PhotoDelegate { image in
                DispatchQueue.main.async {
                    self.capturing = false
                    self.inFlight = nil
                    done(image)
                }
            }
            // Held until it answers: the output keeps only a weak reference.
            self.inFlight = delegate
            self.output.capturePhoto(with: settings, delegate: delegate)
        }
    }

    /// The window is portrait-only, so the photograph's way up comes from the
    /// phone rather than the interface.
    private static func videoOrientation(for orientation: UIDeviceOrientation) -> AVCaptureVideoOrientation {
        switch orientation {
        case .landscapeLeft: return .landscapeRight
        case .landscapeRight: return .landscapeLeft
        case .portraitUpsideDown: return .portraitUpsideDown
        default: return .portrait
        }
    }

    private func publish(_ change: @escaping (ClipCameraModel) -> Void) {
        DispatchQueue.main.async { change(self) }
    }
}

private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    let done: (UIImage?) -> Void
    init(done: @escaping (UIImage?) -> Void) { self.done = done }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        guard error == nil, let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else {
            done(nil)
            return
        }
        done(image)
    }
}

// MARK: - The preview, and the gestures on it

/// The live picture, with the viewfinder's three gestures in UIKit where they
/// can share one view: tap to focus, two taps to turn round, pinch to zoom.
private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    let onTap: (_ viewPoint: CGPoint, _ devicePoint: CGPoint) -> Void
    let onDoubleTap: () -> Void
    let onPinch: (_ scale: CGFloat, _ began: Bool) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill

        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTap))
        doubleTap.numberOfTapsRequired = 2
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:)))
        // The single tap loses to the double one, or a double tap would focus
        // on a preview that is about to be replaced.
        tap.require(toFail: doubleTap)
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pinch(_:)))

        view.addGestureRecognizer(doubleTap)
        view.addGestureRecognizer(tap)
        view.addGestureRecognizer(pinch)
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        context.coordinator.parent = self
    }

    final class Coordinator: NSObject {
        var parent: CameraPreview
        init(parent: CameraPreview) { self.parent = parent }

        @objc func tap(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view as? PreviewView else { return }
            let point = recognizer.location(in: view)
            parent.onTap(point, view.previewLayer.captureDevicePointConverted(fromLayerPoint: point))
        }

        @objc func doubleTap() { parent.onDoubleTap() }

        @objc func pinch(_ recognizer: UIPinchGestureRecognizer) {
            switch recognizer.state {
            case .began: parent.onPinch(recognizer.scale, true)
            case .changed: parent.onPinch(recognizer.scale, false)
            default: break
            }
        }
    }
}

private final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    // swiftlint:disable:next force_cast
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

// MARK: - The chrome

/// The lens pills, drawn the way the app's `ZoomRow` draws them: bare numbers,
/// and the lit one carrying the "×" and the zoom as it actually is.
private struct ZoomRow: View {
    let stops: [ClipCameraModel.Stop]
    let neutral: CGFloat
    let zoom: CGFloat
    let choose: (CGFloat) -> Void

    var body: some View {
        let factor = zoom / neutral
        let zoomed = abs(factor - 1) > 0.05

        if stops.count >= 2 || (zoomed && !stops.isEmpty) {
            let active = stops.lastIndex(where: { $0.factor <= factor + 0.01 }) ?? 0

            HStack(spacing: 2) {
                ForEach(Array(stops.enumerated()), id: \.offset) { index, stop in
                    let lit = index == active
                    Button {
                        choose(stop.zoom)
                    } label: {
                        Text(lit ? "\(Self.format(factor))×" : Self.format(stop.factor))
                            .font(Face.label)
                            .foregroundColor(lit ? Ink.deep : Ink.inkInverse)
                            .frame(minWidth: 40, minHeight: 34)
                            .padding(.horizontal, 4)
                            .background(Capsule().fill(lit ? Ink.inkInverse : Color.clear))
                    }
                    .accessibilityLabel("Zoom to \(Self.format(stop.factor)) times")
                }
            }
            .padding(3)
            .background(Capsule().fill(Ink.deep.opacity(0.9)))
        }
    }

    /// "0.5", "1", "2.5" — the Camera app's own numbers, with no trailing ".0".
    static func format(_ factor: CGFloat) -> String {
        let rounded = (factor * 10).rounded() / 10
        return rounded == rounded.rounded() ? "\(Int(rounded))" : String(format: "%.1f", Double(rounded))
    }
}

private struct Round: View {
    let systemName: String
    let label: String
    var badge: String?
    let action: () -> Void

    init(systemName: String, label: String, badge: String? = nil, action: @escaping () -> Void) {
        self.systemName = systemName
        self.label = label
        self.badge = badge
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottomTrailing) {
                Image(systemName: systemName)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Ink.inkInverse)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Ink.deep.opacity(0.85)))
                if let badge {
                    Text(badge)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Ink.inkInverse)
                        .padding(.trailing, 8)
                        .padding(.bottom, 7)
                }
            }
        }
        .accessibilityLabel(label)
    }
}

/// The square where the finger landed, for a beat.
private struct FocusSquare: View {
    let at: CGPoint
    @State private var shown = true

    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .stroke(Ink.gold, lineWidth: 1.5)
            .frame(width: 72, height: 72)
            .position(at)
            .opacity(shown ? 1 : 0)
            .allowsHitTesting(false)
            .ignoresSafeArea()
            .onAppear {
                withAnimation(.easeOut(duration: 0.3).delay(0.9)) { shown = false }
            }
    }
}
