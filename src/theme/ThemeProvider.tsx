/**
 * Theme at runtime, cache first.
 *
 * The website's equivalent is a blocking inline <script> in <head>
 * (ThemeBootScript) that re-applies cached CSS before first paint, plus an
 * effect that fetches fresh afterwards. The reason is the same on both: a theme
 * that arrives after the first frame is a visible flash of the wrong colours.
 *
 * Here the splash screen stands in for "before first paint" — it is held until
 * the cached tokens are in hand, which on a returning visitor is one AsyncStorage
 * read, and on a first run is DEFAULT_THEME with no wait at all. The network
 * fetch always happens afterwards, never in front of the user.
 *
 * `BootSplash` is that wait made visible: the same lockup the OS has been
 * showing, redrawn in React with a wheel under it, so the launch is obviously
 * working rather than a still that might be stuck. It is what this provider
 * lays over its children, and it is the thing that dismisses the native splash
 * — see its header for the handoff.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { BootSplash } from './BootSplash';
import {
  DEFAULT_THEME,
  THEME_SCHEMA_VERSION,
  fetchTheme,
  resolveForScreen,
  type ResolvedTheme,
  type ThemeTokens,
} from './tokens';

/*
 * The schema version is in the key, so a binary that understands version 2
 * never reads a version 1 blob written by its predecessor. Bumping
 * THEME_SCHEMA_VERSION invalidates the cache for free.
 */
const CACHE_KEY = `spsm.theme.tokens.v${THEME_SCHEMA_VERSION}`;

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or the module is unavailable in this context. Not fatal —
  // the worst case is the flash this function exists to avoid.
});

/**
 * How long the wheel stays on screen once somebody can actually see it.
 *
 * A minimum, not a delay for its own sake, and it exists because without one
 * the wheel is a coin toss. The thing it covers is a single AsyncStorage read,
 * which on a warm start settles in a few milliseconds — often before the boot
 * splash's own image has finished decoding, so the app would go straight from
 * the OS's still image to the first screen and the wheel would never be drawn
 * at all. That is not a launch screen with a wheel in it; it is a launch screen
 * with an intermittent flicker in it.
 *
 * Nothing waits on this but the reveal. The app is mounted underneath the boot
 * splash as soon as the theme is in hand — see the render below — so the
 * session, App Check and the first screen are all warming up behind it, and
 * what this buys at the end is a first frame that is ready rather than one
 * that is still settling.
 */
const SPLASH_DWELL_MS = 800;

const ThemeContext = createContext<ResolvedTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);
  const [dwelling, setDwelling] = useState(true);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const { width } = useWindowDimensions();

  const noteShown = useCallback(() => {
    // `onDisplay` may fire again on a re-render; the first one is the one that
    // says when somebody started looking at this.
    setShownAt((already) => already ?? Date.now());
  }, []);

  /*
   * The dwell, timed from the moment the wheel is genuinely on screen.
   *
   * This effect runs twice: once at mount, where `shownAt` is still null and
   * the clock therefore starts now, and again when `onShown` says the image
   * has rendered, which restarts it from that instant. The first pass is not
   * waste — it is the fallback, and it is why a decode that never finishes
   * cannot strand the app under a lid that will not lift.
   */
  useEffect(() => {
    const since = shownAt ?? Date.now();
    const timer = setTimeout(
      () => setDwelling(false),
      Math.max(0, SPLASH_DWELL_MS - (Date.now() - since)),
    );
    return () => clearTimeout(timer);
  }, [shownAt]);

  // Boot: cache, or the built-in default. Never the network.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let booted: ThemeTokens = DEFAULT_THEME;
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) booted = JSON.parse(cached) as ThemeTokens;
      } catch {
        // A corrupt or absent cache is not worth a word to the user; the
        // built-in default renders the church's own colours either way.
      }
      if (cancelled) return;
      setTokens(booted);
      /*
       * Belt and braces. `BootSplash` hides the native splash from `onDisplay`
       * and normally gets here first, but that callback depends on an image
       * decoding: if it never fires, the still image would otherwise stay over
       * a perfectly working app forever. Calling it twice is a no-op.
       */
      await SplashScreen.hideAsync().catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh: after the first frame, and quietly. A failure leaves what is
  // already on screen alone, which is the whole point of caching it.
  useEffect(() => {
    if (!tokens) return;
    let cancelled = false;

    (async () => {
      try {
        const fresh = await fetchTheme();
        if (cancelled) return;
        setTokens(fresh);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch {
        // Offline, or the read failed. The cached theme stands.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately once, on the transition out of null — not on every token
    // change, which would re-fetch in response to its own write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens === null]);

  const resolved = useMemo(() => {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    return resolveForScreen(tokens ?? DEFAULT_THEME, platform, width);
  }, [tokens, width]);

  /*
   * Two separate questions, and they used to be one.
   *
   * `tokens === null` decides whether the **app** may draw: nothing of it does
   * until the cached theme is in hand, because a screen painted in the default
   * palette and then repainted in the church's is the flash this whole file
   * exists to prevent.
   *
   * `covered` decides whether the **splash** is still over the top of it, and
   * it is both conditions rather than just the dwell: the dwell can elapse
   * while the theme read is still out — a cold AsyncStorage read on a tired
   * phone — and a lid that lifted then would reveal the nothing that the first
   * clause is deliberately rendering.
   *
   * In between the two, the app is mounted and invisible: it gets its session,
   * its App Check token and its first layout done under the lid, and the lid
   * comes off onto a finished screen.
   */
  const covered = tokens === null || dwelling;

  return (
    <ThemeContext.Provider value={resolved}>
      {tokens === null ? null : children}
      {covered ? <BootSplash onShown={noteShown} /> : null}
    </ThemeContext.Provider>
  );
}

/** The resolved tokens. Every colour and size in the app comes from here. */
export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme was called outside ThemeProvider.');
  return theme;
}
