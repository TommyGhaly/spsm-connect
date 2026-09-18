import Foundation

/// Turning an invocation URL into a destination.
///
/// The Swift port of `src/clip/invocation.ts`, and it keeps that file's two
/// decisions:
///
/// **The apex is accepted even though nothing should use it.** Entitlements and
/// tags name `www.`, because Apple follows no redirect and the apex 301s. But a
/// URL typed by hand, or printed on a card made before that was settled, should
/// still land somewhere useful rather than on the hub — so the host check is
/// deliberately lenient while the entitlements stay strict.
///
/// **An unknown slug is not an error.** It means a tag from a newer printing
/// than this binary. The hub is a better answer than a dead end.
enum ClipRouter {
    /// Where an invocation with no recognisable destination goes.
    ///
    /// `.apps` rather than a bespoke hub screen: somebody who tapped something
    /// the church printed has ended up here, and the most useful thing to show
    /// them is what the parish offers and how to get the full app.
    static let fallback: ClipDestination = .apps

    /// Resolve the destination for an invocation URL.
    static func destination(for url: URL?) -> ClipDestination {
        guard let url, let slug = slug(from: url) else { return fallback }
        return ClipDestination(rawValue: slug) ?? fallback
    }

    /// The `<slug>` in `https://host/c/<slug>`.
    ///
    /// Trailing slashes and query strings are tolerated because a tag is
    /// printed once and read for years, and a stray `?utm_source=` on one is
    /// not a reason to show the wrong screen.
    private static func slug(from url: URL) -> String? {
        let parts = url.path.split(separator: "/").map(String.init)
        guard parts.count >= 2, parts[0] == "c" else { return nil }
        return parts[1].lowercased()
    }

    /// The invocation URL for a run from Xcode.
    ///
    /// Xcode puts the scheme's App Clip Invocation URL in `_XCAppClipURL`, which
    /// is the only way to exercise routing on a simulator — a real invocation
    /// needs a tag or a registered Local Experience. Debug only: a release build
    /// must take its destination from the system and nowhere else, or a tag
    /// could be overridden by an environment variable.
    static func debugInvocationURL() -> URL? {
        #if DEBUG
            guard let raw = ProcessInfo.processInfo.environment["_XCAppClipURL"] else { return nil }
            return URL(string: raw)
        #else
            return nil
        #endif
    }
}
