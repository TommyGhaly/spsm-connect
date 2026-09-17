/**
 * `expo-image-picker`, for the App Clip only — the camera standing in for the
 * photo library.
 *
 * ---------------------------------------------------------------------------
 * **Metro resolves `expo-image-picker` to this file when BUILDING_FOR_APP_CLIP
 * is set.** See the alias table in `metro.config.js`.
 *
 * ## The rule this exists for
 *
 * *PhotoKit provides no functionality at runtime in an App Clip.* That is
 * Apple's wording, and it is not a permission that can be asked for — the
 * library simply is not reachable, which is why `expo-media-library` is in the
 * clip's `excludedPackages`. `expo-image-picker` itself is not excluded,
 * because its **camera** half works perfectly well in a clip.
 *
 * ## What it changes, and what it does not
 *
 * One call site: the photograph field on a parish form (`forms/Fields.tsx`),
 * which asks for the library. In the clip it gets the camera instead — same
 * shape of answer, same `assets[0].uri`, so the field, the condense ladder and
 * the upload are all the app's own code, unforked.
 *
 * The alternative was a `Fields.clip.tsx`: a 500-line fork of a file shared by
 * every form in the parish, to change which of two picker functions is called.
 *
 * **Anything this file does not implement is absent on purpose.** The real
 * package's other exports — the media-library permission getters, the pending
 * result API — have no meaning here, and a build that reaches for one should
 * fail at bundle time rather than at a saint's day with a phone in somebody's
 * hand.
 * ---------------------------------------------------------------------------
 */
import {
  launchCameraAsync,
  requestCameraPermissionsAsync,
  type ImagePickerOptions,
  type ImagePickerResult,
} from 'expo-image-picker/src/ImagePicker';

export * from 'expo-image-picker/src/ImagePicker.types';
export { launchCameraAsync, requestCameraPermissionsAsync };

/**
 * The library permission, answered by the camera's.
 *
 * The caller's only use of the result is `granted`, and in a clip the thing it
 * is about to open is the camera — so asking about the library would be asking
 * for something that cannot be given and refusing a photograph that could have
 * been taken.
 */
export const requestMediaLibraryPermissionsAsync = requestCameraPermissionsAsync;
export const getMediaLibraryPermissionsAsync = requestCameraPermissionsAsync;

/**
 * "Choose a photograph", answered by taking one.
 *
 * `allowsEditing` is not forwarded and neither is `mediaTypes`: the camera in a
 * clip takes one still photograph, which is exactly what the form field wants.
 * Everything else — quality, the `canceled` / `assets` shape — is the real
 * function's.
 */
export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult> {
  return launchCameraAsync({ ...options, mediaTypes: ['images'], allowsEditing: false });
}
