/**
 * "Add photographs" — on the gallery you are looking at.
 *
 * ## Why it is here and not only on the camera tab
 *
 * Because the camera tab cannot know which day of camp you mean. Getting a
 * photograph to Day 3 used to be: leave the gallery, open the camera, open the
 * destination sheet, find Summercamp, expand it, find Day 3, and only then
 * pick. Tommy: *"if i go to a event group or subgroup I want the ability to add
 * pictures from there directly without needing to go back home."* Standing on
 * Day 3 already says which level it is — so the page says it, and nobody
 * re-states it through a tree.
 *
 * This is the website's shape too, and deliberately: a button at the top of the
 * gallery head that opens a panel, rather than a section under the pictures.
 * See the note at `SubmitPhotos`'s call site in `GalleryShell.tsx` — at the top
 * a section pushes the photographs down, at the bottom nobody sending
 * photographs can find it, and a button is the only thing small enough to sit
 * where it can be seen.
 *
 * ## This level, not the priority section
 *
 * `defaultSubmissionNode` puts `Program.prioritySubmissionNodeId` *above* the
 * page being looked at, and the website's form is right to: its level is a
 * `<select>` somebody can correct, so preselecting what the parish is
 * collecting for serves the common case. This button has no select and makes a
 * promise instead — press it on Week 1 · Day 3 and the photographs go to Week 1
 * · Day 3. Honouring the priority here would file them somewhere else while the
 * page and the button both said otherwise, and nothing on screen would admit
 * it. Somebody who wants the priority section has the camera tab, where that is
 * exactly what the pill already says.
 *
 * ## Two ways in, and only one of them lives here
 *
 * The library picker runs on this screen: the photographs already exist, the
 * system sheet is the whole interaction, and sending somebody to another tab to
 * do it would be the same round trip this component exists to delete.
 *
 * Taking one *now* hands off to the camera tab instead of opening
 * `expo-image-picker`'s camera. That is not laziness — `CameraScreen`'s header
 * argues the point: this app replaced exactly that modal because "two presses
 * and a modal" is longer than a child stands still at an altar. The viewfinder
 * opens already pointed at this level, via `handoff.ts`, so it costs one press
 * and nothing is re-chosen.
 */
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Close, Sheet } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Heading, Small } from '@/components/Type';
import { mayAdminProgramEvent } from '@/firebase/grants';
import { destinationLabel, type Destination } from '@/send/destination';
import { requestDestination } from '@/send/handoff';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { pickAndQueue, type PickOutcome } from '@/upload/pick';
import { useUploads } from '@/upload/useUploads';

import type { NodeRow, ProgramRow } from './data';

export function AddPictures({
  program,
  /** The level whose page this is, or null for the ministry's own page. */
  node,
}: {
  program: ProgramRow;
  node: NodeRow | null;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  /*
   * Nothing at all when the parish has stopped collecting, which is the
   * website's rule and the same flag: one `Program.submissionsOpen` for the
   * whole tree. An offer whose every submission `galleryUploadUrl` answers
   * `409 This gallery has stopped taking photographs` is an offer the app has
   * no business making.
   */
  if (!program.submissionsOpen) return null;

  /*
   * Where the photographs go, named the way the camera's pill names it so the
   * two screens cannot appear to disagree. `programEventId` legitimately holds
   * the program's own id on the ministry page — the documented state for
   * filing on the ministry rather than on a level — and `nodeTitle` is null in
   * exactly that case. See `Destination`.
   */
  const destination: Destination = {
    programId: program.id,
    programEventId: node?.id ?? program.id,
    programName: program.name,
    nodeTitle: node?.title ?? null,
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Add photographs to ${destinationLabel(destination)}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.xs,
          alignSelf: 'flex-start',
          minHeight: 44,
          paddingVertical: theme.space.xs,
          paddingHorizontal: theme.space.sm,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.color.rule,
          backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        })}
      >
        <Icon name="plus" color={theme.color.accent} size={16} />
        <Small color={theme.color.accent}>Add photographs</Small>
      </Pressable>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label="Add photographs"
        header={<Head destination={destination} onClose={() => setOpen(false)} />}
      >
        {/*
          Mounted with the sheet rather than kept alive behind it, so every
          opening starts with an empty outcome and there is no effect anywhere
          resetting one. Same reasoning as `DestinationSheet`.
        */}
        {open ? (
          <SheetBody destination={destination} onClose={() => setOpen(false)} />
        ) : null}
      </Sheet>
    </>
  );
}

/**
 * Pinned above the scroller, which is where the ✕ has to be.
 *
 * A refused batch can be a dozen lines of `condense`'s own words, and a way out
 * that has scrolled off the top is not a way out. Same reasoning, same shape as
 * `DestinationBar`'s `Head`.
 */
function Head({
  destination,
  onClose,
}: {
  destination: Destination;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Heading>Add photographs</Heading>
        <Small color={theme.color.inkSoft}>
          They will be filed under {destinationLabel(destination)}.
        </Small>
      </View>
      {/* Closable throughout: nothing here is staged, so there is nothing to
          lose. A queued batch is already durable in SQLite and goes on sending
          whether this sheet is open or not. */}
      <Close onPress={onClose} what="this panel" />
    </View>
  );
}

function SheetBody({
  destination,
  onClose,
}: {
  destination: Destination;
  onClose: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const grants = useGrants();

  const [picking, setPicking] = useState(false);
  const [outcome, setOutcome] = useState<PickOutcome | null>(null);

  /*
   * The same guard, for the same reason, as `CameraScreen.fromLibrary`:
   * `picking` is last render's answer and the system picker takes long enough
   * to open that a second press lands first. A double-queued batch is durable
   * — every photograph twice in a volunteer's review queue, deleted by hand.
   */
  const pickingRef = useRef(false);

  const fromLibrary = useCallback(async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;

    setPicking(true);
    try {
      const result = await pickAndQueue({
        programId: destination.programId,
        programEventId: destination.programEventId,
        /*
         * The higher video ceiling, for somebody who runs this ministry. It
         * decides what to *offer*; `galleryUploadUrl` decides the same thing
         * again from a verified token, so getting it wrong here costs a
         * refusal and never an upload nobody was entitled to.
         */
        isProgramAdmin: mayAdminProgramEvent(
          grants,
          destination.programId,
          destination.programEventId,
        ),
      });

      // Dismissing the picker is not an outcome worth a line of prose about
      // it. The sheet simply stays as it was, ready to be pressed again.
      if (!result.cancelled) setOutcome(result);
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }, [destination, grants]);

  const takeOne = useCallback(() => {
    /*
     * Ask, dismiss, then go — and the dismissal is not tidiness.
     *
     * A `Modal` is not part of the navigator's scene: it is presented over the
     * whole app, and the gallery screen it belongs to stays mounted behind the
     * camera rather than being torn down by the navigation. Left open, this
     * panel would still be sitting over the viewfinder on arrival, with its
     * own "Take photographs" button on top of the shutter.
     */
    requestDestination(destination);
    onClose();
    router.push('/');
  }, [destination, onClose, router]);

  return (
    <>
      <Button label="Take photographs" onPress={takeOne} />
      <Button
        label="Choose from the library"
        onPress={() => void fromLibrary()}
        tone="quiet"
        busy={picking}
      />

      {outcome ? <Outcome outcome={outcome} onClose={onClose} /> : null}

      <Small color={theme.color.inkSoft}>
        The church reviews photographs before anybody else sees them.
      </Small>
    </>
  );
}

/**
 * What happened to the batch — and it keeps saying so.
 *
 * ## Why "on their way" could not be the last word
 *
 * `pickAndQueue` returns as soon as every file is condensed and written to
 * SQLite. The sending happens afterwards, in a drain nobody awaits, so
 * `queued: 3` means *three rows are in the queue* and nothing whatever about
 * whether the church received them. This panel used to say "3 photographs are
 * on their way." and stop — which is how somebody ends up certain they have
 * sent photographs that were refused a second later. Tommy, from a phone: *"it
 * says the photos are on the way and doesn't say they are not working but it
 * never shows up."*
 *
 * The viewfinder never had that problem, because the pill at the top of it
 * reads the same queue continuously. A gallery page has no pill, so the honest
 * report has to live here: `useUploads` polls while anything is outstanding,
 * and the line below moves with it — sending, sent, or did not send, with the
 * way to the detail when it is the last of those.
 *
 * It reports the whole queue rather than only this batch, deliberately. The
 * rows are shared and the drain is sequential, so somebody who has just sent
 * three photographs wants to know that six are stuck, not that their three
 * reached a queue.
 *
 * The refusals are separate and are `condense`'s own words verbatim: those are
 * decided before anything is queued — a file too large, a type that is not a
 * photograph — and they name a number somebody can act on, which a paraphrase
 * would lose.
 */
function Outcome({ outcome, onClose }: { outcome: PickOutcome; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const uploads = useUploads();

  return (
    <View style={{ gap: theme.space.xs }}>
      {outcome.queued > 0 ? <Body>{sendingLine(outcome.queued, uploads)}</Body> : null}

      {/*
        Offered only when something has actually failed. The uploads screen is
        where a failure can be read and retried — and the rows are durable, so
        a photograph that failed while the church's App Check was misconfigured
        is still there to be sent once it is not.
      */}
      {uploads.failed > 0 ? (
        <Button
          label={`See what did not send (${uploads.failed})`}
          onPress={() => {
            onClose();
            router.push('/uploads');
          }}
          tone="quiet"
        />
      ) : null}

      {outcome.refused.map((refusal) => (
        <Small key={`${refusal.name}:${refusal.reason}`} color={theme.color.inkSoft}>
          {refusal.name} — {refusal.reason}
        </Small>
      ))}
    </View>
  );
}

/**
 * One sentence for where the queue has got to.
 *
 * `queued` is what this batch put in; everything else is read live. The
 * ordering is the point: a failure outranks progress, because it is the only
 * one of the three that asks anything of the person reading it.
 */
function sendingLine(queued: number, uploads: ReturnType<typeof useUploads>): string {
  const one = queued === 1;

  if (uploads.failed > 0) {
    return uploads.failed === 1
      ? 'One did not send.'
      : `${uploads.failed} did not send.`;
  }

  if (uploads.outstanding > 0) {
    return uploads.outstanding === 1 ? 'Sending one…' : `Sending ${uploads.outstanding}…`;
  }

  // Nothing outstanding and nothing failed: the drain finished them.
  return one
    ? 'Sent. The church has it, and will review it before anybody else sees it.'
    : `Sent. The church has all ${queued}, and will review them before anybody else sees them.`;
}
