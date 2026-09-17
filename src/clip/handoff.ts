/**
 * The two ways out of an App Clip: the App Store, and the website.
 *
 * ## Why there is no "open the full app" here
 *
 * There is no reliable way for a clip to launch its parent, and there is no
 * need for one. If the app is installed, iOS opens **the app** for
 * `www.spsmwayland.org/c/<slug>` and this binary never runs at all — that is what
 * the `applinks` entry in the association file buys, and it is why
 * `app/c/[slug].tsx` exists on the app side. A clip running at all is evidence
 * the app is not installed.
 *
 * `spsmconnect://` would be the obvious attempt and is a trap: the clip target's
 * own Info.plist declares that scheme too, so the clip would be a candidate for
 * opening its own URL.
 *
 * So: `recommendApp` is Apple's own App Clip overlay — the card that slides up
 * from the bottom offering the full app — and `openSite` is the honest second
 * answer for somebody who does not want it.
 */
import { displayOverlay } from 'react-native-app-clip';
import * as WebBrowser from 'expo-web-browser';

import type { ResolvedTheme } from '@/theme/tokens';

import { PUBLIC_ORIGIN } from './experiences';

/**
 * Apple's "Get the app" overlay.
 *
 * `SKOverlay.AppClipConfiguration`, which needs no App Store id — the system
 * already knows which app this clip belongs to, which is why this works today
 * while the Smart App Banner on the website's fallback pages cannot be written
 * until SPSM Connect has an id.
 *
 * Failure is swallowed on purpose. The overlay is unavailable in the Simulator
 * and when the app is already installed, and neither is worth an error in front
 * of somebody who was trying to do something else.
 */
export function recommendApp(): void {
  try {
    void displayOverlay();
  } catch {
    // Not a clip, no scene, or already installed. Nothing to say.
  }
}

/** Open an absolute URL over the clip, in the church's colours where we have them. */
export function openExternal(url: string, theme?: ResolvedTheme): void {
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: 'done',
    ...(theme
      ? {
          controlsColor: theme.color.accent,
          toolbarColor: theme.color.paperRaised,
          secondaryToolbarColor: theme.color.paperSunken,
        }
      : {}),
    /*
     * The address stays visible. Every one of these goes somewhere that is not
     * this app — the church's own site, or Tithe.ly's form — and a page that
     * hides where it is while asking for anything is the thing
     * `giving/open.ts` refuses to build.
     */
    enableBarCollapsing: false,
    showTitle: true,
  }).catch(() => {
    // Rejects when a browser is already presenting: a second press, and there
    // is no state worth showing anybody about it.
  });
}

/**
 * The website page for an app route.
 *
 * The two share a slug space by design — `/about/welcome-newcomers` is the same
 * page in a browser and in this app, as `about/pages.ts` says — so a path that
 * this binary cannot draw is very nearly always a page the site can.
 */
export function openSite(path: string, theme?: ResolvedTheme): void {
  openExternal(`${PUBLIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`, theme);
}
