/**
 * One field of a form, drawn.
 *
 * Split out of `FormRenderer` for the reason the website splits it: the
 * builder's live preview and the real form render through the identical
 * component. A preview that is a second implementation of the same inputs is a
 * preview that lies to whoever is building the form, usually about the thing
 * they are trying to check.
 *
 * Every control here is one of the three in `components/Fields.tsx`. Nothing in
 * this file invents a text box, a tick or a colour — see the note at the top of
 * `theme/tokens.ts` for why a literal anything is a value the church cannot
 * change.
 */
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import {
  MAX_FORM_QUANTITY,
  isChoiceField,
  type FormAnswer,
  type FormField,
} from '@spsm/shared';

import { Check, Choice, Field, Picker, type ChoiceOption } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Heading, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { uploadFormPhoto, type PickedImage } from './uploads';

export function FieldInput({
  field,
  value,
  error,
  onChange,
  onBlur,
  formSlug,
}: {
  field: FormField;
  value: FormAnswer | undefined;
  /**
   * The problem with this answer, or null.
   *
   * A message rather than a boolean: a red border is not an error message. It
   * says nothing about what is wrong, and on a sixteen-question form it means
   * holding a summary in your head while you scroll.
   */
  error: string | null;
  onChange: (value: FormAnswer) => void;
  /** Validates this one field once the person leaves it. */
  onBlur?: () => void;
  /**
   * Which form this is, for the upload endpoint.
   *
   * Threaded down rather than read off the route, because the builder's preview
   * renders these fields on a form that has no address yet. The web reads
   * `location.pathname`; there is no such thing here, and a prop cannot
   * disagree with the form it came from.
   */
  formSlug: string;
}) {
  const theme = useTheme();

  /*
   * A section break, not an input. Its own shape rather than a `Field` with no
   * box, because a heading is what gives a long form joints.
   */
  if (field.type === 'heading') {
    return (
      <View style={{ gap: theme.space.xs, paddingTop: theme.space.sm }}>
        <Heading>{field.label}</Heading>
        {field.help ? <Small color={theme.color.inkSoft}>{field.help}</Small> : null}
      </View>
    );
  }

  /*
   * An agreement, which is a different question from a one-option checkbox
   * group even though it looks the same: there `required` means "answer it",
   * here it means "agree to it".
   */
  if (field.type === 'consent') {
    return (
      <View style={{ gap: theme.space.xs }}>
        <Check
          label={field.required ? `${field.label} *` : field.label}
          checked={value === true}
          onChange={(next) => onChange(next)}
          hint={field.help ?? undefined}
        />
        {error ? <Micro color={theme.color.accentStrong}>{error}</Micro> : null}
      </View>
    );
  }

  if (field.type === 'photo') {
    return (
      <PhotoField
        field={field}
        value={value}
        error={error}
        onChange={onChange}
        formSlug={formSlug}
      />
    );
  }

  if (isChoiceField(field.type)) {
    const options: ChoiceOption[] = field.options.map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.priceCents > 0 ? { note: money(option.priceCents) } : {}),
    }));

    /*
     * A dropdown past about six options, every option on screen below that —
     * which is the same rule the builder offers staff (`select` versus
     * `radio`), honoured rather than reinterpreted.
     */
    if (field.type === 'select') {
      return (
        <Picker
          label={field.label}
          required={field.required}
          value={typeof value === 'string' ? value : ''}
          options={options}
          /*
           * No `onBlur` here, and that is a correction rather than an
           * omission. Calling it beside `onChange` validated the answer that
           * had just been chosen against the state of a render that predated
           * it — so picking a subject on a required dropdown printed "What is
           * this about? is required" under the subject you had picked. A
           * choice has no blur on a phone; it is checked on submit, and
           * touching it clears whatever it was previously accused of.
           */
          onChange={(next) => onChange(next)}
          hint={field.help ?? undefined}
          error={error}
        />
      );
    }

    const multiple = field.type === 'checkboxes';
    const chosen = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];

    return (
      <Choice
        label={field.label}
        required={field.required}
        options={options}
        chosen={chosen}
        multiple={multiple}
        // Checked on submit, for the reason the dropdown above gives.
        onChange={(next) => onChange(multiple ? next : (next[0] ?? ''))}
        hint={field.help ?? undefined}
        error={error}
      />
    );
  }

  return (
    <Field
      label={field.label}
      required={field.required}
      value={
        typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
      }
      onChange={(text) =>
        onChange(
          field.type === 'number'
            ? // Empty must stay a string, not become 0 — a zero is an answer,
              // and it would satisfy a `required` check nobody has met.
              text === ''
              ? ''
              : clampQuantity(text)
            : text,
        )
      }
      onBlur={onBlur}
      placeholder={field.placeholder ?? undefined}
      lines={field.type === 'longText' ? 4 : 1}
      keyboard={keyboardFor(field)}
      autoCapitalize={field.type === 'email' ? 'none' : undefined}
      autoComplete={autoCompleteFor(field)}
      hint={hintFor(field)}
      error={error}
    />
  );
}

/**
 * The keyboard this answer is typed on.
 *
 * `date` gets the plain one. There is no date picker here yet and the shared
 * validator wants `YYYY-MM-DD`, so the hint below says so in words rather than
 * the field quietly accepting "next Sunday" and failing on submit.
 */
function keyboardFor(field: FormField): 'default' | 'email-address' | 'phone-pad' | 'numeric' {
  switch (field.type) {
    case 'email':
      return 'email-address';
    case 'phone':
      return 'phone-pad';
    case 'number':
      return 'numeric';
    default:
      return 'default';
  }
}

function autoCompleteFor(field: FormField): 'name' | 'email' | 'tel' | undefined {
  switch (field.type) {
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    case 'shortText':
      return /\bname\b/i.test(field.label) ? 'name' : undefined;
    default:
      return undefined;
  }
}

/**
 * The line under the box: the form's own help, plus whatever this type has to
 * say for itself.
 *
 * A per-unit price is said here rather than left to the total, because a number
 * field that silently adds $12 for every van is a form that surprises somebody
 * at the card sheet.
 */
function hintFor(field: FormField): string | undefined {
  const parts = [field.help ?? ''];
  if (field.type === 'date') parts.push('As 2026-09-14 — year, month, day.');
  if (field.type === 'number' && field.unitPriceCents > 0) {
    parts.push(`${money(field.unitPriceCents)} each.`);
  }
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

/**
 * A typed quantity, kept inside the bound the server prices against.
 *
 * `computeTotalCents` clamps to `MAX_FORM_QUANTITY` when it charges, so a box
 * that accepted 10,000 would show a running total that is not what gets
 * charged — the one thing a running total must never do.
 */
function clampQuantity(text: string): number | string {
  const value = Number(text);
  if (!Number.isFinite(value)) return text;
  return Math.min(value, MAX_FORM_QUANTITY);
}

/**
 * A photograph, uploaded as soon as it is chosen.
 *
 * **On pick, not on submit.** A photograph that only leaves the phone when the
 * form is submitted turns one slow moment into a button that appears to hang on
 * church wifi — and if it fails, it fails after everything else has been filled
 * in. Uploading here means a failure is visible and fixable while the person is
 * still looking at the field it belongs to.
 *
 * The thumbnail is the local file, never a round trip: `formUploads/` is
 * deliberately unreadable to whoever just wrote to it, so there is no URL to
 * fetch back even if fetching one were worth doing.
 */
function PhotoField({
  field,
  value,
  error,
  onChange,
  formSlug,
}: {
  field: FormField;
  value: FormAnswer | undefined;
  error: string | null;
  onChange: (value: FormAnswer) => void;
  formSlug: string;
}) {
  const theme = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const has = typeof value === 'string' && value.length > 0;

  async function pick() {
    setFailed(null);

    // Imported here rather than at the top of the file: this is the only field
    // type that needs the picker, and most forms have none.
    const ImagePicker = await import('expo-image-picker');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailed(
        'SPSM Connect has not been given access to your photos. You can grant it in Settings.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Never `allowsEditing`: it forces a crop on iOS, and somebody who meant
      // to send the whole photograph has no way back to it.
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    // Shown before the upload finishes, so the person can see they picked the
    // right picture while it is still going up.
    setPreview(asset.uri);
    setBusy(true);

    const picked: PickedImage = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    };
    const outcome = await uploadFormPhoto(formSlug, picked);
    setBusy(false);

    if (!outcome.ok) {
      setFailed(outcome.reason);
      onChange('');
      return;
    }
    onChange(outcome.path);
  }

  return (
    <View style={{ gap: theme.space.xs }}>
      <Small color={theme.color.ink}>{field.required ? `${field.label} *` : field.label}</Small>

      {preview ? (
        <Image
          source={{ uri: preview }}
          style={{
            width: '100%',
            height: 180,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.color.paperRaised,
          }}
          contentFit="cover"
          // Not `accessible`: the picture is the person's own, chosen a second
          // ago, and describing it back to them says nothing they do not know.
          accessibilityElementsHidden
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <PhotoButton
          label={busy ? 'Uploading…' : has ? 'Choose a different photo' : 'Add a photo'}
          icon={has ? 'check' : 'plus'}
          disabled={busy}
          onPress={() => void pick()}
        />
        {has && !busy ? (
          <PhotoButton
            label="Remove"
            icon="close"
            disabled={false}
            onPress={() => {
              setPreview(null);
              onChange('');
            }}
          />
        ) : null}
      </View>

      {field.help ? <Micro color={theme.color.inkFaint}>{field.help}</Micro> : null}
      {failed ? <Micro color={theme.color.accentStrong}>{failed}</Micro> : null}
      {error ? <Micro color={theme.color.accentStrong}>{error}</Micro> : null}
    </View>
  );
}

function PhotoButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'check' | 'plus' | 'close';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 44,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={16} color={theme.color.inkSoft} />
      <Small color={theme.color.ink}>{label}</Small>
    </Pressable>
  );
}
