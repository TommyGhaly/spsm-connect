/**
 * Which experience this clip was invoked for.
 *
 * ## Where the URL comes from
 *
 * An App Clip is launched by an `NSUserActivity` carrying the invocation URL,
 * which the clip's `AppDelegate` passes to `RCTLinkingManager` exactly as the
 * app target does for a universal link — see the `continue userActivity:` block
 * in `ios/SPSMConnectClip/AppDelegate.swift`, which `react-native-app-clip`
 * generates and this project has verified. So `expo-linking` answers it, and
 * nothing native is needed here.
 *
 * ## Why there is a grace period rather than one read
 *
 * `getInitialURL()` can answer `null` on the first tick: the activity is
 * delivered to the delegate, and whether that has happened before React's first
 * render is a race this code does not control. Deciding "no URL, show the hub"
 * on that first null would mean an invocation for `/c/schedule` occasionally
 * opening the hub instead — intermittent, device-dependent, and invisible in a
 * simulator, which is the worst kind of bug to ship on a printed tag.
 *
 * So a null is provisional for `GRACE_MS` and the listener is live throughout.
 * The cost is a fifth of a second of the church's mark on a genuinely blank
 * launch, which happens only when somebody opens the clip from the App Clip
 * card in Recents rather than from a tag.
 *
 * ## Which hosts count
 *
 * Both the church's domain and the Firebase Hosting origin behind it, because a
 * build pointed at `spsm-database.web.app` for its API is still a build whose
 * tags say `www.spsmwayland.org`. The path is what identifies the experience;
 * the host only has to be one of ours.
 *
 * The bare apex is in the list although **no tag may be printed with it** — it
 * answers 301 to the `www` host, and Apple follows no redirect from an
 * invocation URL, so an apex tag never reaches this code at all. It is here for
 * the case that costs nothing to allow and would be baffling to refuse: a URL
 * typed by hand, or one Apple resolves some other way in a future release.
 * `experiences.ts` carries the full account.
 */
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

import { CLIP_PREFIX, experience, type ClipSlug } from './experiences';

const HOSTS = new Set(['spsmwayland.org', 'www.spsmwayland.org', 'spsm-database.web.app']);

/** How long a missing URL stays provisional. */
const GRACE_MS = 200;

/**
 * The slug in an invocation URL, or null.
 *
 * Exported for its own sake because `app/c/[slug].tsx` in the full app answers
 * the same question from the other side, and a second parser would be a second
 * thing to keep in step.
 */
export function slugOf(url: string | null | undefined): ClipSlug | null {
  if (!url) return null;

  let parsed: { hostname: string | null; path: string | null };
  try {
    parsed = Linking.parse(url);
  } catch {
    return null;
  }

  // `spsmconnect://c/schedule` has no host and is ours by construction; an
  // https URL has to come from a host the church publishes.
  if (parsed.hostname && !HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const path = `/${(parsed.path ?? '').replace(/^\/+/, '')}`;
  if (!path.startsWith(`${CLIP_PREFIX}/`)) return null;

  const slug = path.slice(CLIP_PREFIX.length + 1).split('/')[0] ?? '';
  return experience(slug)?.slug ?? null;
}

export interface Invocation {
  slug: ClipSlug | null;
  /**
   * The URL as it arrived, kept for one caller.
   *
   * `ClipRoot` reads it to recognise `/c/appcheck` — the diagnostic that is not
   * an experience, is registered nowhere, and exists to be launched by hand
   * from Xcode's App Clip URL field. See its own screen.
   */
  raw: string | null;
  /** False until an answer is worth acting on. See the grace period above. */
  ready: boolean;
}

export function useInvocation(): Invocation {
  const [slug, setSlug] = useState<ClipSlug | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;

    const accept = (url: string | null) => {
      if (!live || !url) return;
      setRaw(url);
      const next = slugOf(url);
      if (next) setSlug(next);
      setReady(true);
    };

    void Linking.getInitialURL().then(accept);
    const subscription = Linking.addEventListener('url', ({ url }) => accept(url));
    const timer = setTimeout(() => {
      if (live) setReady(true);
    }, GRACE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return { slug, raw, ready };
}
