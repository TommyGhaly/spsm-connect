/**
 * The `contact` form, rendered where people actually look for it.
 *
 * ---------------------------------------------------------------------------
 * A form definition, not a bespoke screen — the website's decision, and it is
 * the one worth repeating here.
 *
 * The obvious way to build "a contact form that stores a name and an email for
 * the office" is a small component posting to a new endpoint, writing a new
 * collection, read by a new panel. That is four new things, and every one of
 * them is a second implementation of something the forms feature already has:
 * server-side validation, a rate limit, a notification email, a confirmation
 * email, and a submissions table the office already knows how to use.
 *
 * So this is `forms/contact` — the ordinary definition in the ordinary
 * collection, the same document the website renders and the same one the Forms
 * tab opens at `/forms/contact`. Staff can reword a question or close it from
 * the admin screens in this app, and both surfaces change at once.
 *
 * What this file adds is only that the form appears *here*, under the address,
 * rather than only behind a card on the hub. Somebody looking for how to reach
 * the church goes to Contact.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import {
  builtInForm,
  parseFormDefinition,
  type FormDefinition,
  type ParishConfig,
} from '@spsm/shared';

import { Card } from '@/components/Surface';
import { Body, Lede, Small, Subheading } from '@/components/Type';
import { FormRenderer } from '@/forms/FormRenderer';
import { readFormBySlug, type WithId } from '@/forms/data';
import { useTheme } from '@/theme/ThemeProvider';

import { dialUrl, mailUrl } from './config';

type State =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'form'; form: WithId<FormDefinition> };

export function ContactForm({ church }: { church: ParishConfig }) {
  const theme = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    readFormBySlug('contact')
      .then((form) => {
        if (cancelled) return;
        /*
         * Unpublished reads as unavailable rather than as an error, exactly as
         * it does on the form shell: a draft is invisible to the public by rule,
         * and this page has a perfectly good fallback to offer instead — the
         * address and the phone number, a few inches above.
         */
        setState(
          form && form.published && form.kind === 'native'
            ? { kind: 'form', form }
            : { kind: 'unavailable' },
        );
      })
      .catch(() => {
        /*
         * A failed *read* is a different thing from an unpublished form, and
         * `FormScreen` already decided what to do about it: show the copy of
         * this form that ships in `@spsm/shared`. The submission is priced and
         * validated against the stored definition inside `formSubmit` either
         * way, so a built-in copy cannot send anything the server would not have
         * accepted from the real one.
         */
        if (cancelled) return;
        setState(fallback() ?? { kind: 'unavailable' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return <Lede color={theme.color.inkSoft}>Loading the contact form…</Lede>;
  }

  /*
   * The fallback is the church's own address and phone number, not an apology.
   *
   * This branch covers a form nobody has seeded and one staff have deliberately
   * unpublished. In both the reader wants the same thing — a way to reach the
   * office — and saying so is more use than "the form could not be loaded".
   */
  if (state.kind === 'unavailable') {
    return (
      <View style={{ gap: theme.space.xs }}>
        <Body color={theme.color.inkSoft}>
          The contact form isn&apos;t available at the moment — please reach the church office
          directly.
        </Body>
        {church.email !== '' && (
          <Small
            color={theme.color.accent}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(mailUrl(church.email))}
          >
            Write to {church.email}
          </Small>
        )}
        {church.phone !== '' && (
          <Small
            color={theme.color.accent}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(dialUrl(church.phone))}
          >
            Call {church.phone}
          </Small>
        )}
      </View>
    );
  }

  const { form } = state;

  /*
   * Closed is a real state for this form too. Staff can shut it — over a long
   * holiday, or if it is being flooded — and when they do the reader should be
   * told, rather than shown fields that will be refused on submit.
   */
  if (!form.open) {
    return (
      <Card>
        <Subheading>The contact form is closed</Subheading>
        <Body color={theme.color.inkSoft}>
          {form.closedMessage ?? 'Please use the details above to reach the church office.'}
        </Body>
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.space.md }}>
      {form.blurb !== '' && <Body color={theme.color.inkSoft}>{form.blurb}</Body>}
      <FormRenderer form={form} />
    </View>
  );
}

/** The copy of `contact` that ships in the binary. See the `catch` above. */
function fallback(): { kind: 'form'; form: WithId<FormDefinition> } | null {
  const draft = builtInForm('contact');
  if (!draft) return null;

  console.warn('[contact] the contact form could not be read; showing the built-in copy.');
  return { kind: 'form', form: { id: 'contact', ...parseFormDefinition('contact', draft) } };
}
