/**
 * One person, and everything they administer.
 *
 * The right-hand panel of the website's /access, as a pushed screen. What it
 * draws and the order it draws it in are the website's: what they hold at the
 * top, then the ministries they run, then the areas of the site, then the save
 * bar. The controls are the app's — a `Check` whose whole row is the target,
 * because a 20pt box at the start of a line is not answerable with a thumb.
 *
 * ## Explicit save, against the house style
 *
 * Everything else in this app commits as you go — the calendar's entry sheet,
 * the shop's stock controls, a form's flags. This has a Save button, and the
 * exception is deliberate: those screens are editing content, where the worst
 * case of a stray press is a typo somebody fixes. Here a stray press is a
 * person who can suddenly read every form submission in the church, or a
 * servant who quietly lost the ministry they run halfway through a season. A
 * permission change should be a thing you meant to do, and a Save button is the
 * cheapest way to make the boundary between "considering" and "done" visible.
 *
 * The bar is pinned rather than the last thing in the scroll, for the same
 * reason: the screen is much taller than a phone, and the sentence on that bar
 * says what pressing it will do — which is worth nothing if you have to scroll
 * to find out that anything is pending at all.
 *
 * ## Not a security boundary
 *
 * The statement every gated screen in this codebase carries. This decides what
 * to draw. `firestore.rules` decides what can be written — `/members/{uid}` is
 * `allow update: if isSuper()`, and a member cannot even write their own
 * `screenAdmin` map.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Check, Problem } from '@/components/Fields';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small, Subheading } from '@/components/Type';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { AREA_PROGRAMS, FINANCE_SOURCE_ROWS, SCREEN_AREAS } from './areas';
import {
  allocationOf,
  currentUid,
  isDirty,
  readMember,
  readPrograms,
  saveAllocation,
  withFinanceSource,
  withProgram,
  withScreen,
  type AllocatableMember,
  type AllocatableProgram,
  type Allocation,
} from './data';
import { firstName, heldChips, pendingChange, unofferedHeld } from './describe';

export function PersonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { refresh } = useSession();

  const [person, setPerson] = useState<AllocatableMember | null>(null);
  const [programs, setPrograms] = useState<AllocatableProgram[]>([]);
  const [campProgramId, setCampProgramId] = useState('');
  const [draft, setDraft] = useState<Allocation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [who, ministries] = await Promise.all([readMember(uid), readPrograms()]);
        if (!live) return;
        if (who === null) {
          setLoadError('That person has no member record. They may have deleted their account.');
          return;
        }
        setPerson(who);
        setDraft(allocationOf(who));
        setPrograms(ministries.programs);
        setCampProgramId(ministries.campProgramId);
      } catch (cause) {
        console.error('[access] could not read the member', cause);
        if (live) {
          setLoadError(
            cause instanceof Error ? cause.message : 'That person could not be read.',
          );
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [uid]);

  /** The saved allocation, which is what the draft is measured against. */
  const savedAllocation = useMemo(
    () => (person === null ? null : allocationOf(person)),
    [person],
  );

  const dirty =
    savedAllocation !== null && draft !== null && isDirty(savedAllocation, draft);

  const edit = useCallback((change: (current: Allocation) => Allocation) => {
    setDraft((current) => (current === null ? current : change(current)));
    setSaved(false);
  }, []);

  async function save() {
    if (person === null || draft === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveAllocation(person.uid, draft);
      /*
       * The draft becomes the saved state, rather than re-reading the document.
       * `updateDoc` resolved, so these three maps are what is in Firestore; a
       * second read would cost a round trip to be told the same thing.
       */
      setPerson({ ...person, ...draft });
      setSaved(true);

      /*
       * Editing yourself is the one case the session has to be told about.
       *
       * Only a superadmin can open this screen, so the first person anybody
       * narrows is often themselves — and the app reads grants once per launch.
       * Without this they would see the old answer until a cold start, which is
       * indistinguishable from the write having failed. For anybody else the
       * grantee's own app picks it up on its next launch, which is what the
       * saved message says.
       */
      if (person.uid === currentUid()) await refresh();
    } catch (cause) {
      console.error('[access] could not save the allocation', cause);
      setSaveError(cause instanceof Error ? cause.message : 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loadError !== null) {
    return (
      <Screen>
        <Problem>{loadError}</Problem>
      </Screen>
    );
  }

  if (person === null || draft === null || savedAllocation === null) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Reading…</Body>
      </Screen>
    );
  }

  const orphans = unofferedHeld(person);
  const chips = heldChips(person);
  const them = firstName(person.displayName);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      {/* The name in the header, so the back button from here says it too. */}
      <Stack.Screen options={{ title: person.displayName }} />

      {/*
        * `padBottom` rather than the default, which is a safe-area inset plus
        * `xl` — right for a list whose last row has to be pushable clear of the
        * home indicator, and forty points of dead paper here, where the bar
        * below takes that inset itself and is what the scroll ends against.
        */}
      <Screen padBottom={theme.space.md}>
        <Card gap={theme.space.xs}>
          <Heading>{person.displayName}</Heading>
          <Micro color={theme.color.inkFaint}>{person.email || 'no email on file'}</Micro>

          {/*
            * What they hold, before any of the controls.
            *
            * The screen below is a column of blocks with a tick somewhere in
            * each, so "what does this person actually have" was a question you
            * answered by scrolling and reading checkboxes. These are the same
            * answer as one line — and they are the *saved* state, not the
            * draft, so they stay put while you work and are what the Save
            * button is measured against.
            */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.space.xs,
              paddingTop: theme.space.xs,
            }}
          >
            {person.superadmin ? <Chip label="superadmin" tone="accent" /> : null}
            {chips.map((chip) => (
              <Chip key={chip} label={chip} />
            ))}
            {/*
              * "nothing yet" is withheld from somebody holding a flag this
              * screen does not offer, because for them it would be false. The
              * note further down names what they have; this chip's job is to
              * distinguish "no allocation" from "an allocation I have not
              * scrolled to", and it must not answer a question it cannot see
              * the whole of.
              */}
            {!person.superadmin && chips.length === 0 && orphans.length === 0 ? (
              <Chip label="nothing yet" tone="faint" />
            ) : null}
          </View>
        </Card>

        {/*
          * The one thing that would otherwise make this screen look broken. A
          * superadmin passes every check before a flag is consulted —
          * `canAdminScreen` short-circuits on the claim and so does
          * `hasScreen()` in the rules — so ticking boxes for them changes
          * nothing anybody can observe. Better to say so than to let an
          * administrator conclude the save failed.
          */}
        {person.superadmin ? (
          <Card>
            <Small color={theme.color.inkSoft}>
              Superadmins already reach every area below, so these have no effect while {them} is
              one. They are worth setting anyway — they are what remains if that is ever taken
              back. The one exception is noted on the Finance row.
            </Small>
          </Card>
        ) : null}

        {/*
          * Two groups, because the rows are two different shapes of thing. A
          * ministry is a list you pick from; an area is a switch. Running them
          * together as seven identical cards makes the reader work that out
          * from the controls each time.
          */}
        <GroupHeading>What they run</GroupHeading>

        <Card gap={theme.space.xs}>
          <Subheading>{AREA_PROGRAMS.label}</Subheading>
          <Small color={theme.color.inkSoft}>{AREA_PROGRAMS.blurb}</Small>
          {AREA_PROGRAMS.caveat ? (
            <Micro color={theme.color.inkFaint}>{AREA_PROGRAMS.caveat}</Micro>
          ) : null}

          {programs.length === 0 ? (
            <Small color={theme.color.inkFaint}>There are no ministries to delegate yet.</Small>
          ) : (
            <View style={{ paddingTop: theme.space.xs }}>
              {programs.map((program) => (
                <Check
                  key={program.id}
                  label={program.name}
                  hint={program.id === campProgramId ? 'the summer camp' : undefined}
                  checked={draft.programAdmin.programs.includes(program.id)}
                  onChange={(next) =>
                    edit((current) => ({
                      ...current,
                      programAdmin: withProgram(current.programAdmin, program.id, next),
                    }))
                  }
                />
              ))}
            </View>
          )}

          {/*
            * Event-level grants are shown and not editable here, on purpose. A
            * `programAdmin.events` entry is for the volunteer who helps with
            * one gathering, and picking one means a list of every gathering of
            * every ministry — a different screen, belonging next to the
            * gathering itself. Showing the count keeps them from being
            * invisible; dropping them silently on save would be worse.
            */}
          {draft.programAdmin.events.length > 0 ? (
            <Micro color={theme.color.inkFaint}>
              Also holds {draft.programAdmin.events.length} single-event grant
              {draft.programAdmin.events.length === 1 ? '' : 's'}, given from the gathering
              itself. Saving here leaves them alone.
            </Micro>
          ) : null}
        </Card>

        <GroupHeading>Areas of the site</GroupHeading>

        {SCREEN_AREAS.map((area) => (
          <Card key={area.key} gap={theme.space.xs}>
            {/*
              * The tick is the heading. It was a separate control under the
              * prose on the website's first cut, which read as a fourth
              * paragraph in a block of three and put the only thing you came to
              * do at the bottom of each one. Beside the name it makes the
              * column scannable, and it makes the label the area's own name,
              * which is what a screen reader should announce for a checkbox
              * called "Forms".
              */}
            <Check
              label={area.label}
              checked={draft.screenAdmin[area.key]}
              onChange={(next) =>
                edit((current) => ({
                  ...current,
                  screenAdmin: withScreen(current.screenAdmin, area.key, next),
                }))
              }
            />
            <Small color={theme.color.inkSoft}>{area.blurb}</Small>
            {area.caveat ? <Micro color={theme.color.inkFaint}>{area.caveat}</Micro> : null}

            {/*
              * Finance is the one area that is not all-or-nothing.
              * -----------------------------------------------------------
              * The tick above is the door — `hasFinance()` in
              * firestore.rules asks for it before it asks for anything else
              * — and these three say which rooms are behind it.
              *
              * Left enabled while Finance is off, deliberately. Disabling
              * them would mean an administrator has to tick the area, watch
              * three boxes light up, and then untick two — and a control that
              * changes state when you touch something else is how somebody
              * ends up granting more than they meant to. The sentences
              * beneath say what they are worth on their own, which is
              * nothing.
              */}
            {area.key === 'finance' ? (
              <View
                style={{
                  gap: theme.space.xs,
                  marginTop: theme.space.xs,
                  paddingLeft: theme.space.sm,
                  borderLeftWidth: 1,
                  borderLeftColor: theme.color.rule,
                }}
              >
                <Micro color={theme.color.inkFaint}>
                  Which parts of it. All three unless you say otherwise.
                </Micro>

                {/*
                  * The one exception to the notice at the top of this screen,
                  * and it has to be said here rather than left to be
                  * discovered. That notice says a superadmin already reaches
                  * every area below, so ticking these changes nothing
                  * observable. True of every flag on this screen and **not**
                  * true of these three: they are not a permission a superadmin
                  * already holds, they are which part of the money the Finance
                  * screen draws, and they apply to a superadmin exactly as to
                  * anybody else. Which is the whole reason they work at all —
                  * only a superadmin can open this screen, so the first person
                  * anybody narrows is themselves.
                  */}
                {person.superadmin ? (
                  <Micro color={theme.color.inkFaint}>
                    Unlike the areas above, these do take effect for a superadmin. {them} can
                    still reach every figure — the Finance screen simply shows the parts ticked
                    here.
                  </Micro>
                ) : null}

                {FINANCE_SOURCE_ROWS.map((source) => (
                  <View key={source.key}>
                    <Check
                      label={source.label}
                      checked={draft.financeScopes[source.key]}
                      onChange={(next) =>
                        edit((current) => ({
                          ...current,
                          financeScopes: withFinanceSource(current.financeScopes, source.key, next),
                        }))
                      }
                    />
                    <Micro color={theme.color.inkFaint}>{source.blurb}</Micro>
                  </View>
                ))}

                {!draft.screenAdmin.finance ? (
                  <Micro color={theme.color.inkFaint}>
                    These open nothing while Finance itself is off — they narrow that grant
                    rather than standing in for it.
                  </Micro>
                ) : null}
                {draft.screenAdmin.finance &&
                !FINANCE_SOURCE_ROWS.some((source) => draft.financeScopes[source.key]) ? (
                  <Micro color={theme.color.inkFaint}>
                    With none of the three ticked, {them} has the Finance area and nothing in it.
                    That is a thing you can mean — the screen says so plainly rather than showing
                    zeroes.
                  </Micro>
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}

        {/*
          * A flag this screen holds and does not offer. Empty for anybody
          * allocated from here; drawn when it is not, because `saveAllocation`
          * writes the whole map back — so this screen preserves those grants
          * and would otherwise never mention them, which is the one thing worse
          * than not offering them. Same reasoning as the single-event grants
          * above.
          */}
        {orphans.length > 0 ? (
          <Micro color={theme.color.inkFaint}>
            Also holds {orphans.join(', ')}, which this screen does not offer — nothing in the
            app or on the site reads {orphans.length === 1 ? 'it' : 'them'} yet, and saving here
            leaves {orphans.length === 1 ? 'it' : 'them'} alone. Changing{' '}
            {orphans.length === 1 ? 'it' : 'them'} means the Firebase console.
          </Micro>
        ) : null}
      </Screen>

      {/*
        * The save bar, pinned above the home indicator.
        *
        * Outside `Screen` so it does not scroll: the sentence in it is the only
        * confirmation a permission change gets, and a message you have to
        * scroll to is one an administrator misses while looking at the box they
        * just ticked.
        */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.color.rule,
          backgroundColor: theme.color.paperRaised,
          paddingHorizontal: theme.space.gutter,
          paddingTop: theme.space.sm,
          paddingBottom: insets.bottom + theme.space.sm,
          gap: theme.space.xs,
        }}
      >
        {/*
          * A live region rather than a toast, and the change itself rather than
          * "not saved yet" — "Adding Forms, removing Bookstore." See
          * `pendingChange`.
          */}
        <Small
          color={saveError === null ? theme.color.inkSoft : theme.color.accentStrong}
          accessibilityLiveRegion="polite"
        >
          {saveError !== null
            ? saveError
            : saved && !dirty
              ? 'Saved. It takes effect the next time they open the app.'
              : dirty
                ? pendingChange(savedAllocation, draft, campProgramId)
                : 'Nothing to save.'}
        </Small>

        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Save what they administer"
              onPress={() => void save()}
              disabled={!dirty}
              busy={saving}
            />
          </View>
          {dirty && !saving ? (
            <Button
              label="Discard"
              tone="quiet"
              onPress={() => {
                setDraft(allocationOf(person));
                setSaveError(null);
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The heading over a run of cards — the website's `access__group`. */
function GroupHeading({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingTop: theme.space.xs,
      }}
    >
      <Label color={theme.color.inkFaint}>{children}</Label>
      {/* The rule running out to the edge is what makes this a heading rather
          than a stray word floating above a card. As in the drawer. */}
      <View style={{ flex: 1, height: 1, backgroundColor: theme.color.rule }} />
    </View>
  );
}

/** One thing they hold, as a pill. */
function Chip({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'accent' | 'faint' }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: tone === 'accent' ? theme.color.accentSoft : theme.color.paperSunken,
        borderRadius: Math.min(theme.radius.full, 12),
        paddingHorizontal: theme.space.sm,
        paddingVertical: 3,
      }}
    >
      <Label
        color={
          tone === 'accent'
            ? theme.color.accentStrong
            : tone === 'faint'
              ? theme.color.inkFaint
              : theme.color.inkSoft
        }
      >
        {label}
      </Label>
    </View>
  );
}
