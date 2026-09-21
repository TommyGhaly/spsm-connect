/**
 * Editing a level from its own page — the website's "Edit this page", ported.
 *
 * The website puts a pill in the corner of every gallery page (`EditToggle` in
 * `features/programs/editMode.tsx`, the `.edit-toggle` class) and opens a
 * properties column beside the page when it is pressed. This is that column, as
 * a sheet — the pill itself is `components/AdminFab`, shared now with the
 * forms hub, the shop and the ministry directory, which all moved their
 * controls to the same corner.
 *
 * ## The same questions `LevelDetails` asks, in the same order
 *
 * Name, description, whether it has a date and what those dates are, what its
 * parts are called, whether it is visible, and remove. Nothing added, nothing
 * dropped — the two surfaces have to mean the same thing by "edit this page" or
 * an administrator learns one of them and is wrong about the other.
 *
 * ## Bottom right, and why that corner
 *
 * Where the user asked for it, and where the website's is. It also happens to be
 * the one corner of a gallery page that is free: the shelf's pull tab is at the
 * top of the right edge (see `SHELF_CLEARANCE`), the breadcrumb and the upload
 * offer are at the top left, and the header owns the top. A floating control has
 * to be somewhere nothing scrolls under it, and this is it.
 *
 * ## It is not a security boundary
 *
 * `mayAdminProgramEvent` decides what to *draw*. `firestore.rules` decides what
 * may be written, it reads the member document rather than anything here, and
 * somebody who patched the check out of their own build gets controls whose
 * every write is refused.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { PARISH_TIME_ZONE, instantToWallClock, toDate, wallClockToInstant } from '@spsm/shared';

import { Button } from '@/components/Surface';
import { Check, Close, Field, Problem, Sheet } from '@/components/Fields';
import { Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { createLevel, deleteLevel, updateLevel, type AdminNodeRow } from './adminData';
import type { ProgramRow } from './data';

/** The website's `DEFAULT_CHILD_LABEL`, and `[...trail].tsx`'s own fallback. */
const DEFAULT_CHILD_LABEL = 'Inside';

/**
 * One level's details.
 *
 * Every control writes on its own and there is no Save, matching
 * `ProgramDetailsSheet` and the website's `LiveText`: the page behind the sheet
 * is the parish's live page either way, so a Save button would imply a draft
 * that does not exist.
 */
export function LevelDetailsSheet({
  program,
  node,
  open,
  onClose,
  onChanged,
  onRemoved,
}: {
  program: ProgramRow;
  node: AdminNodeRow;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const theme = useTheme();

  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description);
  const [childLabel, setChildLabel] = useState(node.childLabel ?? '');

  const startAt = toDate(node.startAt);
  const [from, setFrom] = useState(dayOf(startAt));
  const [to, setTo] = useState(dayOf(node.endAt));

  /**
   * Whether the date switch is on while it is on and still empty.
   *
   * Null is "nobody has touched it", which is the ordinary case, and then the
   * document answers. The draft only matters for the gap between switching on
   * and typing a date — without it the switch would spring back the instant it
   * was pressed, because the document still has no date to prove it on. The
   * website's `datedDraft`, for the same reason.
   */
  const [datedDraft, setDatedDraft] = useState<boolean | null>(null);
  const dated = datedDraft ?? (startAt !== null || node.endAt !== null);

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);

  async function write(what: string, run: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    try {
      await run();
      onChanged();
    } catch (error) {
      console.error(`[programs] could not ${what}:`, error);
      setProblem(
        error instanceof Error && error.message
          ? error.message
          : 'That could not be saved. It needs the grant for this ministry, and a connection.',
      );
    } finally {
      setBusy(false);
    }
  }

  const parts = node.childLabel ?? program.childLabel ?? DEFAULT_CHILD_LABEL;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={node.title}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Heading>{node.title || 'This level'}</Heading>
            <Small color={theme.color.inkFaint}>in {program.name}</Small>
          </View>
          <Close onPress={onClose} what={node.title} />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Field
          label="Name"
          value={title}
          onChange={setTitle}
          onBlur={() => {
            if (title.trim() === node.title) return;
            void write('rename this', () => updateLevel(node.id, { title: title.trim() }));
          }}
          hint="Its address does not change with its name — links the church has shared keep working."
        />

        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          onBlur={() => {
            if (description === node.description) return;
            void write('edit this', () => updateLevel(node.id, { description }));
          }}
          lines={4}
          placeholder="What this was. Shown above the photographs."
          hint="A blank line starts a new paragraph. *italic* and **bold** work."
        />

        {/*
          Dates, behind a switch, because most levels have no date.

          Both fields were always optional and "no date" was always expressible
          by leaving them empty — but two empty inputs *look* like two things
          nobody has filled in yet, so a day of a camp and a week whose dates
          nobody got round to were indistinguishable. A switch that is off says
          the level has no date and means it.

          They are not decoration: undated levels sort *after* dated ones, so a
          week with no dates turns up in an arbitrary place in its year.
        */}
        <Check
          label="It has a date"
          checked={dated}
          disabled={busy}
          hint="Off for a day of a camp or a standing class. Undated levels sort after dated ones, in the order you put them in."
          onChange={(on) => {
            setDatedDraft(on);
            // Only the clearing is a write. Switching *on* has nothing to save
            // yet — there is no date until one is typed — so it reveals the
            // fields and waits.
            if (!on) {
              setFrom('');
              setTo('');
              void write('clear the dates', () =>
                updateLevel(node.id, { startAt: null, endAt: null }),
              );
            }
          }}
        />

        {dated ? (
          <>
            <Field
              label="From"
              value={from}
              onChange={setFrom}
              onBlur={() => void commitDate('startAt', from)}
              placeholder="2026-08-03"
              keyboard="numbers-and-punctuation"
              hint="Year, month, day."
            />
            <Field
              label="To"
              value={to}
              onChange={setTo}
              onBlur={() => void commitDate('endAt', to)}
              placeholder="2026-08-08"
              keyboard="numbers-and-punctuation"
              hint={to ? undefined : 'Optional'}
            />
          </>
        ) : null}

        <Field
          label="Its parts are called"
          value={childLabel}
          onChange={setChildLabel}
          onBlur={() => {
            if (childLabel.trim() === (node.childLabel ?? '')) return;
            void write('rename the parts of this', () =>
              updateLevel(node.id, { childLabel: childLabel.trim() || null }),
            );
          }}
          placeholder={DEFAULT_CHILD_LABEL}
          hint={`What the things one level inside *this* are called — not what this one is. A year says "Weeks"; each week then says "Days" for itself. Empty means "${DEFAULT_CHILD_LABEL}".`}
        />

        <Check
          label="Visible to everyone"
          checked={node.published}
          disabled={busy}
          hint={
            node.published
              ? 'Anyone can open this level and see its photographs.'
              : 'Only administrators can see it. Nothing here is published until this is on.'
          }
          onChange={(published) =>
            void write('publish this', () => updateLevel(node.id, { published }))
          }
        />

        {problem ? <Problem>{problem}</Problem> : null}

        <View style={{ gap: theme.space.xs }}>
          <Label>{parts.toUpperCase()}</Label>
          <Button label={`Add something inside this`} tone="quiet" onPress={() => setAdding(true)} />
        </View>

        <View style={{ gap: theme.space.xs }}>
          <Label>REMOVE</Label>
          <Micro color={theme.color.inkSoft}>
            The photographs filed here are not deleted — they move up to the ministry, where they
            can be filed again. Anything nested inside this has to be removed first.
          </Micro>

          {confirming ? (
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Keep it" tone="quiet" onPress={() => setConfirming(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Remove"
                  tone="danger"
                  busy={busy}
                  disabled={busy}
                  onPress={() =>
                    void (async () => {
                      setBusy(true);
                      setProblem(null);
                      try {
                        await deleteLevel(node.id, program.id);
                        onRemoved();
                      } catch (error) {
                        console.error('[programs] could not remove the level:', error);
                        setProblem(
                          error instanceof Error && error.message
                            ? error.message
                            : 'That could not be removed.',
                        );
                        setConfirming(false);
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                />
              </View>
            </View>
          ) : (
            <Button
              label="Remove this level"
              tone="quiet"
              disabled={busy}
              onPress={() => setConfirming(true)}
            />
          )}
        </View>
      </View>

      <NewLevelSheet
        open={adding}
        programId={program.id}
        parentId={node.id}
        parts={parts}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          onChanged();
        }}
      />
    </Sheet>
  );

  /** One date field, committed. Empty clears it; unreadable says so. */
  async function commitDate(field: 'startAt' | 'endAt', value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      await write('clear that date', () => updateLevel(node.id, { [field]: null }));
      return;
    }

    /*
     * Midnight in the parish's zone, not the phone's. A level dated on a
     * holiday in California would otherwise be filed a day early — the same
     * trap `events/format.ts` documents, and the same answer.
     */
    const instant = wallClockToInstant(`${trimmed}T00:00`, PARISH_TIME_ZONE);
    if (!instant) {
      setProblem('Write the day as 2026-08-03.');
      return;
    }

    await write('set that date', () => updateLevel(node.id, { [field]: instant }));
  }
}

/**
 * Adding a level inside another — or the first one inside a ministry.
 *
 * A name and nothing else, matching the ministry plate and for its reason: the
 * name settles the address, the address never changes, and everything else is
 * edited afterwards from the level's own page.
 *
 * Created **visible**, unlike a ministry. A level is made from inside a gallery
 * somebody is already arranging, it has no photographs in it yet so there is
 * nothing to leak, and a new week that did not appear in its own shelf would
 * read as the button having failed.
 */
export function NewLevelSheet({
  open,
  programId,
  parentId,
  parts,
  onClose,
  onCreated,
}: {
  open: boolean;
  programId: string;
  /** Null makes it a top-level part of the ministry. */
  parentId: string | null;
  /** The church's word for what goes in here — "Weeks", "Days". */
  parts: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setProblem(null);
    try {
      await createLevel(programId, parentId, {
        title,
        description: '',
        startAt: null,
        endAt: null,
        published: true,
        submissionsOpen: true,
      });
      setTitle('');
      onCreated();
    } catch (error) {
      console.error('[programs] could not create the level:', error);
      // `createLevel` throws sentences meant to be read. Pass them through.
      setProblem(
        error instanceof Error && error.message
          ? error.message
          : 'That could not be created. It needs the grant for this ministry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={`Add to ${parts}`}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Heading>Add something inside</Heading>
            <Small color={theme.color.inkFaint}>{parts}</Small>
          </View>
          <Close onPress={onClose} what="Add something inside" />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Micro color={theme.color.inkSoft}>
          Its date, description and what goes inside *it* are set on its own page, once it
          exists. The name settles its address and that cannot be changed afterwards.
        </Micro>

        <Field
          label="What it is called"
          value={title}
          onChange={(next) => {
            setTitle(next);
            setProblem(null);
          }}
          placeholder="Week 1"
          required
        />

        {problem ? <Problem>{problem}</Problem> : null}

        <Button
          label={busy ? 'Adding…' : 'Add it'}
          onPress={() => void add()}
          busy={busy}
          disabled={busy}
        />
      </View>
    </Sheet>
  );
}

/** A stored instant as the `YYYY-MM-DD` the field edits, in the parish's zone. */
function dayOf(instant: Date | null): string {
  return instant ? instantToWallClock(instant, PARISH_TIME_ZONE).slice(0, 10) : '';
}
