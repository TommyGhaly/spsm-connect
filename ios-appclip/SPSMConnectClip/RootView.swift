import SwiftUI

/// One invocation, one screen.
///
/// The clip has no navigation stack on purpose. Somebody has tapped a tag by a
/// door to do one thing, and the shortest path between that tap and the thing
/// is a single screen with no hierarchy to get lost in. Where a screen needs to
/// go further — the whole liturgy tour, the giving form, a parish form — it
/// hands off to Safari or offers the app, which are the two exits every screen
/// shares.
struct RootView: View {
    let destination: ClipDestination

    var body: some View {
        switch destination {
        case .give: GiveView()
        case .schedule: ScheduleView()
        case .apps: AppsView()
        case .welcome: WelcomeView()
        case .plans: PlansView()
        case .bookstore: BookstoreView()
        case .forms: FormsView()
        case .photos: PhotosView()
        }
    }
}

/// The card every read-only experience ends with: the church's own page, which
/// is current and complete and needs nothing installed.
///
/// The app is no longer offered here — `AppBanner` offers it at the top of
/// every screen with Apple's badge, where it is seen without scrolling.
struct ClipFooter: View {
    let destination: ClipDestination
    var readMore: String
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipCard {
            ClipEyebrow(text: "On the church’s website")
            ClipBody(text: readMore)

            ClipButton(label: "Open the full page") {
                sheet = IdentifiableURL(url: ClipConfig.page(destination.sitePath))
            }

            Text("This is a quick preview of the app. Your iPhone removes it on its own after a while.")
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
        .safari(url: $sheet)
    }
}
