/**
 * The ministry directory — the entrance to the galleries.
 *
 * The website's `/events`, which it calls "Our activities". Route and label
 * differ on purpose and the reason is in `(tabs)/_layout.tsx`: the path has to
 * match the site's for a universal link to land here, and the word somebody
 * reads is a separate decision.
 *
 * ## Why each ministry is a photograph and not a row
 *
 * The website's answer, quoted in its own page so it is not re-litigated: the
 * page "was not short of *sections*, it was short of *presence*", and what
 * fixed it was making the ministries themselves bigger, because the photographs
 * *are* the content. A list of names would be cheaper here and would be the same
 * mistake.
 *
 * The picture on each tile is `summariseChildren`'s cover for that ministry —
 * chosen by the same walk the website uses, so the two show the same photograph
 * for the same ministry on the same day.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { hasRenderableFile, isSuperadmin } from '@spsm/shared';

import { AdminFab } from '@/components/AdminFab';
import { Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { NoPictures, Picture } from '@/gallery/Picture';
import {
  NewProgramSheet,
  NoMinistriesYet,
  ProgramDetailsSheet,
  TileControls,
} from '@/gallery/ProgramAdmin';
import {
  listProgramsForAdmin,
  reorderPrograms,
  type AdminProgramRow,
} from '@/gallery/adminData';
import {
  getProgramMedia,
  listPrograms,
  type MediaRow,
  type ProgramRow,
} from '@/gallery/data';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * How much of each ministry's archive the directory reads.
 *
 * Small, and it only has to be: this screen needs one cover and two counts per
 * ministry, and both are summaries. A ministry whose newest 60 approved
 * photographs are all still transcoding shows no cover — the same thing it shows
 * when it has none, which is the honest reading either way.
 */
const COVER_WINDOW = 60;

interface Tile {
  program: ProgramRow;
  cover: MediaRow | null;
  photos: number;
  videos: number;
}

export default function Directory() {
  const grants = useGrants();
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  /*
   * Editing the ministries is the superadmin's and nobody else's, which is not
   * this screen's opinion — it is `allow create, delete: if isSuper()` on
   * /programs, and it is the same gate the website puts on the same page
   * (`EditModeProvider allowed={admin.canManagePrograms}`). A program lead edits
   * the ministry they were given from its own page, where the rule that admits
   * them is `adminsProgram(programId)`.
   */
  const mayManage = isSuperadmin(grants.claims);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  /** Which ministry's details are open, by id. */
  const [chosen, setChosen] = useState<string | null>(null);

  const again = useCallback(() => setReload((count) => count + 1), []);

  /*
   * `editing &&`, not `mayManage &&`: the mode is what takes the page away from
   * the reading view, so leaving it must put every draft back out of sight. It
   * also means a superadmin browsing the section sees exactly what the parish
   * sees until they ask not to.
   */
  const asAdmin = mayManage && editing;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const programs = asAdmin ? await listProgramsForAdmin() : await listPrograms();
      if (cancelled) return;

      if (programs.length === 0) {
        // Empty and unreadable are different answers and this screen gives
        // different words for them, so the read failing has to be told apart
        // from the church having published nothing. `listPrograms` swallows its
        // own errors, so the only signal left is that it is a cold empty list —
        // which is why the distinction is drawn here and stays coarse.
        setTiles([]);
        return;
      }

      /*
       * One read per ministry, in parallel. That is a fan-out, and it is bounded
       * by the number of ministries the church runs — four — rather than by its
       * history. The alternative, one query across every program, cannot be
       * ordered and capped per ministry, so a single prolific camp would fill
       * the window and the other three would show no covers at all.
       */
      const built = await Promise.all(
        programs.map(async (program): Promise<Tile> => {
          const media = await getProgramMedia(program.id, COVER_WINDOW);
          return { program, ...summarise(media) };
        }),
      );

      if (!cancelled) setTiles(built);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [asAdmin, reload]);

  return (
    <>
      <Screen>
      <Ministries
        tiles={tiles}
        failed={failed}
        editing={asAdmin}
        onEdit={setChosen}
        onReordered={again}
      />

      {asAdmin ? (
        <NewProgramSheet
          open={adding}
          onClose={() => setAdding(false)}
          nextOrder={(tiles?.length ?? 0) + 1}
          onCreated={() => {
            setAdding(false);
            again();
          }}
        />
      ) : null}

      {/*
        Mounted from the chosen id rather than kept as a copy of the row, so the
        sheet is rebuilt against the re-read after every write and cannot show a
        name the document no longer has.
      */}
      {asAdmin && chosen
        ? (() => {
            const program = adminProgramsOf(tiles).find((one) => one.id === chosen);
            if (!program) return null;

            return (
              <ProgramDetailsSheet
                key={program.id}
                program={program}
                // This whole screen is superadmin-only — `mayManage` above is
                // `isSuperadmin` and nothing else — which is exactly who
                // `allow delete: if isSuper()` lets retire a ministry.
                mayRemove
                open
                onClose={() => setChosen(null)}
                onChanged={again}
                onRemoved={() => {
                  setChosen(null);
                  again();
                }}
              />
            );
          })()
        : null}
      </Screen>

      {/*
        The way in, in the corner, rather than a bar across the top of the page.

        Outside `Screen` because it is an overlay: it must not scroll with the
        ministries, and a control somebody has to scroll to find is a control
        they do not find. Absent entirely for everybody else — including a
        program lead, who has no business with the *list* of ministries; they
        edit the one they were given from its own page.
      */}
      {mayManage ? (
        <AdminFab
          label={editing ? 'Editing' : 'Manage'}
          note={
            editing
              ? 'Hidden ministries are listed here too, marked. Each one’s own page is where its gatherings and photographs are arranged.'
              : undefined
          }
          actions={
            editing
              ? [
                  { label: 'Add a ministry', onPress: () => setAdding(true) },
                  { label: 'Stop editing', onPress: () => setEditing(false) },
                ]
              : [{ label: 'Edit the ministries', onPress: () => setEditing(true) }]
          }
        />
      ) : null}
    </>
  );
}

/**
 * The tiles' programs as administrator rows.
 *
 * A cast in one place with a reason written on it, rather than a second piece
 * of state holding the same list twice. When `asAdmin` is true the read above
 * was `listProgramsForAdmin`, so every row genuinely carries `published` and
 * `order`; nothing outside that branch calls this.
 */
function adminProgramsOf(tiles: Tile[] | null): AdminProgramRow[] {
  return (tiles ?? []).map((tile) => tile.program as AdminProgramRow);
}

/**
 * The ministries, or the sentence that stands in for them.
 *
 * Split out of `Directory` when the admin strip arrived, and only for that: the
 * four outcomes below used to be four `return`s with a `Screen` each, which
 * meant anything that had to be on the page in *all* of them had to be written
 * four times. Nothing about what any one of them draws has changed.
 */
function Ministries({
  tiles,
  failed,
  editing,
  onEdit,
  onReordered,
}: {
  tiles: Tile[] | null;
  failed: boolean;
  editing: boolean;
  onEdit: (programId: string) => void;
  onReordered: () => void;
}) {
  const theme = useTheme();

  /**
   * Move one ministry a place, and write the whole order.
   *
   * Optimistic about nothing: the list is re-read when the batch lands, so a
   * refused write leaves the order as the parish's document has it rather than
   * as the press suggested. Five tiles is fast enough that the round trip reads
   * as the press taking effect.
   */
  async function move(index: number, by: -1 | 1) {
    const programs = (tiles ?? []).map((tile) => tile.program as AdminProgramRow);
    const to = index + by;
    if (to < 0 || to >= programs.length) return;

    const next = [...programs];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(to, 0, moved);

    try {
      await reorderPrograms(next);
    } catch (error) {
      console.error('[programs] could not write the new order:', error);
    } finally {
      onReordered();
    }
  }

  if (failed) {
    return (
      <Card>
        <Label>Not loaded</Label>
        <Body color={theme.color.inkSoft}>
          The church&rsquo;s photographs could not be fetched. They are on the website, and this
          screen will show them again when the connection is back.
        </Body>
      </Card>
    );
  }

  if (tiles === null) {
    return <Lede color={theme.color.inkSoft}>Finding our ministries…</Lede>;
  }

  if (tiles.length === 0) {
    return (
      <Card>
        <Label>Nothing yet</Label>
        {/* Two different facts, and the words follow which one it is: a visitor
            is told the church has published nothing, an administrator in edit
            mode is told there is nothing at all and how to change that. */}
        {editing ? (
          <NoMinistriesYet />
        ) : (
          <Body color={theme.color.inkSoft}>Nothing has been published here yet.</Body>
        )}
      </Card>
    );
  }

  return (
    <>
      <Title>Our activities</Title>
      {tiles.map((tile, index) => (
        <View key={tile.program.id} style={{ gap: theme.space.xs }}>
          <ProgramTile tile={tile} />
          {editing ? (
            <TileControls
              program={tile.program as AdminProgramRow}
              first={index === 0}
              last={index === tiles.length - 1}
              onEdit={() => onEdit(tile.program.id)}
              onMove={(by) => void move(index, by)}
            />
          ) : null}
        </View>
      ))}
    </>
  );
}

/**
 * The ministry's own cover and counts.
 *
 * `summariseChildren` answers this for the *levels* of a program; nothing
 * answers it for a program itself, because the website's directory builds its
 * tiles from `featuredMediaIds` and falls back to the same walk. This is that
 * fallback, applied to one flat window of a ministry's media.
 *
 * `hasRenderableFile` is the part that is easy to leave out and impossible to
 * miss once it bites: without it the cover is the first approved photograph,
 * which may be one mid-transcode — and a tile has no "Processing…" state to fall
 * back to, so the ministry renders with the blank ground of one with no
 * photographs at all.
 */
function summarise(media: readonly MediaRow[]): Omit<Tile, 'program'> {
  const cover =
    media.find(
      (item) => item.kind === 'photo' && item.placement.onPage && hasRenderableFile(item),
    ) ?? null;

  return {
    cover,
    photos: media.filter((item) => item.kind === 'photo').length,
    videos: media.filter((item) => item.kind === 'video').length,
  };
}

function ProgramTile({ tile }: { tile: Tile }) {
  const theme = useTheme();
  const router = useRouter();
  const { program, cover } = tile;

  return (
    <Pressable
      onPress={() => router.push(`/events/${program.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={program.name}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, gap: theme.space.xs })}
    >
      {/* `NoPictures` rather than an empty plate: see the note on it. The count
          line below is what says the ministry has none of its own. */}
      {cover ? <Picture media={cover} height={200} /> : <NoPictures height={200} />}
      <Body>{program.name}</Body>
      <Small color={theme.color.inkSoft}>{countLine(tile)}</Small>
    </Pressable>
  );
}

/**
 * "214 photographs", "12 photographs and 2 clips", or the church's own words for
 * a ministry that has none yet.
 *
 * Written out rather than templated with a trailing "(s)", because this is the
 * line under every ministry on the first screen of the section.
 */
function countLine({ photos, videos }: { photos: number; videos: number }): string {
  if (photos === 0 && videos === 0) return 'No photographs yet';

  const parts: string[] = [];
  if (photos > 0) parts.push(photos === 1 ? '1 photograph' : `${photos} photographs`);
  if (videos > 0) parts.push(videos === 1 ? '1 clip' : `${videos} clips`);
  return parts.join(' and ');
}
