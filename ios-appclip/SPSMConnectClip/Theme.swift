import SwiftUI

/// The church's colours and type, as the clip's own copy.
///
/// Ported from `DEFAULT_THEME` in `@spsm/shared`'s `schema/theme.ts`. The app
/// reads that document from Firestore so the church can restyle itself without
/// a release; the clip does not, deliberately — a theme fetch before the first
/// frame would cost a round trip on a screen somebody is looking at *now*,
/// having just tapped a tag. These are the defaults, and a parish that
/// restyles itself will see the clip follow at the next app release.
enum Ink {
    static let ink = Color(hex: 0x1C1614)
    static let inkSoft = Color(hex: 0x4B413E)
    static let inkFaint = Color(hex: 0x6F5F5A)
    static let inkInverse = Color(hex: 0xF9EFEC)

    static let paper = Color(hex: 0xF6E8E3)
    static let paperRaised = Color(hex: 0xFDF7F4)
    static let paperSunken = Color(hex: 0xEEDDD7)

    static let rule = Color(hex: 0xE0CAC3)
    static let accent = Color(hex: 0x992A21)
    static let accentStrong = Color(hex: 0x731D16)
    static let accentSoft = Color(hex: 0xF6D8D0)

    static let gold = Color(hex: 0xB08D43)
    static let deep = Color(hex: 0x481010)

    /// `--color-azure`: the calendar's meetings and gatherings.
    static let azure = Color(hex: 0x2F5D8A)
}

/// The type scale.
///
/// Georgia, because that is `font.display.ios` in the theme and what
/// `scripts/brand.mjs` bakes into the icon and the splash. A clip that set its
/// headings in San Francisco would be the only part of the church's software
/// that did.
///
/// Every size follows the phone's text-size setting. They were fixed points
/// once, which looked tidy and left exactly the readers who had turned their
/// text up — a good share of a parish — reading 12pt labels. `relativeTo:`
/// keeps Georgia and scales it alongside the system style it names; the
/// system faces are the text styles themselves, whose default sizes are close
/// to the numbers they replace.
enum Face {
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Georgia", size: size, relativeTo: style)
    }
    static func displayBold(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Georgia-Bold", size: size, relativeTo: style)
    }

    static let title = displayBold(28, relativeTo: .title)
    static let heading = displayBold(21, relativeTo: .title2)
    static let lede = display(17, relativeTo: .body)
    static let body = Font.callout
    static let small = Font.subheadline
    static let label = Font.caption.weight(.semibold)
}

extension Color {
    /// `0xRRGGBB`, so the constants above read like the token file they came
    /// from rather than like three divisions.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
