/**
 * The nomination for ordination, at /forms/ordination. Public.
 *
 * ---------------------------------------------------------------------------
 * The website's `NominationScreen` (features/ordination/NominationScreen.tsx),
 * in this app's components and with the same words. It is the nominee page of
 * the diocese's form, written to the nominee; a parent filling it in for a son
 * says so in one optional field. Nobody signs in — the camp's servant sign-up
 * is the model, and like it a nomination cannot be read back once sent.
 *
 * There is no choosing the ordination: the form takes the open one, the
 * soonest should two ever be open at once. The priest's half of the diocese's
 * page — attendance, conduct, the father of confession's approval — is
 * answered on the website's admin screen when the nomination is approved.
 *
 * Which fields show follows the rank: a cantor's and a reader's page has a
 * school grade and parents, a subdeacon's a level of study or profession and
 * no parents. `validateOrdinationDraft` is shared, so the app and the website
 * refuse the same things, and the Function checks again.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import {
  ORDINATION_RANKS,
  ORDINATION_RANK_INFO,
  ageOn,
  emptyOrdinationDraft,
  isOrdinationRank,
  longDay,
  ordinationRankLabel,
  validateOrdinationDraft,
  type Ordination,
  type OrdinationApplicationDraft,
  type OrdinationContact,
  type OrdinationNominee,
  type OrdinationRank,
} from '@spsm/shared';

import { Field, Picker, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Lede, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { sendNomination } from './apply';
import { watchOpenOrdinations, type WithId } from './data';

const TITLE = 'Nomination for ordination';

export function NominationScreen() {
  const theme = useTheme();
  // `?rank=reader` preselects the rank, as it does on the website.
  const params = useLocalSearchParams<{ rank?: string }>();
  const wanted = isOrdinationRank(params.rank) ? params.rank : '';

  const [ordination, setOrdination] = useState<WithId<Ordination> | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<OrdinationApplicationDraft>(() =>
    emptyOrdinationDraft('', wanted),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(
    () =>
      watchOpenOrdinations(
        (rows) => {
          const soonest = rows[0] ?? null;
          setOrdination(soonest);
          setDraft((current) => ({ ...current, ordinationId: soonest?.id ?? '' }));
        },
        (error) => {
          console.error('[ordination] could not read the open ordinations', error);
          setFailed(true);
        },
      ),
    [],
  );

  if (failed) {
    return (
      <Screen>
        <Problem>
          The list of ordinations could not be read. Go back and open this form again in a
          moment.
        </Problem>
      </Screen>
    );
  }

  if (ordination === undefined) {
    return (
      <Screen>
        <Lede color={theme.color.inkSoft}>Loading…</Lede>
      </Screen>
    );
  }

  if (ordination === null) {
    return (
      <Screen>
        <Card>
          <Heading>{TITLE}</Heading>
          <Body color={theme.color.inkSoft}>
            The church is not taking nominations for ordination at the moment. Speak to one of
            the parish priests if you would like to be considered.
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
            The nomination has gone to the parish priests. They will be in touch — it is a
            nomination, not an ordination, until they have reviewed it and the diocese has
            received it.
          </Body>
          <Small color={theme.color.inkFaint}>
            Nothing you sent can be read back from here. If something was wrong, send it again
            and say so in the note at the end.
          </Small>
        </Card>
      </Screen>
    );
  }

  const rank = draft.rank || null;
  const info = rank ? ORDINATION_RANK_INFO[rank] : null;
  const nominee = draft.nominee;
  const age = ageOn(nominee.dateOfBirth, ordination.date);

  const setNominee = (patch: Partial<OrdinationNominee>) =>
    setDraft({ ...draft, nominee: { ...nominee, ...patch } });
  const setParent = (index: number, patch: Partial<OrdinationContact>) =>
    setDraft({
      ...draft,
      parents: draft.parents.map((parent, at) => (at === index ? { ...parent, ...patch } : parent)),
    });

  async function send() {
    if (!ordination) return;
    const problems = validateOrdinationDraft(draft, ordination.date);
    setErrors(problems);
    if (problems.length > 0) return;
    setSending(true);
    const result = await sendNomination(draft);
    setSending(false);
    if (result.ok) setSent(true);
    else setErrors(result.errors);
  }

  return (
    <Screen>
      <Heading>{TITLE}</Heading>
      <Body color={theme.color.inkSoft}>
        {`For the ordination on ${longDay(ordination.date)}, please fill out this form by choosing the deacon rank you are asking for. Then the priests will review every nomination. You will be notified of their decision through one of the church deacons.`}
      </Body>
      {ordination.closesOn ? (
        <Card>
          <Body>{`Last day to apply: ${longDay(ordination.closesOn)}.`}</Body>
          <Small color={theme.color.inkSoft}>Nominations close at the end of that day.</Small>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <Label>WHICH RANK</Label>
      <Picker
        label="Rank"
        value={draft.rank}
        placeholder="Choose one"
        options={ORDINATION_RANKS.map((value) => ({
          value,
          label: ordinationRankLabel(value),
        }))}
        onChange={(value) => setDraft({ ...draft, rank: value as OrdinationRank | '' })}
        hint={
          info
            ? `The diocese asks that a ${info.title.toLowerCase()} has completed ${info.minimumAge} years of age.`
            : undefined
        }
      />

      {rank && info ? (
        <>
          {/* -------------------------------------------------------------- */}
          <Label>ABOUT YOU</Label>
          <Field
            label="Your full name"
            value={nominee.name}
            onChange={(name) => setNominee({ name })}
            autoComplete="off"
            autoCapitalize="words"
          />
          <Field
            label="Address"
            value={nominee.address}
            onChange={(address) => setNominee({ address })}
            placeholder="Street, city, state, ZIP"
          />
          <Field
            label="Date of birth"
            value={nominee.dateOfBirth}
            onChange={(dateOfBirth) => setNominee({ dateOfBirth })}
            placeholder="2010-07-14"
            keyboard="numbers-and-punctuation"
            hint={
              age === null
                ? 'As year-month-day.'
                : `${age} on the day of the ordination${
                    age < info.minimumAge
                      ? ` — younger than the ${info.minimumAge} the diocese asks for`
                      : ''
                  }`
            }
          />
          {info.minor ? (
            <Field
              label="School grade"
              value={nominee.schoolGrade}
              onChange={(schoolGrade) => setNominee({ schoolGrade })}
              placeholder="e.g. 9th grade"
            />
          ) : (
            <Field
              label="Level of study or professional position"
              value={nominee.occupation}
              onChange={(occupation) => setNominee({ occupation })}
            />
          )}
          <Field
            label="Telephone"
            value={nominee.phone}
            onChange={(phone) => setNominee({ phone })}
            keyboard="phone-pad"
            autoComplete="tel"
          />
          <Field
            label="Email"
            value={nominee.email}
            onChange={(email) => setNominee({ email })}
            keyboard="email-address"
            autoComplete="email"
            autoCapitalize="none"
          />
          <Field
            label="Father of confession"
            value={nominee.fatherOfConfession}
            onChange={(fatherOfConfession) => setNominee({ fatherOfConfession })}
            placeholder="e.g. Fr. Mina"
            hint="The diocese asks the parish priests whether he has approved your nomination."
          />

          {/* -------------------------------------------------------------- */}
          {info.minor ? (
            <>
              <Label>PARENTS</Label>
              <Small color={theme.color.inkSoft}>
                {age !== null && age < 18
                  ? 'At least one parent, since you are under 18.'
                  : 'If applicable.'}
              </Small>
              {draft.parents.map((parent, index) => (
                <View key={index} style={{ gap: theme.space.sm }}>
                  <Field
                    label={`Parent ${index + 1} name`}
                    value={parent.name}
                    onChange={(name) => setParent(index, { name })}
                    autoCapitalize="words"
                  />
                  <Field
                    label="Telephone"
                    value={parent.phone}
                    onChange={(phone) => setParent(index, { phone })}
                    keyboard="phone-pad"
                  />
                  <Field
                    label="Email"
                    value={parent.email}
                    onChange={(email) => setParent(index, { email })}
                    keyboard="email-address"
                    autoCapitalize="none"
                  />
                </View>
              ))}
            </>
          ) : null}

          {/* -------------------------------------------------------------- */}
          <Label>ANYTHING ELSE</Label>
          <Field
            label="Filling this in for your son? Your name"
            value={draft.submittedBy}
            onChange={(submittedBy) => setDraft({ ...draft, submittedBy })}
            autoCapitalize="words"
          />
          <Field
            label="A note for the parish priests"
            value={draft.message}
            onChange={(message) => setDraft({ ...draft, message })}
            lines={3}
          />

          {/*
            The problems sit above the button rather than at the top of the
            page, which is where somebody who has just pressed it is looking.
          */}
          {errors.length > 0 ? <Problem>{errors.join('\n')}</Problem> : null}

          <View style={{ gap: theme.space.sm }}>
            <Button
              label={sending ? 'Sending…' : `Send my nomination for ${ordinationRankLabel(rank)}`}
              onPress={() => void send()}
              busy={sending}
            />
            <Small color={theme.color.inkFaint}>
              It goes straight to the parish priests. You will not be able to read it back or
              change it here.
            </Small>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
