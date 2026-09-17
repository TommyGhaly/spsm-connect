/**
 * `/c/forms` — the parish's forms, filled in and submitted from the clip.
 *
 * ---------------------------------------------------------------------------
 * **It opens on the form the office has designated, not on a list.** That is
 * `config/forms.nfcFormSlug`, the same field the website's tag page redirects
 * by, and it exists because a tag cannot be reprogrammed: it points at one URL
 * for ever and the office changes the answer in one field. The parish's default
 * is the vehicle registration, which is what the car-park tag has always done.
 *
 * The list is one press away, and is where somebody who wanted a different form
 * goes. `‹ All forms` gets there; the designated form is marked in it, so the
 * reader can tell what they were sent to from what they chose.
 *
 * **Why the list is drawn first, for a moment.** Nothing is held back waiting
 * for a settings document. The website's `NfcRedirect` makes the same call and
 * its header has the argument: holding the page blank until a read lands spends
 * a spinner on everybody to spare a flicker for the fortnight of the year the
 * setting has been changed.
 *
 * ## What is here and not on the app's hub
 *
 * Not `FormsHub` and not `FormScreen`, though the things that do the work —
 * `FormRenderer`, `VehicleForm`, and `ServantSignUp` for the camp — are the
 * app's own, unforked. What is written here is the shell those need and the
 * hub does not give this target:
 *
 *   - **No navigator.** The hub pushes `/forms/<slug>`; a clip has one screen,
 *     so this is a list that becomes a form in place.
 *   - **No admin rows.** The builder and the submissions panel need a grant,
 *     and a grant needs a session that a clip's storage does not keep.
 *   - **No embedded forms.** `kind === 'embed'` is somebody else's form in a
 *     `WebView`, and `react-native-webview` is not in this target. Those open
 *     in Safari over the clip, which is where their answers were always going.
 *
 * ## What a paid form does here
 *
 * It renders, and its Pay button is replaced by the sentence `FormRenderer`
 * already carries: *this copy of the app cannot take a payment.* Not a special
 * case for the clip — `payments/square.ts` answers `paymentsAvailable() ===
 * false` honestly in any binary without Square's SDK, and this target excludes
 * it for the 15 MB budget. Free forms, which are most of them, submit here
 * exactly as they do in the app.
 *
 * ## The one thing that can stop all of this
 *
 * `/api/forms/submit` reads `X-Firebase-AppCheck` by hand and answers
 * `401 unattested` without it. Whether Firebase App Check can mint a token
 * inside an App Clip at all is the open question `src/clip/AppCheckSpike.tsx`
 * exists to answer, on hardware.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CAMP_FORM_SLUG, builtInForms, type FormDefinition } from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small, Subheading } from '@/components/Type';
import { PressableText } from '@/clip/PressableText';
import { openExternal } from '@/clip/handoff';
import { ServantSignUp } from '@/camp/ServantSignUp';
import { useCampSignUpOpen } from '@/camp/useCampConfig';
import { FormRenderer } from '@/forms/FormRenderer';
import { VehicleForm } from '@/forms/VehicleForm';
import { readFormsPageConfig, watchPublishedForms, type WithId } from '@/forms/data';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Whether a form is somebody else's page rather than one this binary can draw.
 *
 * `embed` and `external` are the same fact here — an address the church does
 * not host — and the difference between them is only whether the full app
 * frames it or links to it. A clip has no frame to offer, so both open in
 * Safari, and what somebody types goes where it always went.
 */
function elsewhere(form: FormDefinition): boolean {
  return (form.kind === 'embed' || form.kind === 'external') && form.externalUrl !== null;
}

/** The two permanent forms, so an unreachable database still shows something. */
function builtIns(): FormDefinition[] {
  return builtInForms().map(({ draft }) => draft as FormDefinition);
}

export function Forms() {
  const theme = useTheme();
  const [forms, setForms] = useState<FormDefinition[]>(builtIns);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [designated, setDesignated] = useState<string | null>(null);
  const campOpen = useCampSignUpOpen();

  useEffect(() => {
    return watchPublishedForms(
      (live: WithId<FormDefinition>[]) => {
        const known = new Set(live.map((form) => form.slug));
        setForms([...builtIns().filter((form) => !known.has(form.slug)), ...live]);
      },
      (error) => {
        // Keep what is on screen. An empty list is the failure worth guarding
        // against, and the built-ins are always a truthful answer.
        console.error('[clip] could not read the forms list; showing the built-ins', error);
      },
    );
  }, []);

  /*
   * The tag's destination, applied once.
   *
   * `setOpenSlug` is guarded on the current value rather than on a ref: if the
   * reader has already pressed a form in the second it took this document to
   * arrive, their choice wins. Being moved off the form you just opened is the
   * one failure this screen could have that nobody would understand.
   */
  useEffect(() => {
    let live = true;

    void readFormsPageConfig().then(({ nfcFormSlug }) => {
      if (!live) return;
      setDesignated(nfcFormSlug);
      setOpenSlug((already) => already ?? nfcFormSlug);
    });

    return () => {
      live = false;
    };
  }, []);

  const camp = openSlug === CAMP_FORM_SLUG;
  const open = camp ? null : (forms.find((form) => form.slug === openSlug) ?? null);

  if (open || camp) {
    return (
      <Screen>
        <View style={{ alignItems: 'flex-start' }}>
          <PressableText
            label="‹ All forms"
            hint="Choose a different form"
            color={theme.color.accent}
            onPress={() => setOpenSlug(null)}
          />
        </View>

        {camp ? (
          /*
           * The camp sign-up is not a `FormDefinition` and cannot be one — a
           * registration that repeats a child, carries a ledger written to over
           * weeks and gains roles afterwards is not a field list. It has its own
           * screen in the app, and that screen is clip-safe: it posts to
           * `/api/camp/servant-request` and needs no account.
           */
          <ServantSignUp />
        ) : open?.kind === 'vehicle' ? (
          <>
            <Subheading>{open.title}</Subheading>
            <VehicleForm slug={open.slug} confirmation={open.confirmationMessage} />
          </>
        ) : open ? (
          <>
            <Subheading>{open.title}</Subheading>
            <FormRenderer form={open} />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Body color={theme.color.inkSoft}>
        Fill one in here — no account, and nothing to install.
      </Body>

      {forms.map((form) => (
        <Card key={form.slug}>
          {form.slug === designated ? <Label color={theme.color.accent}>THE TAG OPENS THIS</Label> : null}
          <Subheading>{form.title}</Subheading>
          {form.blurb ? <Small color={theme.color.inkSoft}>{form.blurb}</Small> : null}
          <View style={{ alignItems: 'flex-start', paddingTop: theme.space.xs }}>
            {!form.open ? (
              /*
               * Published but closed — a registration whose date has passed.
               * The church writes the sentence; showing it is the whole reason
               * `open` is a separate field from `published`.
               */
              <Small color={theme.color.inkFaint}>
                {form.closedMessage || 'This form is closed.'}
              </Small>
            ) : elsewhere(form) ? (
              <Button
                label="Open this form"
                tone="quiet"
                onPress={() => openExternal(form.externalUrl as string, theme)}
              />
            ) : (
              <Button label="Fill this in" onPress={() => setOpenSlug(form.slug)} />
            )}
          </View>
        </Card>
      ))}

      {/*
        Serving at summer camp, on the same terms the app's hub offers it:
        appended rather than folded into the list, so a failed read of the forms
        collection cannot take it away, and shown only while the camp's own
        settings say sign-ups are open.
      */}
      {campOpen ? (
        <Card>
          {designated === CAMP_FORM_SLUG ? (
            <Label color={theme.color.accent}>THE TAG OPENS THIS</Label>
          ) : null}
          <Subheading>Serve at summer camp</Subheading>
          <Small color={theme.color.inkSoft}>
            The days you can come, which half of the camp, and what you would like
            to do. Children are registered by the camp.
          </Small>
          <View style={{ alignItems: 'flex-start', paddingTop: theme.space.xs }}>
            <Button label="Sign up to serve" onPress={() => setOpenSlug(CAMP_FORM_SLUG)} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
