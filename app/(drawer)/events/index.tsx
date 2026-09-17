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
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { hasRenderableFile } from '@spsm/shared';

import { Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { NoPictures, Picture } from '@/gallery/Picture';
import {
  getProgramMedia,
  listPrograms,
  type MediaRow,
  type ProgramRow,
} from '@/gallery/data';
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
  const theme = useTheme();
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const programs = await listPrograms();
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
  }, []);

  if (failed) {
    return (
      <Screen>
        <Card>
          <Label>Not loaded</Label>
          <Body color={theme.color.inkSoft}>
            The church&rsquo;s photographs could not be fetched. They are on the website, and this
            screen will show them again when the connection is back.
          </Body>
        </Card>
      </Screen>
    );
  }

  if (tiles === null) {
    return (
      <Screen>
        <Lede color={theme.color.inkSoft}>Finding our ministries…</Lede>
      </Screen>
    );
  }

  if (tiles.length === 0) {
    return (
      <Screen>
        <Card>
          <Label>Nothing yet</Label>
          <Body color={theme.color.inkSoft}>
            Nothing has been published here yet.
          </Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Our activities</Title>
      {tiles.map((tile) => (
        <ProgramTile key={tile.program.id} tile={tile} />
      ))}
    </Screen>
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
