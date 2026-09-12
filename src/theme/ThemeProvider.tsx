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
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

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

const ThemeContext = createContext<ResolvedTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);
  const { width } = useWindowDimensions();

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
        // built-in default renders the parish's own colours either way.
      }
      if (cancelled) return;
      setTokens(booted);
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

  // Nothing is drawn until the cache read settles; the splash screen is still
  // up, so this null is invisible rather than a blank frame.
  if (!tokens) return null;

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

/** The resolved tokens. Every colour and size in the app comes from here. */
export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme was called outside ThemeProvider.');
  return theme;
}
