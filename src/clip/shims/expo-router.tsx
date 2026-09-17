/**
 * `expo-router`, for the App Clip only.
 *
 * ---------------------------------------------------------------------------
 * **Metro resolves `expo-router` to this file when BUILDING_FOR_APP_CLIP is
 * set.** See the alias table in `metro.config.js`, which carries the other half
 * of this note.
 *
 * ## Why an alias rather than a `.clip.tsx` file
 *
 * The `.clip` source extension — the mechanism this project already uses for
 * `index.clip.ts` — only applies to the project's own files. `expo-router` is a
 * package name, so the only way to substitute it is at resolution.
 *
 * ## Why substitute it at all
 *
 * The clip has no navigator, and must not have one: importing the real router
 * runs a `require.context` over `app/`, which drags **every** screen into the
 * clip's module graph — the tab navigator, the gallery tree, the upload queue,
 * SQLite, the background task. That measurement is in `ClipRoot`'s header and
 * is why `index.clip.ts` exists.
 *
 * But the screens the clip *wants* — the liturgy tour, the expansion plans, the
 * apps list — were written for the full app, and three of them call
 * `useRouter()` to push another screen. The choice was: fork those screens, or
 * give them a router that answers honestly in a clip. Forking `parts.tsx`
 * (908 lines, shared by five About pages) to change one `router.push` is how
 * two copies of a page start drifting.
 *
 * So this is a router with the clip's own three answers, all of them in
 * `navigate.ts`: another experience if this binary can draw it, the website if
 * it cannot, Safari if it was a URL all along.
 *
 * ## What is deliberately missing
 *
 * `Stack`, `Tabs`, `Drawer`, `Slot` — the layout components. Nothing in the
 * clip's graph may render one, and an export that quietly rendered nothing
 * would turn that mistake into a blank screen rather than a build that fails.
 * If one is ever needed, that is a sign a screen was borrowed that should not
 * have been.
 * ---------------------------------------------------------------------------
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { goFromClip } from '@/clip/navigate';

/**
 * The full router's `Href`, flattened to what a clip can act on.
 *
 * The real type is a union of typed routes and `{ pathname, params }` objects.
 * Nothing in the clip's graph builds the object form, and accepting a plain
 * string keeps the screens that import this type compiling unchanged.
 */
export type Href = string;

function toPath(href: Href | { pathname?: string } | null | undefined): string {
  if (!href) return '/';
  if (typeof href === 'string') return href;
  return href.pathname ?? '/';
}

export interface ClipRouter {
  push: (href: Href) => void;
  replace: (href: Href) => void;
  navigate: (href: Href) => void;
  /** No stack to pop. The clip's own screens draw their own way back. */
  back: () => void;
  canGoBack: () => boolean;
  setParams: () => void;
  dismiss: () => void;
  dismissAll: () => void;
}

const router: ClipRouter = {
  push: (href) => goFromClip(toPath(href)),
  replace: (href) => goFromClip(toPath(href)),
  navigate: (href) => goFromClip(toPath(href)),
  back: () => {},
  canGoBack: () => false,
  setParams: () => {},
  dismiss: () => {},
  dismissAll: () => {},
};

export function useRouter(): ClipRouter {
  return router;
}

export { router };

/**
 * The navigation object a screen uses to set its own header title.
 *
 * The clip draws its own chrome — see `ClipFrame` — so `setOptions` is a no-op
 * rather than an error: a borrowed screen naming itself is making a reasonable
 * request of a header that does not exist here.
 */
export function useNavigation() {
  return {
    setOptions: () => {},
    navigate: (href: Href) => goFromClip(toPath(href)),
    goBack: () => {},
    addListener: () => () => {},
  };
}

/** One screen, one invocation: there are no route parameters in a clip. */
export function useLocalSearchParams<T extends object = Record<string, string>>(): T {
  return {} as T;
}

export const useGlobalSearchParams = useLocalSearchParams;

export function useSegments(): string[] {
  return [];
}

export function usePathname(): string {
  return '/';
}

/**
 * The clip has exactly one screen mounted at a time, so whatever is mounted is
 * focused. `useFocusEffect` therefore runs once on mount, and its cleanup on
 * unmount — which is what a focus effect means when there is nowhere else to be.
 */
export function useFocusEffect(effect: () => void | (() => void)): void {
  useEffect(() => effect(), [effect]);
}

export function useIsFocused(): boolean {
  return true;
}

export function Link({
  href,
  children,
  onPress,
}: {
  href: Href;
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        onPress?.();
        goFromClip(toPath(href));
      }}
    >
      {children}
    </Pressable>
  );
}

export function Redirect({ href }: { href: Href }) {
  useEffect(() => {
    goFromClip(toPath(href));
  }, [href]);
  return null;
}
