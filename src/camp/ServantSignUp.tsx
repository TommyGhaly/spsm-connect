/**
 * The servant sign-up, at /forms/summer-camp. Public.
 *
 * ---------------------------------------------------------------------------
 * The camp's one open door, and the only camp screen a visitor ever sees.
 *
 * Families are registered by an administrator at a desk — that registration
 * carries children's medical notes, a fee and a ledger, and there is no public
 * path to it. A servant sign-up is one person saying which days they can serve,
 * so it is open to anybody with the address: half the camp's servants are
 * teenagers who have never signed in to anything of the church's, and making
 * them wait for a volunteer to type them in is how a camp ends up with a
 * spreadsheet nobody reconciles.
 *
 * What that costs, and what is done about it:
 *
 * - **A submitter can never read back or edit what they sent.** The whole
 *   `campRegistrations` collection is shut and this does not write to it. A
 *   Cloud Function writes a *request*, and an administrator accepting it is
 *   what writes the registration — under their own uid, with their own grant.
 * - **The form closes.** `config/camp.servantSignUp` is a switch on the camp's
 *   settings, and this screen then says the camp is not taking sign-ups rather
 *   than 404ing. A form that accepts sign-ups for a camp that has closed its
 *   list is worse than no form: somebody believes they are coming.
 * ---------------------------------------------------------------------------
 *
 * Why it is not a `FormDefinition` like everything else on the hub: a camp
 * sign-up has a repeating week/day grid, roles that differ by week and by half
 * of the camp, an age-dependent waiver and a charge that is the same whether
 * you serve one week or two. None of that is a `FormField` list, and pretending
 * it is would mean a builder nobody could use.
 */
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import {
  CAMP_GENDERS,
  CAMP_SECTIONS,
  SHIRT_SIZES,
  blankServantSignUp,
  campAge,
  campGenderLabel,
  campGradeLabel,
  campGradesForSection,
  campNeedsGuardian,
  campSectionLabel,
  campWeeksOf,
  clearDesiredRolesForSection,
  shirtSizeLabel,
  validateServantSignUp,
  type CampRegistrationDraft,
  type CampSection,
} from '@spsm/shared';

import { siteUrl } from '@/about/media';
import { Check, Field, Picker, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Lede, Small } from '@/components/Type';
import { money } from '@/payments/money';
import {
  chargeWithCard,
  chargeWithWallet,
  paymentsAvailable,
  walletAvailable,
} from '@/payments/square';
import { useTheme } from '@/theme/ThemeProvider';

import { DayGrid } from './DayGrid';
import { WeekRoles } from './WeekRoles';
import { sendServantSignUp } from './signUp';
import { useCampConfig } from './useCampConfig';

export function ServantSignUp() {
  const theme = useTheme();
  const { ready, config } = useCampConfig();

  const [draft, setDraft] = useState<CampRegistrationDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [wallet, setWallet] = useState(false);

  /*
   * Built once the season is known, so nobody is signed up for last summer —
   * and once the charge is known, so the form can say what it will cost before
   * anybody fills it in.
   *
   * During render rather than in an effect, which is the pattern React
   * documents for "adjust state when something changes" and the one
   * `CalendarScreen` already uses: a `setState` in an effect body is a second
   * render pass that the first one could have avoided, and it is what
   * `react-hooks/set-state-in-effect` objects to. `builtFor` also makes the
   * once-ness explicit — the settings may change under a half-filled form, and
   * rebuilding the draft then would throw away what somebody had typed.
   */
  const [builtFor, setBuiltFor] = useState<string | null>(null);
  if (ready && builtFor === null) {
    setBuiltFor(`${config.programId}:${config.season}`);
    setDraft(
      blankServantSignUp({
        programId: config.programId,
        season: config.season,
        chargeCents: config.servantChargeCents,
        chargeLabel: config.servantChargeLabel,
      }),
    );
  }

  /*
   * Only when the camp charges its servants — and in most years it does not.
   * Asking initialises Square's SDK, which a free sign-up has no reason to
   * touch. See the same guard in `FormRenderer`.
   */
  useEffect(() => {
    if (config.servantChargeCents <= 0) return;

    let live = true;
    void walletAvailable().then((can) => {
      if (live) setWallet(can);
    });
    return () => {
      live = false;
    };
  }, [config.servantChargeCents]);

  if (!ready || !draft) {
    return (
      <Screen>
        <Lede color={theme.color.inkSoft}>Loading…</Lede>
      </Screen>
    );
  }

  if (!config.servantSignUp) {
    return (
      <Screen>
        <Card>
          <Heading>Sign-ups are closed</Heading>
          <Body color={theme.color.inkSoft}>
            The camp is not taking servant sign-ups at the moment. Speak to the church
            office if you would like to help.
          </Body>
        </Card>
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen>
        <Card gap={theme.space.sm}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Icon name="check" size={24} color={theme.color.accent} />
            <Heading>Thank you</Heading>
          </View>
          <Body color={theme.color.inkSoft}>
            Your sign-up has gone to the people running the camp. They will be in touch —
            you are not on the roster until they have said so.
          </Body>
          <Small color={theme.color.inkFaint}>
            Nothing you sent can be read back from here. If something was wrong, send
            another one and say so, or ring the church office.
          </Small>
        </Card>
      </Screen>
    );
  }

  const servant = draft.servant;
  if (!servant) return null;

  const set = (patch: Partial<NonNullable<CampRegistrationDraft['servant']>>) =>
    setDraft({ ...draft, servant: { ...servant, ...patch } });

  const age = campAge(servant.dateOfBirth);
  const needsGuardian =
    servant.dateOfBirth.trim() !== '' && campNeedsGuardian(servant.dateOfBirth);

  const chargeCents = config.servantChargeCents;
  const chargeLabel = config.servantChargeLabel.trim() || 'Servant charge';
  const waiverInForce = config.waiverText.trim().length > 0;

  /** Everything still missing, in the first person. Empty means it can go. */
  function complete(): boolean {
    const problems = validateServantSignUp(draft as CampRegistrationDraft, { waiverInForce });
    setErrors(problems);
    return problems.length === 0;
  }

  async function send(cardToken?: string): Promise<void> {
    setSending(true);
    setErrors([]);

    const result = await sendServantSignUp({
      registration: draft as CampRegistrationDraft,
      message: '',
      ...(cardToken ? { cardToken } : {}),
    });

    if (result.ok) {
      setSent(true);
      return;
    }
    setErrors(result.errors);
    setSending(false);
  }

  /**
   * Pay, and send inside the sheet.
   *
   * The throw is load-bearing, as it is on a paid form: these callbacks read a
   * thrown message as "the payment failed" and keep Square's own sheet open
   * with it printed. Resolving quietly would close the sheet on a sign-up that
   * was never stored.
   */
  async function payAndSend(how: 'wallet' | 'card'): Promise<void> {
    if (!complete()) return;
    setSending(true);
    setErrors([]);

    const settle = async (nonce: string): Promise<true> => {
      const result = await sendServantSignUp({
        registration: draft as CampRegistrationDraft,
        message: '',
        cardToken: nonce,
      });
      if (!result.ok) throw new Error(result.errors.join(' '));
      return true;
    };

    try {
      const done =
        how === 'wallet'
          ? await chargeWithWallet((chargeCents / 100).toFixed(2), settle, chargeLabel)
          : await chargeWithCard(settle);

      if (!done) {
        // The sheet was dismissed. An ordinary outcome; the form is untouched.
        setSending(false);
        return;
      }
      setSent(true);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : 'The payment could not be completed. Nothing has been charged.',
      ]);
      setSending(false);
    }
  }

  return (
    <Screen>
      <Image
        source={{ uri: siteUrl('/img/stock-camp-1000.webp') }}
        style={{
          width: '100%',
          height: 140,
          borderRadius: theme.radius.md,
          backgroundColor: theme.color.paperRaised,
        }}
        contentFit="cover"
        transition={150}
        accessibilityElementsHidden
      />

      <Heading>{`Serve at summer camp ${config.season}`}</Heading>
      {config.note.trim() ? <Body color={theme.color.inkSoft}>{config.note}</Body> : null}
      <Body color={theme.color.inkSoft}>
        Tell the camp who you are and which days you can be there. Somebody will be in
        touch — this is a sign-up, not a place on the roster.
      </Body>

      {chargeCents > 0 ? (
        <Body color={theme.color.inkSoft}>
          {`There is a ${money(chargeCents)} charge for your ${chargeLabel.toLowerCase()}, paid by card at the end of this form. It is the same whether you serve one week or both.`}
        </Body>
      ) : null}

      {errors.length > 0 ? <Problem>{errors.join('\n')}</Problem> : null}

      {/* ------------------------------------------------------------------ */}
      <Label>ABOUT YOU</Label>

      <Field
        label="Your name"
        value={draft.contact.name}
        onChange={(name) => setDraft({ ...draft, contact: { ...draft.contact, name } })}
        autoComplete="name"
      />
      <Field
        label="Phone"
        value={draft.contact.phone}
        onChange={(phone) => setDraft({ ...draft, contact: { ...draft.contact, phone } })}
        keyboard="phone-pad"
        autoComplete="tel"
      />
      <Field
        label="Email"
        value={draft.contact.email}
        onChange={(email) => setDraft({ ...draft, contact: { ...draft.contact, email } })}
        keyboard="email-address"
        autoComplete="email"
        autoCapitalize="none"
      />
      <Field
        label="Date of birth"
        value={servant.dateOfBirth}
        onChange={(dateOfBirth) => set({ dateOfBirth })}
        placeholder="2009-07-14"
        hint={age === null ? 'As year-month-day. The camp places under-18s differently.' : `${age} years old`}
      />

      {/*
        Male or female, and nothing else on this form. The camp splits its
        groups by it and cannot place somebody until it knows — the shared
        `campGenderLabel` is what words it, so this screen and the desk agree.
      */}
      <Picker
        label="Male or female"
        value={servant.gender}
        options={CAMP_GENDERS.map((gender) => ({
          value: gender,
          label: campGenderLabel(gender, 'servant'),
        }))}
        onChange={(gender) => set({ gender: gender as typeof servant.gender })}
        hint="The camp splits its groups by it, so it needs to know before it can place you."
      />

      <Picker
        label="Shirt size"
        value={servant.shirtSize}
        options={SHIRT_SIZES.map((size) => ({ value: size, label: shirtSizeLabel(size) }))}
        onChange={(size) => set({ shirtSize: size as typeof servant.shirtSize })}
      />

      {/* ------------------------------------------------------------------ */}
      <Label>EMERGENCY CONTACT</Label>

      <Field
        label="Contact name"
        value={draft.emergency.name}
        onChange={(name) => setDraft({ ...draft, emergency: { ...draft.emergency, name } })}
      />
      <Field
        label="Contact phone"
        value={draft.emergency.phone}
        onChange={(phone) => setDraft({ ...draft, emergency: { ...draft.emergency, phone } })}
        keyboard="phone-pad"
      />
      <Field
        label="Relationship to you"
        value={draft.emergency.relationship}
        onChange={(relationship) =>
          setDraft({ ...draft, emergency: { ...draft.emergency, relationship } })
        }
        placeholder="Mother, father, friend"
      />

      {/* ------------------------------------------------------------------ */}
      <Label>WHERE YOU WOULD LIKE TO BE</Label>

      {CAMP_SECTIONS.map((section) => {
        const grades = campGradesForSection(section);
        const first = grades[0];
        const last = grades[grades.length - 1];
        const range =
          first && last
            ? first === last
              ? campGradeLabel(first)
              : `${campGradeLabel(first)} – ${campGradeLabel(last)}`
            : undefined;

        return (
          <Check
            key={section}
            label={campSectionLabel(section)}
            hint={range}
            checked={servant.sections.includes(section)}
            onChange={(on) =>
              /*
               * Unticking a half takes its roles with it. Leaving them would
               * send the camp a request to run the elementary craft table from
               * somebody who has just said they are in middle school.
               */
              set(
                on
                  ? { sections: [...servant.sections, section] as CampSection[] }
                  : {
                      sections: servant.sections.filter((entry) => entry !== section),
                      desiredRolesByWeek: clearDesiredRolesForSection(
                        servant.desiredRolesByWeek,
                        section,
                      ),
                    },
              )
            }
          />
        );
      })}

      <Small color={theme.color.inkFaint}>
        Tick both if you do not mind — the two halves run different things, so you will be
        asked about each.
      </Small>

      {/* ------------------------------------------------------------------ */}
      <Label>WHICH WEEKS YOU ARE COMING</Label>
      <Small color={theme.color.inkSoft}>
        Tick a week and you have the whole of it; untick any day you cannot make.
      </Small>

      <DayGrid
        weeks={config.weeks}
        weekStarts={config.weekStarts}
        days={servant.days}
        onChange={(days) => set({ days })}
      />

      {/* ------------------------------------------------------------------ */}
      <Label>WHAT YOU WOULD LIKE TO DO</Label>
      <Small color={theme.color.inkSoft}>
        Tap as many as you like. The camp decides in the end, but it does read this.
      </Small>

      <WeekRoles
        config={config}
        byWeek={servant.desiredRolesByWeek}
        weeksAttending={campWeeksOf(servant.days)}
        sections={servant.sections}
        onChange={(desiredRolesByWeek) => set({ desiredRolesByWeek })}
      />

      <Field
        label="Anything about your times"
        value={servant.availability}
        onChange={(availability) => set({ availability })}
        lines={3}
        placeholder="Mornings only in the second week. I can drive."
      />

      {/* ------------------------------------------------------------------ */}
      {waiverInForce ? (
        <>
          <Label>BEFORE YOU SEND THIS</Label>

          <Card gap={theme.space.sm}>
            {config.waiverText.split(/\n{2,}/).map((paragraph, index) => (
              <Small key={index} color={theme.color.inkSoft}>
                {paragraph}
              </Small>
            ))}
          </Card>

          {/*
            The version is stamped when the box is ticked, so a waiver edited
            afterwards does not retroactively become the thing this person
            agreed to.
          */}
          <Check
            label={
              needsGuardian
                ? 'I am this servant’s parent or guardian, I have read this and I agree to it.'
                : 'I have read this and agree to it.'
            }
            checked={draft.waiver.agreed}
            onChange={(agreed) =>
              setDraft({
                ...draft,
                waiver: {
                  ...draft.waiver,
                  agreed,
                  version: agreed ? config.waiverVersion : '',
                },
              })
            }
          />

          <Field
            label={needsGuardian ? 'Parent or guardian’s name' : 'Type your name to sign'}
            value={draft.waiver.signedName}
            onChange={(signedName) =>
              setDraft({ ...draft, waiver: { ...draft.waiver, signedName } })
            }
            hint={
              needsGuardian
                ? 'You are under 18, so a parent or guardian signs this — their name, not yours.'
                : undefined
            }
          />

          {needsGuardian ? (
            <Field
              label="How they are related to you"
              value={draft.waiver.signedRelationship}
              onChange={(signedRelationship) =>
                setDraft({ ...draft, waiver: { ...draft.waiver, signedRelationship } })
              }
              placeholder="Mother, father, guardian"
            />
          ) : null}
        </>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {chargeCents > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          <Label>PAYMENT</Label>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body color={theme.color.inkSoft}>{chargeLabel}</Body>
            <Heading>{money(chargeCents)}</Heading>
          </View>
          <Small color={theme.color.inkFaint}>
            Paid once, whether you serve one week or both.
          </Small>

          {!paymentsAvailable() ? (
            <Problem>
              This copy of the app cannot take a payment. Please sign up on the church
              website instead.
            </Problem>
          ) : (
            <>
              {wallet ? (
                <Button
                  label={`Pay ${money(chargeCents)} and send my sign-up`}
                  onPress={() => void payAndSend('wallet')}
                  busy={sending}
                />
              ) : null}
              <Button
                label={
                  wallet ? 'Pay by card instead' : `Pay ${money(chargeCents)} and send my sign-up`
                }
                tone={wallet ? 'quiet' : 'primary'}
                onPress={() => void payAndSend('card')}
                busy={sending && !wallet}
              />
            </>
          )}

          <Small color={theme.color.inkFaint}>
            Your answers are sent with the payment, in one step. If the card is declined,
            nothing is sent and nothing is charged. You will not be able to read this back
            or change it afterwards.
          </Small>
        </View>
      ) : (
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={sending ? 'Sending…' : 'Send my sign-up'}
            onPress={() => {
              if (complete()) void send();
            }}
            busy={sending}
          />
          <Small color={theme.color.inkFaint}>
            You will not be able to read this back or change it — it goes straight to the
            people running the camp.
          </Small>
        </View>
      )}
    </Screen>
  );
}
