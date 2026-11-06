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
