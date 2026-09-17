/**
 * `/` — the camera, and the reason this app exists.
 *
 * A one-line route because the screen is a screen and not a route's worth of
 * layout. Everything about it is in `src/send/CameraScreen.tsx`, which is where
 * the reasoning lives too.
 *
 * ## What used to be here
 *
 * A card headed "SPSM Connect" with two buttons — take one, or choose from the
 * library — that handed off to `expo-image-picker`'s modal, and a panel under
 * it saying what was still uploading. Its own note said Phase 3 would put the
 * bulletin and the week's schedule above it.
 *
 * None of that is lost, it moved: the library is the thumbnail in the corner of
 * the viewfinder, the upload panel is the pill at the top of it, and the
 * bulletin and schedule are the Calendar tab's, which is where somebody looks
 * for them. What replaced it is the thing the card was a doorway to.
 */
import { CameraScreen } from '@/send/CameraScreen';

export default function Send() {
  return <CameraScreen />;
}
