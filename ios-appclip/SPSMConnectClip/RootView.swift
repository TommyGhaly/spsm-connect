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

/// The card every read-only experience ends with.
///
/// Two exits, in the order they are useful: the church's own page, which is
/// current and complete and needs nothing installed, then the app, which is the
/// thing this clip is a sample of. Shared rather than repeated because the
/// wording is the same argument on every screen.
struct ClipFooter: View {
    let destination: ClipDestination
    var readMore: String
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipCard {
            ClipEyebrow(text: "There is more")
            ClipBody(text: readMore)

            ClipButton(label: "Open on the church’s website", tone: .quiet) {
                sheet = IdentifiableURL(url: ClipConfig.page(destination.sitePath))
            }
            ClipButton(label: "Get SPSM Connect") { AppOffer.present() }

            Text("What you are holding is a sample. iPhone removes it on its own after a while.")
                .font(Face.small)
                .foregroundStyle(Ink.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
        .safari(url: $sheet)
    }
}
