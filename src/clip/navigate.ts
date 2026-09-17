/**
 * Where "go somewhere" goes, inside an App Clip.
 *
 * The clip has no navigator — see `ClipRoot` for why — but the screens it
 * borrows from the full app were written against one. `AppsScreen` pushes
 * `/about/future-plans`; `Rich` pushes whatever a `<Link>` in Firestore copy
 * points at; `parts.tsx` pushes the next part of About. None of those screens
 * should have to know which binary they are running in.
 *
 * So this module is the one place that answers the question, and the expo-router
 * shim (`shims/expo-router.tsx`) is what routes their calls into it. Three
 * outcomes, in order:
 *
 *   1. **The path is another experience.** `/about/future-plans` is `/c/plans`,
 *      which this binary can draw. Swap the screen, no install, no browser.
 *   2. **The path is a screen only the full app has.** Hand off: the App Store
 *      overlay if the app is not installed, the app itself if it is.
 *   3. **It is an external URL.** Safari, over the clip, exactly as the full app
 *      would open it.
 *
 * The handler is registered by `ClipRoot` at mount rather than imported, because
 * the alternative is every screen importing the root that renders it.
 */
import { experienceForAppPath, type ClipSlug } from './experiences';
import { openExternal, openSite } from './handoff';

type Goer = (slug: ClipSlug) => void;

let goer: Goer | null = null;

/** Called once by `ClipRoot`. */
export function setClipNavigator(next: Goer | null): void {
  goer = next;
}

/**
 * Follow a path from a borrowed screen.
 *
 * `path` is whatever the screen would have pushed in the full app: an app route
 * like `/about/future-plans`, or an absolute URL.
 */
export function goFromClip(path: string): void {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    openExternal(path);
    return;
  }

  const experience = experienceForAppPath(path);
  if (experience && goer) {
    goer(experience.slug);
    return;
  }

  /*
   * Nothing here can draw it. The website can: the app's routes and the site's
   * pages share a slug space, so the page behind `/about/patron-saints` is
   * `spsmwayland.org/about/patron-saints`. Safari over the clip is a better
   * answer than an install nag for somebody who tapped a link mid-sentence —
   * the offer of the full app is standing at the foot of every clip screen
   * already, and does not need to interrupt this.
   */
  openSite(path);
}
