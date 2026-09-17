/**
 * `/admin/camp` — the camp's front page on a phone, and the one switch.
 *
 * ---------------------------------------------------------------------------
 * The website's camp home is a settings panel: the season, the number of
 * weeks, the week dates, the fee, the servant charge, the waiver, the roles a
 * servant may ask for, and two form switches. Every one of those is a decision
 * somebody makes once, sitting down, with the camp's paperwork open — except
 * one.
 *
 * **Closing the servants' sign-up is the exception**, and that is why it is the
 * only setting here. The moment it is needed is the moment nobody is sitting
 * down: the hall is full, the last shirt is spoken for, somebody has just asked
 * whether their cousin can still sign up, and the answer has to stop being
 * "yes" before the next person fills the form in. That is a thing to do
 * standing up, from a pocket, in one tap. Retyping a waiver is not.
 *
 * So the rest of the settings stay on the website and this screen says so,
 * plainly, rather than offering a subset that leaves somebody hunting for the
 * field that is not here. `config/camp` has exactly one writer in this app —
 * see `setServantSignUp`.
 *
 * ## What the switch does not do
 *
 * It does not stop the sign-ups already sitting in the queue, and it does not
 * accept them. A sign-up lands in `campServantRequests` and becomes a
 * registration when an administrator accepts it on the website; closing the
 * form closes the door and leaves everybody already through it exactly where
 * they were. The card says that, because "closed" reading as "cancelled" is the
 * one way somebody could press this and be wrong about what happened.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { campWeekRangeLabel } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/Surface';
import { Body, Label, Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CampProblem, CampShell } from './CampShell';
import { setServantSignUp } from './data';
import { useCampAdmin } from './session';

export function CampHome() {
  const theme = useTheme();
  const session = useCampAdmin();
  const { config, uid } = session;

  return (
    <CampShell session={session} tab="home">
      <SignUpSwitch open={config.servantSignUp} uid={uid} />

      <Card gap={theme.space.xs}>
        <Label>WHEN CAMP RUNS</Label>
        {config.weeks < 1 ? (
          <Body color={theme.color.inkSoft}>
            The camp has not published its weeks yet.
          </Body>
        ) : (
          Array.from({ length: config.weeks }, (_unused, index) => index + 1).map((week) => {
            const range = campWeekRangeLabel(config.weekStarts, week);
            return (
              <View
                key={week}
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm }}
              >
                <Small>Week {week}</Small>
                <View style={{ flex: 1 }} />
                {/*
                  * `campWeekRangeLabel` answers "Week 2" when the camp has set
                  * no dates, which beside the label would read as the same
                  * thing said twice. Saying "no dates set" instead is the
                  * honest version and is what sends somebody to the website.
                  */}
                <Small color={theme.color.inkSoft}>
                  {range === `Week ${week}` ? 'no dates set' : range}
                </Small>
              </View>
            );
          })
        )}
      </Card>

      <Card gap={theme.space.xs}>
        <Label>THE REST IS ON THE WEBSITE</Label>
        <Body color={theme.color.inkSoft}>
          The season, the week dates, the fee, the waiver and the roles a servant may ask
          for are all set at /admin/camp on the church website, and so is accepting a
          sign-up into a registration. This app has the register, the groups as they were
          arranged, and the switch above.
        </Body>
      </Card>
    </CampShell>
  );
}

/* -------------------------------------------------------------------------- */

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Open, or closed, and the sentence that says which.
 *
 * Written the instant it is pressed — there is no Save button, for the reason
 * the website's settings panel gives: a settings screen with one is a screen
 * where somebody closes the sign-up, wanders off, and leaves it open.
 *
 * The state is read from `config/camp` and not from a local copy of it, so the
 * switch shows what the camp is actually set to even while this write is in
 * flight — `useCampConfig` is a live listener, and the echo of our own write is
 * what moves the switch. That is also what makes a *refused* write visible:
 * the switch stays where it was and the line underneath says why.
 */
function SignUpSwitch({ open, uid }: { open: boolean; uid: string | null }) {
  const theme = useTheme();
  const [state, setState] = useState<SaveState>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  async function flip() {
    setState('saving');
    setProblem(null);
    try {
      await setServantSignUp(!open, uid);
      setState('saved');
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => setState('idle'), 2000);
    } catch (cause) {
      setState('failed');
      /*
       * The two failures worth telling apart in words.
       *
       * `not-found` is a camp whose `config/camp` has never been created —
       * nothing is wrong with the permission and the fix is a one-line script
       * on the website's repo. Everything else is almost always the grant, and
       * sending somebody to the office over a missing document would send them
       * to the wrong person.
       */
      const code = (cause as { code?: string })?.code ?? '';
      setProblem(
        code.includes('not-found')
          ? 'The camp has no settings document yet. It has to be created on the website first.'
          : code.includes('permission-denied')
            ? 'Firestore refused that. You may no longer have the camp — pull down to refresh, or sign in again.'
            : (cause as Error)?.message || 'The switch did not go through.',
      );
    }
  }

  return (
    <Card gap={theme.space.sm}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Label>SERVANT SIGN-UPS</Label>
        <View style={{ flex: 1 }} />
        {state === 'idle' ? null : (
          <Micro
            color={state === 'failed' ? theme.color.accentStrong : theme.color.inkFaint}
            accessibilityRole="alert"
          >
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Not saved'}
          </Micro>
        )}
      </View>

      <Toggle
        on={open}
        busy={state === 'saving'}
        onPress={() => void flip()}
        onLabel="Open"
        offLabel="Closed"
        name="Servant sign-ups"
      />

      <Body color={theme.color.inkSoft}>
        {open
          ? 'Anybody with the link can sign up to serve. Sign-ups wait in a queue until somebody accepts them on the website.'
          : 'The sign-up form says the camp is not taking servants. Everybody already signed up stays exactly where they are — closing the form does not cancel anybody.'}
      </Body>

      {problem ? <CampProblem error={problem} /> : null}
    </Card>
  );
}

/**
 * A switch, drawn as the calendar's servants toggle is.
 *
 * Deliberately not React Native's `Switch`: the platform control carries no
 * label, so "open" and "closed" would have to be written beside it and then
 * read against a track whose colour is the platform's rather than the church's.
 * This says the word it means.
 */
function Toggle({
  on,
  busy,
  onPress,
  onLabel,
  offLabel,
  name,
}: {
  on: boolean;
  busy: boolean;
  onPress: () => void;
  onLabel: string;
  offLabel: string;
  name: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="switch"
      accessibilityLabel={name}
      accessibilityState={{ checked: on, busy, disabled: busy }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        backgroundColor: pressed
          ? theme.color.paperSunken
          : on
            ? theme.color.accentSoft
            : theme.color.paperRaised,
        borderColor: on ? theme.color.accent : theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.full,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        minHeight: 44,
        opacity: busy ? 0.6 : 1,
      })}
    >
      <Icon
        name={on ? 'check' : 'lock'}
        size={16}
        color={on ? theme.color.accent : theme.color.inkFaint}
      />
      <Subheading color={on ? theme.color.accentStrong : theme.color.inkSoft}>
        {on ? onLabel : offLabel}
      </Subheading>
      <View style={{ flex: 1 }} />
      <Small color={theme.color.inkFaint}>{on ? 'Tap to close' : 'Tap to open'}</Small>
    </Pressable>
  );
}
