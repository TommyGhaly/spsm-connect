import Foundation

/// Everything the clip needs to know about the church's systems.
///
/// Hardcoded, and that is the right call for a binary with a 15 MB budget and no
/// JavaScript: there is nothing here that is secret, nothing that changes
/// between builds, and a remote configuration fetch to learn one's own project
/// id would be a round trip before the first frame.
///
/// Every value has a counterpart in the app. Where one exists, its file is
/// named, because these two copies must not drift.
enum ClipConfig {
    /// The church's site, and the origin every API call goes to.
    ///
    /// `www.`, not the apex — see the note in `plugins/withNativeClip.js`. The
    /// app's own `api/client.ts` points at `spsm-database.web.app`, the Hosting
    /// origin behind this host; both serve the same site and either works, but
    /// the tags say `www.spsmwayland.org` and this is what a person would see
    /// if a link ever became visible.
    static let origin = URL(string: "https://www.spsmwayland.org")!

    /// The Firebase project, for the REST calls in `FirestoreREST.swift`.
    ///
    /// Matches `GoogleService-Info.plist` in the app target. The clip ships no
    /// plist at all — there is no Firebase SDK here to read one.
    static let firebaseProjectId = "spsm-database"

    /// The Firebase web API key.
    ///
    /// **Not a secret.** It identifies the project and authorises nothing;
    /// Firestore rules are the protection, which is why `faults`, `mail` and
    /// every private collection are closed to clients regardless of this value.
    /// The app's `.env` carries the same one under
    /// `EXPO_PUBLIC_FIREBASE_API_KEY`, and the website ships it in a browser
    /// bundle.
    static let firebaseApiKey = "AIzaSyBy6QGs1IZZlzEF4PJmZn129VRUdfGJFLk"

    /// The church's Tithe.ly form, from `src/giving/config.ts`.
    ///
    /// Committed there rather than read from the environment, for the reason
    /// that file gives: a giving page that depends on an env var is a giving
    /// page broken in every build that is not a laptop with a `.env`.
    static let givingURL = URL(
        string: "https://give.tithe.ly/?formId=44f1af1b-7edf-4005-af05-0c7a7f7249ac"
    )!

    /// The shared container with the full app.
    ///
    /// A photograph taken in the clip is written here so that installing the app
    /// afterwards can find it — iOS clears the clip's own storage without
    /// warning, and the picture somebody just took of their child's baptism is
    /// the one thing worth surviving that.
    static let appGroup = "group.org.spsm.connect"

    /// A page on the church's site, for the reading this clip hands off.
    static func page(_ path: String) -> URL {
        URL(string: path, relativeTo: origin)?.absoluteURL ?? origin
    }

    /// An endpoint on the church's API.
    static func api(_ path: String) -> URL {
        URL(string: path, relativeTo: origin)?.absoluteURL ?? origin
    }
}
