import SwiftUI

/// `/c/plans` — the three buildings designed for 169 Rice Road.
///
/// The renderings are the point of this page and they are exactly what a clip
/// cannot carry: `src/about/future.ts` references a set of large images, and a
/// 15 MB budget has no room for architectural renderings at any useful
/// resolution. So the native card names the three buildings and what each is
/// for, and the pictures — and the flythrough — are on the church's page.
///
/// It ends by offering the construction fund, because somebody who has just
/// read what is being built is the person most likely to want to help build it.
/// That button opens the same Tithe.ly form `/c/give` does.
struct PlansView: View {
    @State private var sheet: IdentifiableURL?

    private struct Building {
        let letter: String
        let name: String
        let detail: String
    }

    private let buildings: [Building] = [
        Building(
            letter: "A",
            name: "The church",
            detail: "A wide arched west front between two bell towers, each capped with a cross, with the nave and aisles vaulted behind it."
        ),
        Building(
            letter: "B",
            name: "Youth centre, Sunday school and senior housing",
            detail: "The long one: Sunday school below, senior housing above, and a covered walk running the length of it."
        ),
        Building(
            letter: "C",
            name: "The diocese centre",
            detail: "Offices, meeting rooms and three apartments, in a plainer language than the church deliberately."
        ),
    ]

    var body: some View {
        ClipScreen(destination: .plans) {
            ClipCard(spacing: 12) {
                ClipEyebrow(text: "169 Rice Road, Wayland")
                ClipBody(
                    text: """
                    Three buildings, designed together around a paved piazza one level above \
                    the car park — the court the congregation would come out to after the \
                    Liturgy. The drawings are filed with the town.
                    """,
                    tone: Ink.ink
                )
            }

            ForEach(buildings, id: \.letter) { building in
                ClipCard(spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(building.letter)
                            .font(Face.displayBold(22))
                            .foregroundStyle(Ink.accent)
                        ClipHeading(text: building.name)
                    }
                    ClipBody(text: building.detail)
                }
            }

            ClipCard {
                ClipEyebrow(text: "The construction fund")
                ClipBody(text: "The church is raising the money to build this. A gift goes to the same place the offering does.")
                ClipButton(label: "Give toward it") {
                    sheet = IdentifiableURL(url: ClipConfig.givingURL)
                }
            }

            ClipFooter(
                destination: .plans,
                readMore: "The church's page has the renderings, the site drawing filed with the town, and a flythrough of the design."
            )
        }
        .safari(url: $sheet)
    }
}
