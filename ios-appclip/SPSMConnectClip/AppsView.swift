import SwiftUI

/// `/c/apps` — the church's apps, and where to get them.
///
/// The circularity is real and is argued in `src/clip/experiences.ts`: an App
/// Clip *is* an App Store card, so a clip advertising apps sounds redundant. It
/// stays because the printed card this opens from lists several things, only one
/// of which is this app — and a Smart App Banner cannot introduce Taksis.
///
/// ## Short, here, more than anywhere else in the clip
///
/// This screen is read standing up, seconds after a tag was tapped, and the
/// question it answers is "which of these do I want". A sentence each is the
/// whole budget; the app's `/apps` screen and the website's page carry the
/// longer wording for somebody sitting down. The one thing that must be plain
/// is that **Taksis is the servants' app** — it was described here as the
/// parking and traffic app, which is one of the things it does and not what it
/// is for.
///
/// ## Pictures before words
///
/// It opens on a deep band holding all three icons, because the icon is what
/// somebody will be looking for in a store and on their home screen — the
/// shape is learned here, not the name. Each icon is a button down to its own
/// card. Under each sentence, a row of chips says what the app holds in a word
/// apiece: glanced at rather than read, which is what keeps the sentence
/// budget honest. SPSM Connect's card is drawn dark, since it is the one the
/// reader is already holding, and lists what the full app adds.
struct AppsView: View {
    @State private var sheet: IdentifiableURL?
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    struct Feature: Hashable {
        let symbol: String
        let label: String
    }

    struct ChurchApp: Identifiable {
        var id: String { name }
        let name: String
        /// Who publishes it, when that is not the church — as the website's
        /// `app-card__by` does. It is why the app a reader installs is not
        /// called St. Philopater Mercurius & St. Mina.
        let by: String?
        let blurb: String
        /// The app's own icon, on the church's site — the same file the app's
        /// `src/apps/stores.ts` draws, fetched rather than bundled because a
        /// clip has 15 MB and a store icon is not where to spend any of it.
        ///
        /// These are **third-party trademarks** where the app is somebody
        /// else's, shown to identify their app and nothing else: not cropped,
        /// not recoloured, not redrawn, not rotated. The stripe and the chips
        /// around it are the card's colour, never the icon's.
        let icon: URL
        let appStore: URL
        /// The card's stripe and chip colour.
        let tone: Color
        /// The eyebrow's colour: the tone, darkened where the tone itself is
        /// too pale to read as small type on paper. Gold is 2.9:1 there.
        let label: Color
        let features: [Feature]
    }

    /// From `src/apps/stores.ts`. Two entries, because those are the two the
    /// church actually ships to a store besides this one.
    static let apps: [ChurchApp] = [
        ChurchApp(
            name: "Taksis",
            by: nil,
            blurb: "The servants’ app, and a parent’s, for their children’s accounts.",
            icon: ClipConfig.page("/img/app-taksis-192.webp"),
            appStore: URL(string: "https://apps.apple.com/us/app/taksis/id6743824691")!,
            tone: Ink.gold,
            label: Color(hex: 0x7A5F24),
            features: [
                Feature(symbol: "calendar", label: "Schedules"),
                Feature(symbol: "checklist", label: "Attendance"),
                Feature(symbol: "figure.and.child.holdinghands", label: "Children’s accounts"),
                Feature(symbol: "car", label: "Vehicles"),
            ]
        ),
        ChurchApp(
            name: "Tithe.ly",
            by: "Tithe.ly",
            blurb: "The giving app the church uses. You can give without it, from the church’s own page.",
            icon: ClipConfig.page("/img/app-tithely-192.webp"),
            appStore: URL(string: "https://apps.apple.com/us/app/tithely-giving/id694740700")!,
            tone: Ink.azure,
            label: Ink.azure,
            features: [
                Feature(symbol: "heart", label: "Give once"),
                Feature(symbol: "repeat", label: "Or on a schedule"),
            ]
        ),
    ]

    static let connectIcon = ClipConfig.page("/img/app-spsm-connect-192.webp")

    static let connectFeatures: [Feature] = [
        Feature(symbol: "calendar", label: "Calendar"),
        Feature(symbol: "photo.on.rectangle", label: "Galleries"),
        Feature(symbol: "doc.text", label: "Forms"),
        Feature(symbol: "book.closed", label: "Bookstore"),
        Feature(symbol: "heart", label: "Offering"),
        Feature(symbol: "bell", label: "Reminders"),
    ]

    var body: some View {
        ClipScreen(destination: .apps) {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 16) {
                    AppsHero { name in
                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.35)) {
                            proxy.scrollTo(name, anchor: .top)
                        }
                    }
                    .rise(shown, delay: 0, reduceMotion: reduceMotion)

                    ForEach(Array(Self.apps.enumerated()), id: \.element.id) { index, app in
                        ChurchAppCard(app: app) {
                            sheet = IdentifiableURL(url: app.appStore)
                        }
                        .id(app.name)
                        .rise(shown, delay: 0.08 * Double(index + 1), reduceMotion: reduceMotion)
                    }

                    ConnectCard {
                        sheet = IdentifiableURL(url: ClipConfig.appStore)
                    }
                    .id("SPSM Connect")
                    .rise(shown, delay: 0.24, reduceMotion: reduceMotion)
                }
            }
        }
        .safari(url: $sheet)
        .onAppear { shown = true }
    }
}

/// The band the screen opens on: the three icons side by side, over the
/// church's deep red, each one a button down to its card.
private struct AppsHero: View {
    let jump: (String) -> Void

    private var icons: [(name: String, url: URL)] {
        AppsView.apps.map { ($0.name, $0.icon) } + [("SPSM Connect", AppsView.connectIcon)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("ON YOUR PHONE")
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.gold)
                Text("Three apps, one church")
                    .font(Face.heading)
                    .foregroundStyle(Ink.inkInverse)
                Text("Two to install, and the one you are holding now.")
                    .font(Face.body)
                    .foregroundStyle(Ink.inkInverse.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(alignment: .top, spacing: 0) {
                ForEach(icons, id: \.name) { item in
                    Button {
                        jump(item.name)
                    } label: {
                        VStack(spacing: 8) {
                            AppIconImage(url: item.url, size: 60, lifted: true)
                            Text(item.name)
                                .font(Face.small.weight(.semibold))
                                .foregroundStyle(Ink.inkInverse)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .minimumScaleFactor(0.85)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(Lift())
                    .accessibilityLabel(item.name)
                    .accessibilityHint("Shows where to get it")
                }
            }
            .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Ink.deep, Ink.accentStrong],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(alignment: .topTrailing) {
            // A gold ring, half off the corner: the one ornament on the
            // screen, and it is the colour of the eyebrow it sits above.
            Circle()
                .strokeBorder(Ink.gold.opacity(0.35), lineWidth: 1.5)
                .frame(width: 140, height: 140)
                .offset(x: 50, y: -60)
                .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

/// One app to install: a coloured stripe down the leading edge, the icon and
/// name, a sentence, chips, and Apple's badge.
private struct ChurchAppCard: View {
    let app: AppsView.ChurchApp
    let get: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                AppIconImage(url: app.icon, lifted: true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(app.by.map { "By \($0)" }?.uppercased() ?? "THE CHURCH’S OWN")
                        .font(Face.label)
                        .kerning(0.8)
                        .foregroundStyle(app.label)
                    ClipHeading(text: app.name)
                }
            }

            ClipBody(text: app.blurb)

            Wrap(spacing: 6) {
                ForEach(app.features, id: \.self) { feature in
                    FeatureChip(feature: feature, tone: app.tone)
                }
            }
            .accessibilityElement(children: .combine)

            /* A hairline, because the badge is artwork and not this card's
               type: without it the black pill sits directly under the chips
               and reads as one more of them rather than as the thing to tap. */
            Rectangle().fill(Ink.rule).frame(height: 1)

            /*
             * Apple's own badge, as on the website and on the app's `/apps` —
             * `StoreBadge.swift` carries the rules about it, and why this
             * screen shows one store where the other two show two.
             *
             * Still the Safari sheet and not `UIApplication.open`: the reason
             * `Handoff.swift` gives holds for a store page as much as for a
             * liturgy tour. Leaving the clip dismisses the card, and somebody
             * who has just looked at Taksis should come back to the card that
             * offers them this one.
             */
            AppStoreBadge(appName: app.name, action: get)
        }
        .padding(16)
        .padding(.leading, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.paperRaised)
        .overlay(alignment: .leading) {
            Rectangle().fill(app.tone).frame(width: 4).accessibilityHidden(true)
        }
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Ink.rule, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct FeatureChip: View {
    let feature: AppsView.Feature
    let tone: Color

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: feature.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(tone)
                .accessibilityHidden(true)
            Text(feature.label)
                .font(Face.small)
                .foregroundStyle(Ink.ink)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tone.opacity(0.1))
        .overlay(Capsule().strokeBorder(tone.opacity(0.3), lineWidth: 1))
        .clipShape(Capsule())
    }
}

/*
 * The third icon is fetched like the other two rather than read out of this
 * bundle's own `AppIcon`: pulling an app icon from an asset catalogue at
 * runtime is not something iOS promises, and the file on the site is the same
 * artwork — `scripts/make-icons.mjs` here generates `assets/icon.png`, and the
 * website's `assets/apps/spsm-connect-icon.png` is a copy of it.
 */
private struct ConnectCard: View {
    let get: () -> Void

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                AppIconImage(url: AppsView.connectIcon, lifted: true)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        LiveDot()
                        Text("YOU ARE USING IT NOW")
                            .font(Face.label)
                            .kerning(0.8)
                            .foregroundStyle(Ink.gold)
                    }
                    Text("SPSM Connect")
                        .font(Face.heading)
                        .foregroundStyle(Ink.inkInverse)
                }
            }

            Text("This is a quick preview. The full app keeps all of it, and your iPhone removes the preview on its own.")
                .font(Face.body)
                .foregroundStyle(Ink.inkInverse.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)

            LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                ForEach(AppsView.connectFeatures, id: \.self) { feature in
                    HStack(spacing: 8) {
                        Image(systemName: feature.symbol)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Ink.gold)
                            .frame(width: 22)
                            .accessibilityHidden(true)
                        Text(feature.label)
                            .font(Face.small.weight(.medium))
                            .foregroundStyle(Ink.inkInverse)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.07))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .accessibilityElement(children: .combine)

            /*
             * The badge, like the other two, now that the app has a product
             * page — see `Handoff.swift` for why Apple's artwork must link to
             * a real listing. The other "Get SPSM Connect" buttons in the clip
             * keep the overlay: it is Apple's mechanism for a clip offering its
             * own app, and it needs no card to say which. Apple's black badge
             * carries its own grey edge, which is what lets it sit on red.
             */
            AppStoreBadge(appName: "SPSM Connect", action: get)

            Text("Free, and from the church’s own developer account.")
                .font(Face.small)
                .foregroundStyle(Ink.inkInverse.opacity(0.65))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.deep)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

/// A small gold dot that breathes: "this one is running". Still, under
/// Reduce Motion.
private struct LiveDot: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(Ink.gold)
            .frame(width: 7, height: 7)
            .background(
                Circle()
                    .fill(Ink.gold.opacity(0.4))
                    .scaleEffect(pulse ? 2.4 : 1)
                    .opacity(pulse ? 0 : 1)
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) {
                    pulse = true
                }
            }
            .accessibilityHidden(true)
    }
}

/// A press on an icon: it sinks a little. The icon itself is untouched — no
/// tint, no fade — for the reason `AppIconImage` gives.
private struct Lift: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

private extension View {
    /// Cards arrive in turn, rising a few points as they fade in. Under Reduce
    /// Motion they are simply there.
    func rise(_ shown: Bool, delay: Double, reduceMotion: Bool) -> some View {
        opacity(shown || reduceMotion ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 14)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(delay), value: shown)
    }
}

/// One app's icon: 64pt square by default, as on the app's `/apps` screen, over the sunken
/// paper that holds the row open while the file arrives so the name does not
/// jump left as the icon lands.
///
/// Decorative, hence hidden rather than described — the app's name is on the
/// line beside it, and a screen reader announcing both says "Taksis Taksis".
struct AppIconImage: View {
    let url: URL
    var size: CGFloat = 64
    /// A soft shadow under the icon, as a home screen draws one. It is cast
    /// *by* the icon rather than drawn on it, so the artwork is unchanged.
    var lifted: Bool = false
    /// 16 at 64, which is `radius.lg`; kept in proportion at other sizes so a
    /// smaller icon still reads as an icon and not a rounded thumbnail.
    private var radius: CGFloat { size / 4 }

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                // No spinner and no broken-image glyph: a 64pt square of paper
                // is the honest state both while it loads and if it never
                // does, and the card reads without it either way.
                Color.clear
            }
        }
        .frame(width: size, height: size)
        .background(Ink.paperSunken)
        /*
         * 16, which is `radius.lg`, and it was 8. A 64pt icon on a home screen
         * is rounded at about fourteen points; at eight this square read as a
         * thumbnail *of* an app icon rather than as the icon — on the one
         * screen whose job is helping somebody recognise the thing they are
         * about to look for in a store. The app's own cards made the same move.
         *
         * The hairline comes with it, and earns its place twice here: Tithe.ly's
         * icon is pale at the edges and would dissolve into the card, and this
         * square is empty paper until a fetched file arrives, which without an
         * edge is a gap rather than a space being held.
         */
        .clipShape(RoundedRectangle(cornerRadius: radius))
        .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Ink.rule, lineWidth: 1))
        .shadow(color: Ink.ink.opacity(lifted ? 0.18 : 0), radius: 6, y: 3)
        .accessibilityHidden(true)
    }
}
