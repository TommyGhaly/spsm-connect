import SwiftUI

@main
struct SPSMConnectClipApp: App {
    @State private var destination: ClipDestination = ClipRouter.destination(
        for: ClipRouter.debugInvocationURL()
    )

    var body: some Scene {
        WindowGroup {
            RootView(destination: destination)
                /*
                 * The real invocation. iOS hands the clip its URL as a user
                 * activity rather than through `openURL`, and it can arrive
                 * *after* the first frame — which is why `destination` is state
                 * seeded from the debug variable rather than a constant read at
                 * launch. Without this the clip would always show the fallback.
                 */
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    destination = ClipRouter.destination(for: activity.webpageURL)
                }
        }
    }
}
