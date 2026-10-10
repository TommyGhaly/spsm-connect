/**
 * Every photograph in a ministry, in one place, with somewhere to put it.
 *
 * ## Why it exists and why it is only on the parent-most node
 *
 * Tommy: *"I want the ability to edit the gallary pictures in the top level
 * node"* — and, on the website, at more length: *"I want the ability, in the
 * parent most node of each program, to edit and delete all of the pictures in
 * the children meaning move them to different nodes ... or permanently delete
 * (with caution)."*
 *
 * Both operations already existed in this app and neither was reachable for the
 * case that actually happens. `PictureTools` puts a pencil on a photograph
 * *that is on the page you are looking at* — fine for correcting one, useless
 * for forty pictures of Week 1 filed onto the ministry because that is what the
 * upload form offered when they were sent. Those forty are on the ministry's
 * own page and nowhere else, and until `getMinistryMedia` they were not even
 * there.
 *
 * **The ministry's own page, and no lower.** A level's page shows a level's
 * subtree, so a manager there could only move a picture *deeper* — and the
 * mistake being corrected is nearly always a picture that is too shallow.
 * Opening it at the root is the only place the full set of moves exists. The
 * website's `PictureManager` says the same thing in the same words.
 *
 * ## A grid and a filter, not drag and drop
 *
 * The website drags photographs onto a list of levels. This app has made the
 * opposite call twice already — the ministry directory reorders with arrows
 * rather than a drag rail, and for the reason given there: a drag on a phone
 * fights the scroll of the page it is on, and a gallery is nothing but scroll.
 *
 * So the move is a destination picker on the photograph, which is the control
 * `PictureSheet` already has and the one the review queue already uses. What
 * this screen adds is the two things a phone was missing: **reach** — every
 * photograph in the ministry, not only the ones the page happens to summarise —
 * and **a way to see the mis-filing**, which is the level filter. "Filed on the
 * ministry: 40" is the sentence that makes somebody open this at all.
 *
 * ## Directly on, not underneath
 *
 * The filter shows what is filed on a level *itself*, not its subtree, and that
 * is the whole point rather than a simplification. A subtree filter would put
 * the forty stray pictures under every ancestor and make the count that matters
 * — how many are sitting on this level rather than inside it — unreadable. The
 * gallery pages are where a subtree is the right question; this is the filing
 * cabinet.
 *
 * ## It is not a security boundary
 *
 * Reached only from the pill on a ministry's own page, which is drawn behind
 * `mayAdminProgram`. Each act is a write `firestore.rules` checks on its own —
 * see `PictureSheet` and the note in `PictureTools` about the volunteer who can
 * move a photograph out of their week and not back.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { submissionTargets, type GalleryTree } from '@spsm/shared';

import { Close, Picker, Sheet, type ChoiceOption } from '@/components/Fields';
import { Button } from '@/components/Surface';
import { Body, Heading, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Picture } from './Picture';
import { PictureSheet } from './PictureTools';
import type { MediaRow, NodeRow, ProgramRow } from './data';

/** How many go across the sheet. Three is a thumbnail you can still recognise. */
const ACROSS = 3;

/** How tall one thumbnail is. Square-ish, because the crop is the focal point's. */
const THUMBNAIL = 96;

/**
 * How many are drawn before the sheet asks whether to draw more.
 *
 * A ministry read is capped at three hundred documents and a `ScrollView`
 * renders every child it is given, so "all of them" is three hundred
 * `expo-image`s decoding at once on somebody's phone. Sixty is more than a
 * screenful and cheap; the button below adds sixty more, and the filter is the
 * faster way to the one you are looking for.
 */
const PAGE = 60;

/** The filter's "no filter", as a value a `Picker` can hold. */
const EVERYTHING = '';

export function PictureManagerSheet({
  program,
  tree,
  media,
  open,
  onClose,
  onChanged,
}: {
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  /**
   * Every approved photograph in the ministry — `getMinistryMedia`, which the
   * page has already read to draw itself.
   *
   * Passed in rather than read again for the reason the page gives about its
   * own reads: this is the same query, it has just run, and a second copy would
   * be a second answer that could disagree with what is on screen behind the
   * sheet. It re-arrives through `onChanged`, which the page owns.
   */
  media: readonly MediaRow[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();

  const [where, setWhere] = useState<string>(EVERYTHING);
  const [shown, setShown] = useState(PAGE);
  /** The photograph whose editor is open, by id, so it survives a re-read. */
  const [editing, setEditing] = useState<string | null>(null);

  /** How many are filed on each destination, for the filter's right-hand note. */
  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const item of media) {
      tally.set(item.programEventId, (tally.get(item.programEventId) ?? 0) + 1);
    }
    return tally;
  }, [media]);

  /*
   * The same list `PictureSheet` moves things to, so the place you filter by
   * and the place you file to are one vocabulary. `submissionTargets` puts the
   * ministry first at depth 0 with every level indented under it — see its
   * header on why the ministry is in a list of levels at all.
   */
  const options = useMemo((): ChoiceOption[] => {
    const targets = submissionTargets({ id: program.id, name: program.name }, tree).map(
      (target) => ({
        value: target.id,
        // Plain spaces, as `PictureTools` indents the same list with. The
        // website has to use non-breaking ones because a native `<select>`
        // collapses runs of whitespace; an RN `Text` keeps them.
        label: `${'  '.repeat(Math.min(target.depth, 6))}${target.title}`,
        note: String(counts.get(target.id) ?? 0),
      }),
    );

    return [{ value: EVERYTHING, label: 'Everywhere', note: String(media.length) }, ...targets];
  }, [program.id, program.name, tree, counts, media.length]);

  const filtered = useMemo(
    () =>
      where === EVERYTHING ? media : media.filter((item) => item.programEventId === where),
    [media, where],
  );

  const page = filtered.slice(0, shown);
  const rows = useMemo(() => chunk(page, ACROSS), [page]);
  const chosen = editing === null ? null : (media.find((item) => item.id === editing) ?? null);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Photographs"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Heading>Photographs</Heading>
            <Small color={theme.color.inkFaint}>
              {media.length === 1 ? 'One in' : `${media.length} in`} {program.name}
            </Small>
          </View>
          <Close onPress={onClose} what="the photographs" />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Picker
          label="Filed on"
          value={where}
          options={options}
          onChange={(next) => {
            setWhere(next);
            // Back to the first page. Keeping the old count would open a
            // narrower list already scrolled past most of itself.
            setShown(PAGE);
          }}
          hint="What is on that level itself, not what is inside it. Photographs sitting on the ministry are the ones nobody filed."
        />

        {filtered.length === 0 ? (
          <Body color={theme.color.inkSoft}>
            {media.length === 0
              ? 'This ministry has no approved photographs yet. Ones waiting for approval are in the queue on its page.'
              : 'Nothing is filed there. Choose somewhere else, or “Everywhere”.'}
          </Body>
        ) : (
          <View style={{ gap: theme.space.xs }}>
            {rows.map((row) => (
              <View key={row[0]?.id} style={{ flexDirection: 'row', gap: theme.space.xs }}>
                {row.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setEditing(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.caption ? `Edit “${item.caption}”` : 'Edit this photograph'
                    }
                    style={{ flex: 1 }}
                  >
                    <Picture media={item} height={THUMBNAIL} />
                  </Pressable>
                ))}
                {/*
                  A short last row keeps the grid's columns rather than
                  stretching two photographs across the sheet. `Canvas` makes
                  the opposite call on the page itself, where a wide cell is a
                  better look at a picture; here the cell is a thumbnail and
                  the column is what makes it scannable.
                */}
                {row.length < ACROSS
                  ? Array.from({ length: ACROSS - row.length }, (_, at) => (
                      <View key={`gap-${at}`} style={{ flex: 1 }} />
                    ))
                  : null}
              </View>
            ))}

            {filtered.length > page.length ? (
              <Button
                label={`Show more (${filtered.length - page.length} left)`}
                tone="quiet"
                onPress={() => setShown((was) => was + PAGE)}
              />
            ) : null}
          </View>
        )}

        <Micro color={theme.color.inkFaint}>
          Tap a photograph to change its caption, move it to another level, or delete it. Moving
          it is what changes which page shows it, here and on the website.
        </Micro>
      </View>

      {/*
        The same editor the pencil on a photograph opens, mounted from the id so
        it is rebuilt against the re-read after every change — and so it closes
        by itself when the photograph it was about is deleted.
      */}
      {chosen ? (
        <PictureSheet
          media={chosen}
          program={program}
          tree={tree}
          onChanged={onChanged}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Sheet>
  );
}

/** Rows of `size`, the last one short. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let at = 0; at < items.length; at += size) rows.push(items.slice(at, at + size));
  return rows;
}
