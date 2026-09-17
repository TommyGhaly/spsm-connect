/**
 * Whichever form the route names.
 *
 * The website serves every form from one shell at `/form` with the slug read
 * off the address bar, because staff must be able to publish a form without a
 * deploy. The same requirement lands here as `app/(drawer)/(tabs)/forms/
 * [slug].tsx`: nothing about a form is compiled in, and a form created on
 * Tuesday opens on Tuesday.
 *
 * What that costs is a moment of "Loading…" before the questions appear. The
 * two forms that cannot afford even that — the car park's NFC tag and every
 * "ask the church office" link — have a copy in `@spsm/shared` and fall back to
 * it, which is what `fallbackFor` is.
 */
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  builtInForm,
  embedFormUrl,
  parseFormDefinition,
  type FormAnswers,
  type FormDefinition,
} from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Lede, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { FormRenderer } from './FormRenderer';
import { VehicleForm } from './VehicleForm';
import { formImageUrl, readFormBySlug, type WithId } from './data';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'form'; form: WithId<FormDefinition> };

export function FormScreen({
  slug,
  about,
  onTitle,
}: {
  slug: string;
  /**
   * A `subject` option to open the form on, by value.
   *
   * The website's `?about=` parameter, which is how "ask the office for an
   * account" arrives at the contact form already knowing what it is about. It
   * is checked against the form's own options before it is used — a value that
   * is not one of them is dropped rather than stored, because an answer nobody
   * chose is worse than no answer.
   */
  about?: string;
  /** Called once the form is known, so the stack header can wear its title. */
  onTitle?: (title: string) => void;
}) {
  const theme = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    readFormBySlug(slug)
      .then((form) => {
        if (cancelled) return;
        // An unpublished form reads as missing rather than as an error: the
        // rules refuse the read without the `forms` grant, so a draft is a 404
        // to the public, which is what it should look like.
        setState(
          form && form.published
            ? { kind: 'form', form }
            : (fallbackFor(slug) ?? { kind: 'missing' }),
        );
      })
      .catch(() => {
        if (!cancelled) setState(fallbackFor(slug) ?? { kind: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (state.kind === 'form') onTitle?.(state.form.title);
  }, [state, onTitle]);

  if (state.kind === 'loading') {
    return (
      <Screen>
        <Lede color={theme.color.inkSoft}>Loading…</Lede>
      </Screen>
    );
  }

  if (state.kind === 'missing') {
    return (
      <Screen>
        <Card>
          <Heading>Form not found</Heading>
          <Body color={theme.color.inkSoft}>
            There is no form at this address. It may have been taken down — the Forms tab
            has everything the church keeps online.
          </Body>
        </Card>
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen>
        <Card>
          <Heading>Not loaded</Heading>
          <Body color={theme.color.inkSoft}>
            The form could not be fetched. Check your connection and open it again.
          </Body>
        </Card>
      </Screen>
    );
  }

  const { form } = state;
  const picture = formImageUrl(form.image);

  /*
   * An embedded form scrolls itself, inside a WebView that has to be given a
   * height. So that one kind gets a non-scrolling screen and the frame fills
   * what is left; everything else is a column in the app's own scroller.
   */
  const embedded = form.kind === 'embed' && form.externalUrl !== null;

  return (
    <Screen scroll={!embedded}>
      {/*
        The picture, when the church chose one, and deliberately a band rather
        than a hero: the point of the screen is the first question, and a full
        photograph pushes it off the phone. Skipped on an embed, where the
        host's own crest and header bar are already above the questions.
      */}
      {picture && !embedded ? (
        <Image
          source={{ uri: picture }}
          style={{
            width: '100%',
            height: 120,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.paperRaised,
          }}
          contentFit="cover"
          transition={150}
          accessibilityElementsHidden
        />
      ) : null}

      {form.blurb ? <Body color={theme.color.inkSoft}>{form.blurb}</Body> : null}

      <FormBody form={form} initialAnswers={subjectAnswers(form, about)} />
    </Screen>
  );
}

function FormBody({
  form,
  initialAnswers,
}: {
  form: WithId<FormDefinition>;
  initialAnswers?: FormAnswers;
}) {
  const theme = useTheme();

  /*
   * Closed comes before everything else. A closed registration still has all
   * its fields, and rendering them with a notice above would leave a form that
   * looks fillable and refuses at the end — which wastes the ten minutes
   * somebody spent on it.
   */
  if (!form.open) {
    return (
      <Card>
        <Heading>This form is closed</Heading>
        <Body color={theme.color.inkSoft}>
          {form.closedMessage ?? 'The church is no longer accepting submissions here.'}
        </Body>
      </Card>
    );
  }

  if (form.kind === 'embed' && form.externalUrl) {
    return <Embedded url={form.externalUrl} host={hostOf(form.externalUrl)} />;
  }

  /*
   * An external form is somebody else's. Linked rather than rendered, because a
   * form we do not host cannot accept a submission from us: a native copy would
   * collect answers its owner never hears about, while the office keeps
   * checking the other system and finding it empty.
   */
  if (form.kind === 'external' && form.externalUrl) {
    const url = form.externalUrl;
    return (
      <View style={{ gap: theme.space.sm }}>
        <Button label="Open the form" onPress={() => void WebBrowser.openBrowserAsync(url)} />
        <Small color={theme.color.inkFaint}>
          This one is kept by {hostOf(url)}. It opens in a browser, and what you enter goes
          to them rather than to the church.
        </Small>
      </View>
    );
  }

  if (form.kind === 'vehicle') {
    return <VehicleForm slug={form.slug} confirmation={form.confirmationMessage} />;
  }

  return <FormRenderer form={form} initialAnswers={initialAnswers} />;
}

/**
 * Somebody else's form, framed under our header.
 *
 * The answers belong to whoever hosts it and stay there — **nothing an embedded
 * form collects is stored by the church**, which is why the line above the
 * frame says so rather than leaving it to be assumed.
 *
 * The way out is not optional either. Both hosts were checked and send no
 * `X-Frame-Options`, but neither promises to keep it that way, and a frame that
 * refuses to load is a blank rectangle with nothing to say why.
 */
function Embedded({ url, host }: { url: string; host: string }) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: theme.space.sm }}>
      <Small color={theme.color.inkFaint}>
        Hosted by {host}. What you enter goes to them, not to the church website.
      </Small>

      <View
        style={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.color.rule,
        }}
      >
        <WebView
          source={{ uri: embedFormUrl(url) }}
          style={{ flex: 1, backgroundColor: theme.color.paper }}
          // The form's own payment fields, where it has them, need this. It is
          // the same `allow="payment"` the website's iframe carries.
          allowsInlineMediaPlayback
        />
      </View>

      <Button
        label="Open it in a browser"
        tone="quiet"
        onPress={() => void WebBrowser.openBrowserAsync(url)}
      />
    </View>
  );
}

/**
 * `?about=` as an answer, when the form actually offers it.
 *
 * Mirrors `subjectFromQuery` on the website, including the check: the parameter
 * names an option *value*, and a form whose subjects have been edited since the
 * link was written must not open with an answer that is not on the list.
 */
function subjectAnswers(form: FormDefinition, about: string | undefined): FormAnswers {
  if (!about) return {};
  const subject = form.fields.find((field) => field.key === 'subject');
  if (!subject || !subject.options.some((option) => option.value === about)) return {};
  return { subject: about };
}

/** Whose page this is, for the sentence above the frame. */
function hostOf(url: string): string {
  try {
    const parts = new URL(url).hostname.replace(/^www\./, '').split('.');
    return parts.slice(-2).join('.');
  } catch {
    return 'another website';
  }
}

/**
 * The built-in definition for this address, when there is one.
 *
 * `vehicle-registration` is on an NFC tag in the car park and `contact` is
 * behind every "ask the church office" link. Neither address can be corrected
 * by editing a file, so neither may depend on a Firestore document existing and
 * being readable — a seeder that was never run, or a phone with no signal,
 * would otherwise turn a physical tag into "form not found" on a Sunday.
 *
 * Note the order: a stored document always wins. This is the floor, not the
 * source of truth.
 */
function fallbackFor(slug: string): { kind: 'form'; form: WithId<FormDefinition> } | null {
  const draft = builtInForm(slug);
  if (!draft) return null;
  console.warn(`[forms] ${slug} could not be read from Firestore; showing the built-in copy.`);
  return { kind: 'form', form: { id: slug, ...parseFormDefinition(slug, draft) } };
}
