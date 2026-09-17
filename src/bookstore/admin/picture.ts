/**
 * Choosing a cover on a phone, and getting it into the shape Square wants.
 *
 * The website hands `downscaleToDataUrl(file, 1600)` a `File` from an
 * `<input type="file">` and gets a `data:image/jpeg;base64,…` back. This is the
 * same contract from the other end: a photo picked out of the camera roll, run
 * through `expo-image-manipulator`, handed back as the same kind of string.
 *
 * ## Why a `data:` URL at all, when the uploader queue exists
 *
 * `src/upload/` sends parishioners' photographs to Firebase Storage as files,
 * which is the right shape for that job and the wrong one for this. A book's
 * cover does not live in Storage — it lives in the parish's **Square catalog**,
 * attached to the catalog object, because that is the record the till and the
 * card reader read too. Square's image endpoint takes a multipart body built by
 * `squareProductImage`, which needs the Square access token, which may only
 * ever exist in the Functions runtime. So the bytes go up as base64 inside the
 * JSON body of an authenticated POST. That costs about a third more on the wire
 * than the file does on disk, which is the price of the token staying where it
 * belongs.
 *
 * ## JPEG, and not the WebP `src/upload/condense.ts` produces
 *
 * Square's catalog image endpoint takes JPEG, PNG and GIF. A WebP is refused,
 * and it is refused *after* the upload — so the correct format here is not a
 * preference, and this must not be quietly "improved" to match the uploader.
 * The website's `downscaleToDataUrl` picks JPEG for the same reason.
 *
 * ## The failure direction is the opposite of the uploader's, on purpose
 *
 * `condense.ts` never refuses a photograph: the person on the other end is
 * somebody's grandmother with forty pictures of the camp, and losing one to a
 * re-encode that would not run is unacceptable. This is a volunteer adding a
 * cover to the shop, at a desk, with the book in front of them. A picture that
 * cannot be read gets a sentence and they pick another — which is better than
 * shipping 12MB of unre-encoded camera roll into a Function that holds all of
 * it in memory.
 *
 * **Nothing here is a size limit.** `MAX_IMAGE_BYTES` in `functions/catalog.ts`
 * is, and it has to be, because everything below runs on a phone we do not
 * control. Do not move that ceiling into this file and delete it there.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * The long edge a cover is shrunk to, and what it is worth.
 *
 * 1600 is the website's number. The shelf shows a cover at 400px and the
 * detail sheet at about 800 on a 3× phone, so 1600 is a clean 2× of the
 * largest place it is ever drawn — and it takes a 3105×3105 parish photograph
 * from roughly 4MB to roughly 200KB.
 */
const MAX_EDGE = 1600;

/** JPEG quality. The website's 0.86, for the same covers. */
const QUALITY = 0.86;

/** A photograph chosen but not yet sent. */
export interface PickedPicture {
  /**
   * An identity for a picture that has no server-side one yet, so a held tile
   * can be taken back off before it has ever reached Square.
   *
   * A counter rather than a random id: Hermes has no `crypto.randomUUID`, and
   * two photographs chosen in the same millisecond are ordinary with a
   * multi-select — so a timestamp alone would collide and two tiles would share
   * a React key.
   */
  id: string;
  /** `data:image/jpeg;base64,…`, which is both what renders and what uploads. */
  dataUrl: string;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `pic-${counter}`;
}

export type PickOutcome =
  | { kind: 'picked'; pictures: PickedPicture[] }
  /** They backed out of the picker. Not a failure and not worth a message. */
  | { kind: 'cancelled' }
  | { kind: 'refused'; reason: string };

/**
 * Where a cover comes from.
 *
 * Two, and they are offered as two controls rather than one that opens a menu.
 * The volunteer who adds books to this shop is standing at the bookstore table
 * with the book in their hand — photographing it is the common case, not the
 * exotic one — and a picker that had to be opened and then told which kind of
 * picker it was is the arrangement that made the website's version a desk job.
 */
export type PictureSourceKind = 'camera' | 'library';

/**
 * A photograph of the book in front of you.
 *
 * `launchCameraAsync` opens the system camera, which is the right camera here
 * even though this app ships its own in `src/send/`. That one is a shutter for
 * sending to the galleries — it records video, it has a destination bar, and it
 * hands its results to the upload queue. None of that belongs between a
 * volunteer and a book cover.
 */
export async function takePhoto(): Promise<PickOutcome> {
  const ImagePicker = await import('expo-image-picker');

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'refused',
      reason: 'SPSM Connect has not been given the camera. Grant it in Settings.',
    };
  }

  return read(
    await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      /*
       * The crop step, and it earns its tap.
       *
       * These covers are phone snaps of books on a table, and `Cover` renders
       * them `contain` inside a fixed box — so a photograph with half a table
       * in it becomes a small book floating in paper. Cropping to the book is
       * the difference, and the moment to do it is while the book is still in
       * front of you rather than never. Off for the library, where the picture
       * was framed by whoever took it.
       */
      allowsEditing: true,
      quality: 1,
    }),
  );
}

/**
 * Covers already on the phone — several at once, if they are there.
 *
 * `expo-image-picker` is imported dynamically, as `PicturePicker` in the forms
 * admin does it: the module pulls in the native picker's JS shim, and the shop
 * is a screen every parishioner opens.
 */
export async function pickFromLibrary(): Promise<PickOutcome> {
  const ImagePicker = await import('expo-image-picker');

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      kind: 'refused',
      reason: 'SPSM Connect has not been given access to your photos. Grant it in Settings.',
    };
  }

  return read(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      /*
       * Full quality out of the picker, because the re-encode below is the one
       * that should decide what this costs. Asking the picker to compress first
       * means shrinking an already-shrunk image, which loses detail twice to
       * save nothing — `saveAsync` re-encodes either way.
       */
      quality: 1,
    }),
  );
}

/** Whichever picker it was, shrunk and given identities. */
async function read(
  result: import('expo-image-picker').ImagePickerResult,
): Promise<PickOutcome> {
  if (result.canceled) return { kind: 'cancelled' };

  const pictures: PickedPicture[] = [];
  for (const asset of result.assets) {
    try {
      pictures.push({ id: nextId(), dataUrl: await shrink(asset.uri) });
    } catch {
      /*
       * One bad file does not lose the rest of the selection. Reported only if
       * *nothing* survived — a volunteer who picked four and got three is told
       * by the three tiles that appeared, and a sentence about the fourth is
       * more useful than one that says "some pictures" about all of them.
       */
    }
  }

  if (pictures.length === 0) {
    return {
      kind: 'refused',
      reason:
        'That picture could not be read. Try another, or a photograph rather than a screenshot.',
    };
  }

  return { kind: 'picked', pictures };
}

/**
 * One photograph, re-encoded to a JPEG data URL no more than 1600px on its long
 * edge.
 *
 * Two passes over the manipulator and not one: `renderAsync()` on an untouched
 * context is how the source's own dimensions are learned, and `resize` bounds
 * the axis you *name* — naming `width` alone would make a portrait photograph
 * 1600 wide and far taller, which is the opposite of a size limit. The same
 * two-step is in `src/upload/condense.ts` with the same note.
 *
 * A fresh context for the resize, because the chained API accumulates
 * transformations and reusing one would resize an already-resized image.
 */
async function shrink(uri: string): Promise<string> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const longEdge = Math.max(source.width, source.height);

  /*
   * `withoutEnlargement` semantics, matching the web's `Math.min(1, …)`: a
   * cover already smaller than 1600 is re-encoded at its own size rather than
   * blown up, which would cost bytes to add nothing.
   */
  const scale = Math.min(1, MAX_EDGE / longEdge);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const image = await ImageManipulator.manipulate(uri).resize({ width, height }).renderAsync();
  const saved = await image.saveAsync({
    compress: QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!saved.base64) throw new Error('The picture came back without its bytes.');
  return `data:image/jpeg;base64,${saved.base64}`;
}
