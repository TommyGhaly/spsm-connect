/**
 * `/c/photos` — take one photograph, send it to the parish galleries.
 *
 * ---------------------------------------------------------------------------
 * The tag this opens is by a door, at whatever the church is doing this week,
 * and the errand is one photograph. Not `CameraScreen`, which is the full app's
 * viewfinder: video, a library thumbnail, a destination bar, a queue pill and
 * the batch behind it. Three of those cannot exist here —
 *
 *   - **No library.** PhotoKit provides no functionality at runtime inside an
 *     App Clip. The camera is not a preference, it is the whole of what a clip
 *     may use, which is why `expo-media-library` is excluded from the target.
 *   - **No queue.** `expo-sqlite` is excluded, and background execution is
 *     forbidden — see `clipUpload.ts` for what replaces it.
 * ## Where a photograph goes, and how to change it
 *
 * It opens on **the church's own answer** — `config/events.mainSection`, "the
 * thing happening now" — because a plaque by a door cannot be reprogrammed
 * every week, so it points at one URL and the office changes the answer in one
 * field. See `gallery/mainSection.ts`.
 *
 * And it can be changed, by the app's own `DestinationBar` and `useDestination`
 * — the pill under the viewfinder, unforked. The rule those two carry matters
 * more here than it does in the app: **the church's answer is live, the
 * sender's answer wins, and the sender's answer does not outlive the visit.**
 * A clip *is* one visit, so an override lasts exactly as long as it should
 * without anything here arranging it.
 *
 * The pill is also what says there is nowhere to send at all. Nothing set, a
 * ministry since deleted, submissions closed and an aeroplane all arrive
 * identically, and none of them is an error — the shutter is simply held until
 * there is somewhere for a photograph to go.
 *
 * ## What can still refuse at the end
 *
 * `galleryUploadUrl` reads `X-Firebase-AppCheck` by hand and answers
 * `401 unattested` without it, and whether App Check can mint a token inside a
 * clip is the open question `AppCheckSpike.tsx` exists to settle on hardware.
 * `upload/errors.ts` already has the words for that refusal, and they are shown
 * verbatim rather than being re-explained here.
 * ---------------------------------------------------------------------------
 */
import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small, Subheading } from '@/components/Type';
import { sendOnePhotograph } from '@/clip/clipUpload';
import { DestinationBar } from '@/send/DestinationBar';
import { destinationLabel } from '@/send/destination';
import { useDestination } from '@/send/useDestination';
import { useTheme } from '@/theme/ThemeProvider';

type Stage =
  | { kind: 'aiming' }
  | { kind: 'sending'; fraction: number }
  | { kind: 'sent'; where: string }
  | { kind: 'failed'; message: string };

export function Photos() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ kind: 'aiming' });
  const camera = useRef<CameraView | null>(null);

  // The church's live answer, the sender's override, and the rule between them.
  const where = useDestination();
  const destination = where.destination;

  async function capture() {
    const view = camera.current;
    if (!view || !destination) return;

    setStage({ kind: 'sending', fraction: 0 });
    try {
      const photo = await view.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!photo?.uri) throw new Error('The camera returned nothing to send.');

      await sendOnePhotograph(photo.uri, 'image/jpeg', destination, (fraction) =>
        setStage({ kind: 'sending', fraction }),
      );
      /*
       * The label is taken now rather than read off `destination` when the card
       * draws: somebody who sends one photograph and then changes the pill
       * before sending another must not see the confirmation for the first one
       * quietly rewrite itself.
       */
      setStage({ kind: 'sent', where: destinationLabel(destination) });
    } catch (error) {
      setStage({
        kind: 'failed',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'That photograph could not be sent.',
      });
    }
  }

  if (stage.kind === 'sent') {
    return (
      <Screen>
        <Card>
          <Label>SENT</Label>
          <Subheading>Thank you.</Subheading>
          <Body color={theme.color.inkSoft}>
            It has gone to {stage.where}. Somebody from the church looks at
            everything sent before it appears in the gallery.
          </Body>
          <View style={{ alignItems: 'flex-start', paddingTop: theme.space.xs }}>
            <Button label="Send another" tone="quiet" onPress={() => setStage({ kind: 'aiming' })} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (stage.kind === 'failed') {
    return (
      <Screen>
        <Card>
          <Label>NOT SENT</Label>
          <Body color={theme.color.inkSoft}>{stage.message}</Body>
          <View style={{ alignItems: 'flex-start', paddingTop: theme.space.xs }}>
            <Button label="Try again" onPress={() => setStage({ kind: 'aiming' })} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <Card>
          <Label>THE CAMERA</Label>
          <Body color={theme.color.inkSoft}>
            {permission?.canAskAgain === false
              ? 'The camera has been switched off for this app in Settings. Nothing can be photographed until it is switched back on.'
              : 'A photograph for the church needs the camera. Nothing is taken until you press the shutter.'}
          </Body>
          <View style={{ alignItems: 'flex-start', paddingTop: theme.space.xs }}>
            <Button
              label="Allow the camera"
              onPress={() => void requestPermission()}
              disabled={permission?.canAskAgain === false}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  const sending = stage.kind === 'sending';
  // Nothing to send to, or a settings document that has not landed yet. The
  // pill says which; the shutter is simply not offered in either case.
  const canSend = destination !== null && !sending;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.deep }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" mode="picture" />

      <View
        style={{
          padding: theme.space.gutter,
          gap: theme.space.sm,
          alignItems: 'center',
          backgroundColor: theme.color.deep,
        }}
      >
        {/*
         * The app's own pill and sheet, unforked. It says where a photograph
         * taken now would go, and opens the list of ministries and levels to
         * change it — which is the whole reason it is on screen rather than
         * being a setting: a photograph filed in the wrong place uploads,
         * succeeds, and is never noticed by the one person who knew better.
         */}
        <DestinationBar
          destination={where.destination}
          fallback={where.fallback}
          ready={where.ready}
          overridden={where.overridden}
          onChoose={where.choose}
          onRevert={where.revert}
        />

        {sending ? (
          <Label color={theme.color.inkInverse}>
            {`SENDING · ${Math.round(stage.fraction * 100)}%`}
          </Label>
        ) : null}

        {/*
         * A ring with a disc in it — the shutter every phone camera has had for
         * fifteen years, and the one control on this screen. Drawn rather than
         * borrowed from `send/Shutter.tsx`, which is a gesture-driven control
         * that also starts and stops video: a clip takes stills.
         */}
        <Pressable
          onPress={() => void capture()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Take a photograph and send it to the church"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={({ pressed }) => ({
            width: 78,
            height: 78,
            borderRadius: 39,
            borderWidth: 4,
            borderColor: theme.color.inkInverse,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: theme.color.inkInverse,
            }}
          />
        </Pressable>

        <Small color={theme.color.inkInverse}>
          {sending
            ? 'Keep this open until it finishes.'
            : destination
              ? 'One photograph, sent to the church.'
              : 'Nothing can be sent just now.'}
        </Small>
      </View>
    </View>
  );
}
