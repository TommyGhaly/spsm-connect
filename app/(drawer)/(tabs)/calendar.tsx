import { CalendarScreen } from '@/calendar/CalendarScreen';

/**
 * A wrapper, and that is the rule rather than this file being unfinished.
 *
 * Anything with logic in a route file is unreachable from the App Clip, which
 * resolves `index.clip.ts` and never imports expo-router. `/calendar` is one of
 * the nine invocation URLs, so the screen has to be a component in `src/` that
 * the clip can render without a router. `src/gallery/` already works this way.
 */
export default function CalendarTab() {
  return <CalendarScreen />;
}
