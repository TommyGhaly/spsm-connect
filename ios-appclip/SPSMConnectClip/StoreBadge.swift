import SwiftUI

/// Apple's App Store badge, for the one screen in this clip that links to a
/// store.
///
/// The clip's third copy of the same thing: the website's
/// `components/StoreBadges.tsx`, the app's `src/components/StoreBadges.tsx`,
/// and this. All three exist so that a reader who taps a tag, opens the app, or
/// lands on the site is looking at the same black pill — and so that the rules
/// about that pill are written down once per platform rather than once per
/// screen.
///
/// **The badge is not ours to touch.** It may not be recoloured, recomposed,
/// redrawn or reworded. That is the whole reason this is not a `ClipButton`
/// with an image inside it: SwiftUI's default button style fades its label on
/// press, and a dimmed badge is a modified badge. `BadgePress` below scales and
/// does nothing else, which is the artwork at a different size — the one change
/// Apple allows.
///
/// ## Bundled, where this clip fetches everything else
///
/// `AppsView` pulls the three app icons off the church's site rather than
/// bundling them, on the argument that a clip has 15 MB and a store icon is not
/// where to spend any of it. That argument is right about icons and wrong about
/// this. An icon that has not arrived is a card missing a picture, and the card
/// still reads; a badge that has not arrived is the only way off this screen.
/// The clip is opened by somebody standing in the church building seconds after
/// touching a tag, on whatever signal the building has, and this screen's
/// entire purpose is the links on it. Under twenty kilobytes of the fifteen
/// megabytes buys that — measured on the compiled `Assets.car`, which is the
/// number the budget counts — and `AppIconImage` keeps its placeholder for the
/// rest.
///
/// ## Apple's SVG, not the app's raster
///
/// The React Native side ships a 4x PNG rasterised from this same official
/// file, because `expo-image`'s iOS decoder is documented as not handling every
/// valid path and this badge is full of arc commands. Nothing here decodes it
/// at runtime: `actool` rasterises 1x, 2x and 3x at build time and keeps the
/// vector alongside them, so the clip carries Apple's published file unaltered
/// and draws it exactly at any size.
///
/// `preserves-vector-representation` in the imageset's `Contents.json` is doing
/// real work and is not boilerplate. The natural size is Apple's 119.66x40 and
/// the pill below is drawn at 44 tall, so the 3x raster alone would be stretched
/// about a tenth; the vector is what makes that sharp. Do not drop the property
/// to save the fourth rendition.
///
/// Copied byte for byte from the website's `public/brand/`; if Apple reissues
/// the artwork, replace the file rather than editing one.
///
/// ## One store, where the other two show two
///
/// The website and the app offer Google Play beside this, because somebody
/// holding an iPhone is quite often the person setting up a parent's Android.
/// Not here. An App Clip only ever runs on an iPhone, this screen is read
/// standing up in the seconds after a tag was tapped, and `AppsView`'s header
/// sets the budget at a sentence each — a second pill under every card doubles
/// the height of the one screen that has to stay short. The Android reader is
/// not dropped, they are handed on: the full app's `/apps` and the church's own
/// `/apps` page both carry both badges, and the clip offers the page.
///
/// If that is ever reversed, the Play badge needs its own imageset and the
/// height dance the other two do — Google ships its pill inside mandated clear
/// space, so matching the box heights draws it a fifth short. Both sibling
/// files have the measured numbers.
struct AppStoreBadge: View {
    /// Named in the accessible label, because the badge cannot carry it.
    ///
    /// Three cards on this screen would otherwise give VoiceOver three controls
    /// all announcing "Download on the App Store". Putting the name *on* the
    /// artwork would be rewording it, so it goes in the label — exactly as the
    /// website appends it in a visually hidden span.
    let appName: String
    let action: () -> Void

    /// 44, which is the website's 2.75rem, the app's `PILL_HEIGHT`, and Apple's
    /// minimum tap target. Here the pill *is* the target, so the three
    /// constraints are one.
    private static let height: CGFloat = 44
    /// Apple's viewBox is 119.66407x40 and the box is the pill — the artwork
    /// fills it, with no clear space to account for.
    private static let width = height * 119.66407 / 40

    var body: some View {
        Button(action: action) {
            // `decorative`, so the asset name never reaches VoiceOver: the
            // label below is the whole of what this control announces.
            Image(decorative: "AppStoreBadge")
                .resizable()
                .frame(width: Self.width, height: Self.height)
        }
        .buttonStyle(BadgePress())
        .accessibilityLabel("Download on the App Store — \(appName)")
    }
}

/// A press is the badge, slightly smaller.
///
/// Nothing is tinted, dimmed, outlined or rounded — see `AppStoreBadge`. This
/// exists only because the default style's opacity fade would be a
/// modification of artwork that may not be modified.
private struct BadgePress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}
