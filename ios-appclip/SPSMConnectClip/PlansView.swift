import SwiftUI

/// `/c/plans` — the three buildings designed for 169 Rice Road.
///
/// The whole of the app's Future Plans page, in words: what is being built,
/// each of the three buildings, the figures, the land, where the work stands,
/// the firms drawing it, and how it is paid for. Generated from
/// `src/about/future.ts` rather than copied, with the church's website edits
/// laid over it — see `AboutPage.swift`.
///
/// The renderings and the flythrough are still on the church's page, because
/// a 15 MB budget has no room for architectural renderings at any useful
/// resolution; the footer says so.
///
/// It ends by offering the construction fund, because somebody who has just
/// read what is being built is the person most likely to want to help build it.
/// That button opens the same Tithe.ly form `/c/give` does.
struct PlansView: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .plans) {
            AboutPage(slug: "future-plans") {
                sheet = IdentifiableURL(url: ClipConfig.givingURL)
            }

            ClipFooter(
                destination: .plans,
                readMore: "The church’s page has the renderings, the site drawing filed with the town, and a flythrough of the design."
            )
        }
        .safari(url: $sheet)
    }
}
