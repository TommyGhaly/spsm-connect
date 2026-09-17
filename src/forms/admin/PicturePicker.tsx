/**
 * The picture on a form's card, chosen or uploaded.
 *
 * The stock list is the website's `features/media/stockPictures.ts`, value for
 * value, and the values are **website paths** rather than absolute URLs —
 * `/img/stock-camp-1000.webp`. That is what the site stores and what its own
 * `<img>` needs, so a phone that stored an absolute URL here would give the
 * website a picture it renders through a second host for no reason.
 * `formImageUrl` is the one place that turns a stored value into something this
 * app can fetch.
 *
 * Most forms have no picture and should not get one. The note on
 * `FormDefinition.image` is worth reading before adding to this list: there is
 * no photograph of a church van, and putting the sanctuary behind "Request a
 * van" is decoration that means nothing, which reads worse than none.
 */
import { useState } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Picker, type ChoiceOption } from '@/components/Fields';
import { Button } from '@/components/Surface';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { formImageUrl } from '../data';
import { uploadFormPicture } from '../pictures';

/** The same nine the website offers, in the same order. */
const STOCK: readonly ChoiceOption[] = [
  { value: '', label: 'No picture' },
  { value: '/img/stock-parking-lot-1000.webp', label: 'Car park' },
  { value: '/img/stock-passenger-van-1000.webp', label: 'Passenger van' },
  { value: '/img/stock-small-group-1000.webp', label: 'Small group' },
  { value: '/img/stock-gathering-1000.webp', label: 'Gathering' },
  { value: '/img/stock-camp-1000.webp', label: 'Summer camp' },
  { value: '/img/stock-office-1000.webp', label: 'Office desk' },
  { value: '/img/home-sanctuary-1000.webp', label: 'The sanctuary (ours)' },
  { value: '/img/cross-coptic-360.webp', label: 'Coptic cross (ours)' },
  { value: '/img/hero-glass-1000.webp', label: 'Stained glass' },
];

/** What an uploaded picture is called in the list, since its URL is not a name. */
const UPLOADED = '__uploaded';

export function PicturePicker({
  value,
  onChange,
  formId,
}: {
  value: string | null;
  onChange: (image: string | null) => void;
  /** Which form's folder an upload goes in. The slug, or the document id. */
  formId: string;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const known = STOCK.some((picture) => picture.value === (value ?? ''));
  const options = known ? STOCK : [{ value: UPLOADED, label: 'Uploaded picture' }, ...STOCK];
  const preview = formImageUrl(value);

  async function upload() {
    setFailed(null);

    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailed('SPSM Connect has not been given access to your photos. Grant it in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    setBusy(true);
    const outcome = await uploadFormPicture(formId, {
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    });
    setBusy(false);

    if (!outcome.ok) {
      setFailed(outcome.reason);
      return;
    }
    onChange(outcome.url);
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      <Picker
        label="Picture"
        value={known ? (value ?? '') : UPLOADED}
        options={options}
        onChange={(next) => onChange(next === UPLOADED || next === '' ? null : next)}
        hint="On the card in the Forms tab, and as a band above the form itself."
      />

      <Button
        label={busy ? 'Uploading…' : 'Upload a photo…'}
        tone="quiet"
        onPress={() => void upload()}
        busy={busy}
      />

      {failed ? <Micro color={theme.color.accentStrong}>{failed}</Micro> : null}

      {preview ? (
        <Image
          source={{ uri: preview }}
          style={{
            width: '100%',
            height: 110,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.color.paperRaised,
          }}
          contentFit="cover"
          accessibilityElementsHidden
        />
      ) : null}
    </View>
  );
}
