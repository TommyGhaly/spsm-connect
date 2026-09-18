import Foundation

/// The eight experiences, as one enum.
///
/// The Swift half of `src/clip/experiences.ts`, and the four things that file
/// says every row must agree with apply here unchanged:
///
///   - `apps/website/public/.well-known/apple-app-site-association`
///   - `apps/website/public/c/<slug>.html`, the fallback page
///   - App Store Connect → Advanced App Clip Experiences
///   - `app/c/[slug].tsx`, where the **installed app** goes for the same URL
///
/// A slug added here without the other four is a tag that opens Safari.
enum ClipDestination: String, CaseIterable {
    case give
    case schedule
    case apps
    case welcome
    case plans
    case bookstore
    case forms
    case photos

    /// The card title in App Store Connect, repeated here for the clip's own
    /// header. Kept identical so the card and the screen agree.
    var title: String {
        switch self {
        case .give: return "Give"
        case .schedule: return "This Week"
        case .apps: return "The Parish’s Apps"
        case .welcome: return "Welcome"
        case .plans: return "Our Expansion Plans"
        case .bookstore: return "The Bookstore"
        case .forms: return "Parish Forms"
        case .photos: return "Send a Photograph"
        }
    }

    /// The page on the church's site that says the same thing, for the reading
    /// this clip deliberately does not carry a second copy of.
    var sitePath: String {
        switch self {
        case .give: return "/giving"
        case .schedule: return "/calendar"
        case .apps: return "/apps"
        case .welcome: return "/about/welcome-newcomers"
        case .plans: return "/about/future-plans"
        case .bookstore: return "/bookstore"
        case .forms: return "/forms"
        case .photos: return "/events"
        }
    }
}
