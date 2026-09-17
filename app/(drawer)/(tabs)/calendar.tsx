import { useRouter, type Href } from 'expo-router';

import { CalendarScreen } from '@/calendar/CalendarScreen';

/**
 * A wrapper, and that is the rule rather than this file being unfinished.
 *
 * Anything with logic in a route file is unreachable from the App Clip, which
 * resolves `index.clip.ts` and never imports expo-router. `/calendar` is one of
 * the nine invocation URLs, so the screen has to be a component in `src/` that
 * the clip can render without a router. `src/gallery/` already works this way.
 *
 * Which is why navigation arrives from here rather than being done in there.
 * An occurrence read from the church's own events carries `href` —
 * `/events/summercamp` — and the app has that screen; `CalendarScreen` cannot
 * reach it, because importing the router into `src/calendar/` would put the
 * whole route tree back in the clip's bundle. So the router stays on this side
 * of the seam and is handed down as a function. A clip passes nothing, and the
 * link is simply absent there, which is the truth: a clip has no events screen.
 */
export default function CalendarTab() {
  const router = useRouter();

  /*
   * `Href` rather than `string`. The occurrence's href is a path the *website*
   * decided on — `occurrenceOfEvent` in @spsm/shared writes it — so typed
   * routes cannot check it here, and the cast is the honest place to say so.
   * The same cast, for the same reason, as the gallery's own breadcrumbs.
   */
  return <CalendarScreen onOpenPage={(href) => router.push(href as Href)} />;
}
