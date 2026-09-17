/**
 * What you just took, and the decision about it.
 *
 * ## Why there is a step here at all
 *
 * The shutter could enqueue directly and this screen could not exist. It does
 * exist because of what is downstream: a submission lands in a quarantine
 * prefix and waits in an administrator's review queue, so a photograph of
 * somebody's thumb is not a file the sender can take back — it is a minute of
 * a volunteer's evening. One press of a cross here costs nothing and saves
 * that, every time.
 *
 * It is also where the destination belongs. The pill is on the viewfinder too,
 * because seeing the wrong answer *before* the shutter is better than after —
 * but the moment somebody actually looks at what they caught is the moment they
 * know which day it is of.
 *
 * ## A refusal keeps the preview open
 *
 * `condense` refuses exactly two things and both messages name a number the
 * person can act on — the clip is too long, the type is not a photograph. The
 * useful response to "try trimming it first" is not to be thrown back to a
 * viewfinder with the clip gone. So a refusal is shown *here*, with the clip
 * still on screen and the cross still available.
 */
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Small } from '@/components/Type';
import type { PickOutcome } from '@/upload/pick';
import { useTheme } from '@/theme/ThemeProvider';

import { DestinationBar } from './DestinationBar';
import type { Destination } from './destination';

/** One thing the camera produced, on its way to being sent or thrown away. */
export interface Capture {
  uri: string;
  contentType: string;
  kind: 'photo' | 'video';
}

export function Preview({
  capture,
  destination,
  fallback,
  overridden,
  sending,
  refused,
  onChoose,
  onRevert,
  onDiscard,
  onSend,
}: {
  capture: Capture;
  destination: Destination | null;
  fallback: Destination | null;
  overridden: boolean;
  sending: boolean;
  /** The last attempt's refusals, if it was refused. Kept on screen. */
  refused: PickOutcome['refused'];
  onChoose: (destination: Destination) => void;
  onRevert: () => void;
  onDiscard: () => void;
  onSend: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        ...ABSOLUTE_FILL,
        backgroundColor: theme.color.deep,
      }}
    >
      {capture.kind === 'video' ? (
        <VideoPreview uri={capture.uri} />
      ) : (
        <Image
          source={{ uri: capture.uri }}
          // `contain`, not `cover`. This is the last look somebody gets before
          // the photograph leaves the phone, and a preview that crops is a
          // preview that hides the part they would have wanted to retake.
          contentFit="contain"
          style={ABSOLUTE_FILL}
          accessibilityLabel="The photograph you just took"
        />
      )}

      <Pressable
        onPress={onDiscard}
        disabled={sending}
        accessibilityRole="button"
        accessibilityLabel="Discard and go back to the camera"
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top + theme.space.xs,
          left: theme.space.md,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.full,
          backgroundColor: theme.color.deep,
          opacity: sending ? 0.3 : pressed ? 0.6 : 0.85,
        })}
      >
        <Icon name="close" color={theme.color.inkInverse} size={22} />
      </Pressable>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: theme.space.md,
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
        }}
      >
        {refused.length > 0 ? (
          <View
            style={{
              gap: 2,
              padding: theme.space.sm,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.deep,
              opacity: 0.92,
            }}
          >
            {refused.map((refusal) => (
              <Small key={`${refusal.name}:${refusal.reason}`} color={theme.color.inkInverse}>
                {/* `condense`'s own words, verbatim — they name the number. */}
                {refusal.reason}
              </Small>
            ))}
          </View>
        ) : null}

        <DestinationBar
          destination={destination}
          fallback={fallback}
          ready
          overridden={overridden}
          onChoose={onChoose}
          onRevert={onRevert}
        />

        <Pressable
          onPress={onSend}
          // Nowhere to send it is not a state the button should pretend out of.
          disabled={sending || destination === null}
          accessibilityRole="button"
          accessibilityLabel="Send to the church"
          accessibilityState={{ disabled: sending || destination === null, busy: sending }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space.xs,
            alignSelf: 'center',
            minHeight: 52,
            paddingHorizontal: theme.space.lg,
            borderRadius: theme.radius.full,
            backgroundColor: pressed ? theme.color.accentStrong : theme.color.accent,
            opacity: destination === null ? 0.45 : 1,
          })}
        >
          {sending ? (
            <ActivityIndicator color={theme.color.inkInverse} />
          ) : (
            <Icon name="arrow" color={theme.color.inkInverse} size={20} />
          )}
          <Body color={theme.color.inkInverse}>{sending ? 'Sending…' : 'Send'}</Body>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The clip, playing.
 *
 * Looped, muted and without controls, because this is a *preview* and not a
 * player: the question it answers is "is this the right clip", which a silent
 * loop answers in two seconds and a scrubber does not answer any better. Muted
 * also means the preview never blares a hymn out of somebody's phone in the
 * middle of the liturgy they just recorded.
 *
 * Its own component because `useVideoPlayer` is a hook and the branch above is
 * a condition — a player created only when the capture happens to be a video
 * is a hook called conditionally.
 */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={ABSOLUTE_FILL}
      contentFit="contain"
      nativeControls={false}
      // No PiP: this file has not been sent anywhere yet, and a clip that
      // floats out of the app and over the home screen is a clip somebody
      // thinks they have already dealt with.
      allowsPictureInPicture={false}
      fullscreenOptions={{ enable: false }}
    />
  );
}

const ABSOLUTE_FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;
