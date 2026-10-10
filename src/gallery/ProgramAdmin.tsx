/**
 * The ministry administration the directory did not have.
 *
 * A mirror of the website's `/events` editing surface — `ProgramDirectory`'s
 * rail controls and the `ProgramDetails` column beside a selected tile — in the
 * idiom this app settled on for all four of its two-audience screens: a pill in
 * the bottom-right corner (`components/AdminFab`) that turns editing on, and a
 * sheet per thing rather than a column beside it. A phone is too narrow for an
 * inspector that sits next to the page.
 *
 * ## The same questions the website asks, in the same order
 *
 * Name, description, what its parts are called, visible to everyone, remove.
 * That list is `ProgramDetails` and nothing has been added to it or left out —
 * the point of the exercise was that an administrator holding a phone can do
 * what an administrator holding a laptop can do, and a control here the
 * website has not got is the two surfaces drifting on the first day.
 *
 * ## The sheet is also the ministry's own page, which asks two more
 *
 * `ProgramDetailsSheet` is opened from two places now. From the directory it
 * is exactly the list above. From a ministry's own gallery page it also
 * carries the two settings the website keeps in that page's review panel —
 * whether the parish is collecting photographs, and where an upload lands
 * when the sender does not choose — plus the way in to adding a level, which
 * is what that page's pill used to do and all it used to do. Tommy: *"the top
 * level node in the events should have more settings than just adding
 * subnodes."*
 *
 * They are behind the `tree` prop rather than always drawn, because the
 * directory has not read a ministry's levels and "photographs go to" is a
 * list of them. That is the same split the website makes: the review panel
 * exists on the gallery page and nowhere else.
 *
 * ## Superadmin, matching the website and matching the rules
 *
 * The website wraps this whole page in `EditModeProvider allowed={canManagePrograms}`,
 * which is `isSuperadmin(claims)` and nothing else — so a program lead gets no
 * editing *here*, and edits their own ministry from its own page instead. That
 * is not an accident of that file; it follows `firestore.rules`:
 *
 *     allow create, delete: if isSuper();
 *
 * Making and retiring ministries is the superadmin's alone, and those are the
 * two things this screen is for. Drawing the controls for anybody else would be
 * drawing buttons the rules refuse.
 *
 * ## Why editing is a sheet and not the tile
 *
 * The website types into the tile itself, which works because the tile is a
 * third of a wide rail with room for a caret. Here a tile is the width of the
 * screen and 200pt tall, and a text field drawn over a photograph is a field
 * nobody can read. The sheet also gives the destructive control somewhere to
 * live that is not one thumb-width from the ministry's own page.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { flattenGalleryTree, type GalleryTree } from '@spsm/shared';

import { Button } from '@/components/Surface';
import { Check, Close, Field, Picker, Problem, Sheet } from '@/components/Fields';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import {
  createProgram,
  deleteProgram,
  updateProgram,
  type AdminProgramRow,
} from './adminData';
import type { NodeRow } from './data';
import { NewLevelSheet } from './LevelAdmin';

/** The website's `DEFAULT_CHILD_LABEL`, and `[...trail].tsx`'s fallback. */
const DEFAULT_CHILD_LABEL = 'Inside';

/**
 * One ministry's details.
 *
 * ## Every control writes on its own, and says so by being separate
 *
 * There is no Save. Each field commits when it is done — the website's
 * `LiveText` commits on blur, and this does the same — because the page behind
 * the sheet is the parish's live page either way and a Save button would imply
 * a draft that does not exist. What it costs is that a half-typed name is
 * briefly the ministry's name, which is true on the website too.
 *
 * `busy` is one flag for the whole sheet rather than one per field. Two writes
 * to the same document in flight at once is the thing to prevent, and the
 * sheet is small enough that locking all of it for the half-second a write
 * takes is not felt.
 */
export function ProgramDetailsSheet({
  program,
  tree,
  mayRemove,
  open,
  onClose,
  onChanged,
  onRemoved,
}: {
  program: AdminProgramRow;
  /**
   * The ministry's levels, when the caller has them.
   *
   * Present on the ministry's own gallery page, which has already read the
   * whole tree to draw itself; absent in the directory, which lists ministries
   * and knows nothing about what is inside them. It is what the two submission
   * settings and "add something inside" need, and they are drawn only when it
   * is here — an empty tree is a real answer, a ministry with no levels yet,
   * and still gets both.
   */
  tree?: GalleryTree<NodeRow>;
  /**
   * Whether to offer removal.
   *
   * Not a matter of taste: `firestore.rules` is `allow create, delete: if
   * isSuper()` on `/programs` while `allow update: if adminsProgram(programId)`.
   * So a program lead editing their own ministry from its page may rename it
   * and may not retire it, and drawing the red button for them would be a
   * control whose every press is refused with nothing on screen saying why.
   * The directory is superadmin-only and passes true.
   */
  mayRemove: boolean;
  open: boolean;
  onClose: () => void;
  /** Re-read. A name or a description shows on the page behind the sheet. */
  onChanged: () => void;
  /** The thing being edited no longer exists; the directory has to re-read. */
  onRemoved: () => void;
}) {
  const theme = useTheme();

  /*
   * Seeded from the document and edited locally, because a controlled field
   * writing on every keystroke would be a Firestore write per letter. The
   * commit is on blur; `onChanged` then re-reads and the tile behind catches
   * up.
   */
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description);
  const [childLabel, setChildLabel] = useState(program.childLabel ?? '');

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);

  /**
   * Every level of this ministry as one indented list, for the picker.
   *
   * `flattenGalleryTree` is the shared walk the website's own submission
   * settings use, and the indentation is why: "Day 1" appears three times in a
   * ministry with three weeks, and without a depth per row there is nothing to
   * tell them apart.
   */
  const levels = useMemo(() => (tree ? flattenGalleryTree(tree) : []), [tree]);

  /*
   * A stored priority naming a level that is no longer there reads as "no
   * priority" rather than as a blank picker, which is the website's own
   * handling: the level can have been deleted since it was chosen, and the
   * fallback is what a stale id actually produces anyway — see
   * `defaultSubmissionNode`.
   */
  const priority = program.prioritySubmissionNodeId ?? '';
  const chosenPriority = levels.some((row) => row.node.id === priority) ? priority : '';

  const parts = program.childLabel ?? DEFAULT_CHILD_LABEL;

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
          : `That could not be saved. It needs the grant for this ministry, and a connection.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={program.name}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Heading>{program.name}</Heading>
            <Small color={theme.color.inkFaint}>/events/{program.slug}</Small>
          </View>
          <Close onPress={onClose} what={program.name} />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Field
          label="Name"
          value={name}
          onChange={setName}
          onBlur={() => {
            if (name.trim() === program.name) return;
            void write('rename this ministry', () =>
              updateProgram(program.id, { name: name.trim() }),
            );
          }}
          hint={`Its address stays /events/${program.slug} — changing that would break links the church has shared.`}
        />

        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          onBlur={() => {
            if (description === program.description) return;
            void write('edit this ministry', () => updateProgram(program.id, { description }));
          }}
          lines={5}
          format
          placeholder="What this ministry is, when it meets, how somebody joins."
          hint="A blank line starts a new paragraph. The two buttons write the markers; typing them by hand works too."
        />

        {/* What this ministry's parts are called. Shows on the side menu of its
            own page and over the list of them — see `childLabel` in
            `[...trail].tsx`. */}
        <Field
          label="Its parts are called"
          value={childLabel}
          onChange={setChildLabel}
          onBlur={() => {
            if (childLabel.trim() === (program.childLabel ?? '')) return;
            void write('rename the parts of this ministry', () =>
              // Empty means "no opinion", and that has to reach the document as
              // null rather than as an empty string the fallback would then
              // have to second-guess.
              updateProgram(program.id, { childLabel: childLabel.trim() || null }),
            );
          }}
          placeholder={DEFAULT_CHILD_LABEL}
          hint={`What the things one level inside this are called — "Years", "Weeks". Each of those sets its own in turn. Empty means "${DEFAULT_CHILD_LABEL}".`}
        />

        <Check
          label="Visible to everyone"
          checked={program.published}
          onChange={(published) =>
            void write('publish this ministry', () => updateProgram(program.id, { published }))
          }
          hint={
            program.published
              ? 'Anyone can see this ministry under Photos, and on the website.'
              : 'Only administrators can see it. Nothing is published until this is on.'
          }
        />

        {/*
          The two submission settings, and only where the ministry's levels are
          known — see the `tree` prop.

          The website keeps both in the review panel on this same page, beside
          the queue, because they are the other half of the same decision:
          whether the parish is collecting at all, and where what arrives
          lands. They are not in this app's `ReviewQueue` for one reason — it
          draws nothing when nothing is waiting, so the flag that *stops*
          submissions would be reachable only while submissions were still
          coming in.

          Neither write changes anything the page behind this is drawing, but
          both go through `write` anyway, so a refusal is a sentence rather
          than a control that springs back with no explanation.
        */}
        {tree ? (
          <>
            <Check
              label="Collecting photographs"
              checked={program.submissionsOpen}
              disabled={busy}
              onChange={(submissionsOpen) =>
                void write('open or close this ministry to photographs', () =>
                  updateProgram(program.id, { submissionsOpen }),
                )
              }
              hint={
                program.submissionsOpen
                  ? 'The parish can send photographs to this ministry and everything inside it.'
                  : 'Nobody can send photographs here. The “Add photographs” offer disappears from every level.'
              }
            />

            <Picker
              label="Photographs go to"
              value={chosenPriority}
              disabled={busy}
              options={[
                // Null is a real answer and the default one: the sender's own
                // choice stands. First, because it is what a ministry that has
                // never thought about this already does.
                { value: '', label: 'Wherever they are sent from' },
                ...levels.map((row) => ({
                  value: row.node.id,
                  // Plain spaces, as `PictureTools` indents the same kind of
                  // list with. The website needs non-breaking ones because a
                  // native `<select>` collapses whitespace; an RN `Text`
                  // keeps it.
                  label: `${'  '.repeat(Math.min(row.depth, 6))}${row.node.title}`,
                })),
              ]}
              onChange={(next) =>
                void write('set where photographs go', () =>
                  updateProgram(program.id, { prioritySubmissionNodeId: next || null }),
                )
              }
              hint="Where an upload lands when whoever sent it did not pick a level — the week that is running now, usually."
            />

            {/*
              Adding a level, which is what this page's pill did before it did
              anything else. Last of the ministry's own settings and above
              Remove, in the same place `LevelDetailsSheet` puts it, so the two
              sheets read the same way at every depth.
            */}
            <View style={{ gap: theme.space.xs }}>
              <Label>{parts.toUpperCase()}</Label>
              <Button
                label="Add something inside this"
                tone="quiet"
                onPress={() => setAdding(true)}
              />
            </View>
          </>
        ) : null}

        {problem ? <Problem>{problem}</Problem> : null}

        {/*
          Removal, behind a confirmation, at the bottom, and last — and only
          for somebody the rules will let do it. See `mayRemove`.

          The note is the website's own and it is the thing somebody needs
          before they press it: the photographs are not destroyed. Saying so is
          what makes the refusal above it — gatherings first — read as an order
          of operations rather than as the app being obstructive.
        */}
        {mayRemove ? (
          <View style={{ gap: theme.space.xs }}>
            <Label>REMOVE</Label>
            <Micro color={theme.color.inkSoft}>
              Its gatherings have to be removed first, on the website. The photographs are not
              deleted — they become the church&rsquo;s, and any ministry can take them in from
              &ldquo;Not in any ministry&rdquo; in its picture manager.
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
                          await deleteProgram(program.id);
                          onRemoved();
                        } catch (error) {
                          console.error('[programs] could not remove the ministry:', error);
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
                label="Remove this ministry"
                tone="quiet"
                disabled={busy}
                onPress={() => setConfirming(true)}
              />
            )}
          </View>
        ) : null}
      </View>

      {/*
        A sheet over a sheet, exactly as `LevelDetailsSheet` opens the same
        plate over itself. Mounted always and opened by its own prop, which is
        how `NewLevelSheet` is written; it clears its field when a level is
        created, so a second one does not open holding the first one's name.
      */}
      {tree ? (
        <NewLevelSheet
          open={adding}
          programId={program.id}
          parentId={null}
          parts={parts}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            onChanged();
          }}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * Adding one.
 *
 * A name and nothing else, which is the website's own plate — *"the
 * add-a-ministry plate asks for a name before it creates anything"* — and for
 * its reason: the name settles the address, the address can never change, and
 * everything else is edited afterwards in the sheet above. Asking for a
 * description here would be asking for the one field somebody has not thought
 * about yet at the one moment they cannot go back and change their mind.
 *
 * Created unpublished. See `createProgram`.
 */
export function NewProgramSheet({
  open,
  onClose,
  onCreated,
  /** Where it goes in the running order: after everything that exists. */
  nextOrder,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  nextOrder: number;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setProblem(null);
    try {
      await createProgram({ name, description: '', order: nextOrder, published: false });
      setName('');
      onCreated();
    } catch (error) {
      console.error('[programs] could not create the ministry:', error);
      // `createProgram` throws sentences meant to be read — "Give the ministry
      // a name.", "There is already a ministry at /events/…". Pass them through.
      setProblem(
        error instanceof Error && error.message
          ? error.message
          : 'That could not be created. Only a superadmin may add a ministry.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Add a ministry"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Heading>Add a ministry</Heading>
          </View>
          <Close onPress={onClose} what="Add a ministry" />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Micro color={theme.color.inkSoft}>
          It starts hidden, so nothing is public until you turn it on. The name settles its
          address and that cannot be changed afterwards.
        </Micro>

        <Field
          label="What it is called"
          value={name}
          onChange={(next) => {
            setName(next);
            setProblem(null);
          }}
          placeholder="Mother of Mercy"
          required
        />

        {/* The address, worked out as they type, because it is the one
            consequence of this field that cannot be undone. */}
        {name.trim() ? (
          <Small color={theme.color.inkSoft}>It will live at /events/{slugPreview(name)}</Small>
        ) : null}

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

/** What `slugifyName` will make of what has been typed so far. */
function slugPreview(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || '…'
  );
}

/** One ministry's row of controls, under its tile, in edit mode. */
export function TileControls({
  program,
  first,
  last,
  onEdit,
  onMove,
}: {
  program: AdminProgramRow;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      {/*
        Up and down rather than the website's drag rail. A drag on a phone
        fights the scroll of the page it is on, and five ministries is a list
        two presses long from anywhere in it.
      */}
      <Button label="↑" tone="quiet" disabled={first} onPress={() => onMove(-1)} />
      <Button label="↓" tone="quiet" disabled={last} onPress={() => onMove(1)} />
      <View style={{ flex: 1 }} />
      {program.published ? null : <Small color={theme.color.accentStrong}>Hidden</Small>}
      <Button label="Edit" tone="quiet" onPress={onEdit} />
    </View>
  );
}

/** Exported for the directory's empty state, so the words live in one file. */
export function NoMinistriesYet() {
  const theme = useTheme();

  return (
    <Body color={theme.color.inkSoft}>
      The church has no ministries yet. &ldquo;Add a ministry&rdquo; makes one, hidden, for you to
      write and then publish.
    </Body>
  );
}
