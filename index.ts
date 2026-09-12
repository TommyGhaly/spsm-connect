/**
 * The app's entry point, and half of the App Clip seam.
 *
 * `package.json` names this as `main` rather than `expo-router/entry` directly,
 * so that Metro can resolve `index.clip.ts` in its place when
 * BUILDING_FOR_APP_CLIP is set. That indirection is the only way to keep the
 * router — and therefore every screen in `app/` — out of the clip's bundle.
 * See src/clip/ClipRoot.tsx for the measurement that forced it.
 */
import 'expo-router/entry';
