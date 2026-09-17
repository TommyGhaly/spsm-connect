/**
 * `/c/plans` — the three buildings designed for 169 Rice Road.
 *
 * The full app's `/about/future-plans` screen, unforked, with one substitution
 * underneath it: `Film.clip.tsx` replaces the WebView player, because
 * `react-native-webview` is not in this target. See that file.
 *
 * The page ends by asking for a gift toward the construction fund, and that
 * button works here — it opens the same Tithe.ly form `/c/give` does, through
 * `giving/open.ts`, which this binary carries anyway.
 */
import { FutureScreen } from '@/about/FutureScreen';
import { AboutCopyProvider } from '@/about/overrides';

export function Plans() {
  return (
    <AboutCopyProvider slug="future-plans">
      <FutureScreen />
    </AboutCopyProvider>
  );
}
