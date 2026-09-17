/**
 * The picture controls, in the one place both screens get them from.
 *
 * ---------------------------------------------------------------------------
 * Adding a cover happens twice — on the add form, for a book that has no slug
 * yet, and in a saved book's own settings — and the two differ only in where
 * the chosen pictures are put down. Everything difficult about it is the same
 * on both: which source, the permission, the crop, the shrink, what a tile
 * looks like, and which one is the cover.
 *
 * The website has that split across `Pictures` and `NewProduct`, with the tile
 * markup written out twice. It is one component here for the reason its own
 * notes give about the two sizes of its card: *"the behaviour is where all the
 * difficulty is … two copies of it would be two places to fix the next thing
 * found wrong with it."*
 *
 * ## Two buttons, not a menu
 *
 * The volunteer adding a book is standing at the bookstore table holding it.
 * Photographing the cover is the ordinary case and it should cost one press —
 * not a press, then a sheet, then a choice. So Camera and Library are two
 * controls side by side, and Camera is first because it is the one that is
 * used.
 * ---------------------------------------------------------------------------
 */
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { pickFromLibrary, takePhoto, type PickedPicture } from './picture';

/** How large a tile is. Big enough to tell two covers apart at arm's length. */
const TILE = 88;

/**
 * Camera and library, and the state that says which one is thinking.
 *
 * `busy` is the *caller's* — a save in flight, a book being created — and is
 * separate from the reading state held here. Both disable both buttons, because
 * two pickers open at once is two `launchCameraAsync` promises and the second
 * one wins silently.
 */
export function PictureSource({
  busy,
  onPicked,
  onError,
}: {
  busy: boolean;
  onPicked: (pictures: PickedPicture[]) => void;
  onError: (reason: string) => void;
}) {
  const theme = useTheme();
  /** Which button is working, so only that one shows a spinner. */
  const [reading, setReading] = useState<'camera' | 'library' | null>(null);

  const run = async (which: 'camera' | 'library') => {
    setReading(which);
    try {
      const outcome = await (which === 'camera' ? takePhoto() : pickFromLibrary());
      if (outcome.kind === 'refused') onError(outcome.reason);
      if (outcome.kind === 'picked') onPicked(outcome.pictures);
      /* `cancelled` is somebody changing their mind. It says nothing. */
    } finally {
      setReading(null);
    }
  };

  const inert = busy || reading !== null;

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
      <View style={{ flex: 1 }}>
        <Button
          label={reading === 'camera' ? 'Opening…' : 'Take a photo'}
          tone="quiet"
          onPress={() => void run('camera')}
          disabled={inert}
          busy={reading === 'camera'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Button
          label={reading === 'library' ? 'Reading…' : 'From library'}
          tone="quiet"
          onPress={() => void run('library')}
          disabled={inert}
          busy={reading === 'library'}
        />
      </View>
    </View>
  );
}

/**
 * One picture, and the one thing you can do to it.
 *
 * `action` is not decoration — the three are genuinely different writes, and
 * the label a screen reader gets has to say which:
 *
 *   `remove`  a saved Square photograph, marked to come off at Save
 *   `keep`    that mark, undone
 *   `drop`    a held photograph that has never been sent, thrown away
 *
 * A picture marked to come off is dimmed rather than hidden, because it is
 * still there until Save and hiding it would claim otherwise.
 */
export function PictureTile({
  uri,
  cover,
  dimmed = false,
  busy,
  action,
  what,
  onPress,
}: {
  uri: string;
  cover: boolean;
  dimmed?: boolean;
  busy: boolean;
  action: 'remove' | 'keep' | 'drop';
  /** The book's name, for the label. */
  what: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  const label =
    action === 'keep'
      ? `Keep this picture of ${what}`
      : action === 'drop'
        ? `Do not add this picture of ${what}`
        : `Remove this picture of ${what}`;

  return (
    <View style={{ width: TILE }}>
      <Image
        source={{ uri }}
        style={{
          width: TILE,
          height: TILE,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.color.paperSunken,
          opacity: dimmed ? 0.35 : 1,
        }}
        contentFit="cover"
        accessibilityElementsHidden
      />

      {/* Which one the shelf will show. Square's order decides it, and the
          first is the first — so this moves on its own when one comes off. */}
      {cover ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            left: 4,
            top: 4,
            paddingHorizontal: theme.space.xs,
            paddingVertical: 1,
            borderRadius: theme.radius.full,
            backgroundColor: theme.color.accent,
          }}
        >
          <Micro color={theme.color.inkInverse}>cover</Micro>
        </View>
      ) : null}

      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy }}
        hitSlop={theme.space.xs}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 4,
          top: 4,
          width: 26,
          height: 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.full,
          backgroundColor: pressed ? theme.color.accentStrong : theme.color.deep,
          opacity: busy ? 0.4 : 0.85,
        })}
      >
        <Icon
          name={action === 'keep' ? 'plus' : 'close'}
          color={theme.color.inkInverse}
          size={13}
        />
      </Pressable>
    </View>
  );
}

/** The tiles, wrapped. Its own component only so the two callers cannot drift. */
export function PictureRow({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
      {children}
    </View>
  );
}
