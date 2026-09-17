/**
 * Putting somebody else's form on a page of ours.
 *
 * Tithe.ly and Breeze, today. The form stays theirs — **answers are kept where
 * the form is hosted and never reach this project**, so an imported form has no
 * submissions here and the Submissions screen does not list it.
 *
 * `isKnownFormHost` is a warning rather than a gate, deliberately: somebody
 * holding the `forms` grant pasting an address is trusted, and a host list
 * written today would eventually refuse a real form the church had moved
 * somewhere else. What the check buys is a sentence at the moment of pasting —
 * an address that is neither host's is usually a typo, and saying so then is far
 * cheaper than finding an empty rectangle on the hub a week later.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { NO_PAYMENT, isKnownFormHost, toFormSlug, type FormDraft } from '@spsm/shared';

import { Field, Problem } from '@/components/Fields';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { writeForm } from '../adminData';
import { PicturePicker } from './PicturePicker';

export function EmbedImport() {
  const theme = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [blurb, setBlurb] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = url.trim();
  const ready = trimmed.length > 0 && title.trim().length > 0;
  const offHost = trimmed.length > 0 && !isKnownFormHost(trimmed);

  async function add() {
    setBusy(true);
    setError(null);

    // The slug is the title, which is also the document id. An embed has no
    // questions to lose if it is later renamed, so this is the one place a
    // generated id is not worth the indirection.
    const id = toFormSlug(title) || `form-${Date.now().toString(36)}`;

    try {
      await writeForm(id, {
        slug: id,
        title: title.trim(),
        blurb: blurb.trim(),
        icon: 'file',
        image,
        order: 100,
        // Published straight away: an imported form is one that already exists
        // and is already being filled in somewhere else.
        published: true,
        open: true,
        closedMessage: null,
        kind: 'embed',
        externalUrl: trimmed,
        pushesToTaksis: false,
        fields: [],
        payment: { ...NO_PAYMENT },
        notifyEmails: [],
        confirmationMessage: '',
        confirmationEmailBody: '',
      } satisfies FormDraft);
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'That form could not be added.');
      return;
    }

    router.back();
  }

  return (
    <Screen>
      <Body color={theme.color.inkSoft}>
        Puts a Tithe.ly or Breeze form on a page of ours, with the church&rsquo;s header
        and a picture around it. The form stays theirs — answers are kept where it is
        hosted and do not appear under Submissions here.
      </Body>

      {error ? <Problem>{error}</Problem> : null}

      <Field
        label="The form's address"
        value={url}
        onChange={setUrl}
        placeholder="https://stphilopaterstmina.breezechms.com/form/…"
        keyboard="url"
        hint="Open the form in Tithe.ly or Breeze and copy the address, or use the share link."
      />

      {offHost ? (
        <Card>
          <Small color={theme.color.inkSoft}>
            That is not a Tithe.ly or Breeze address. It can still be added, but a page
            that is not built to be embedded may refuse to appear inside ours — open it
            from the Forms tab afterwards and check.
          </Small>
        </Card>
      ) : null}

      <Field
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="Festival volunteer sign-up"
        hint={`What the card says. /forms/${toFormSlug(title) || '…'}`}
      />

      <Field
        label="Blurb"
        value={blurb}
        onChange={setBlurb}
        lines={2}
        hint="One or two sentences, shown on the card and above the form."
      />

      <PicturePicker value={image} onChange={setImage} formId={toFormSlug(title) || 'embed'} />

      <View style={{ paddingTop: theme.space.sm }}>
        <Button
          label={busy ? 'Adding…' : 'Add the form'}
          onPress={() => void add()}
          disabled={!ready}
          busy={busy}
        />
      </View>
    </Screen>
  );
}
