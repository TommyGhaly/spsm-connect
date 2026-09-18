/**
 * What an administrator may do to a photograph that is already on the site.
 *
 * The queue decides submissions; this is the other half — housekeeping on
 * something that has been in the gallery for a week or for a year. Its three
 * acts are the website's `PictureManager` reduced to what a phone is actually
 * used for: fix the caption, move it to the right level, take it down.
 *
 * ## A button, not a long press
 *
 * The obvious mobile shape for "act on this item" is a long press, and it is
 * wrong here. A long press is invisible — nothing on the screen says it exists —
 * so the one person who needs it would have to be told, and everybody else
 * discovers it by accident while scrolling. Worse, this gallery is a column of
 * large photographs and a long press is what a finger does when it rests during
 * a scroll. So the affordance is drawn: a small round control in the corner of
 * each picture, and only for somebody who may use it.
 *
 * ## It appears on every level, and the queue does not
 *
 * The queue has to be one per ministry because a *list* of pending documents is
 * what `firestore.rules` can only prove ministry-wide. This has no such problem:
 * each act is a write to one document whose permission is checked on its own, so
 * the control belongs wherever the photograph is — which on a tree this deep is
 * usually a day of camp, four levels down, and never the ministry page.
 *
 * `mayAdminProgramEvent` is what gates it, so a volunteer holding one week gets
 * the tools on their own week's photographs and on nothing else. Note the one
 * asymmetry that follows from the rules and is not a bug: that volunteer can
 * move a photograph *out* of their week and cannot move it back, because an
 * update is checked against the level the photograph is on before the write. A
 * program grant, which is what these people are normally given, is unaffected.
 *
 * ## Deleting is the real one
 *
 * Taking a photograph down is not "hiding" it: the document is deleted and
 * `onGalleryMediaDeleted` removes the files from the bucket, including the
 * published copy under `galleries/` that no client may touch directly. It cannot
 * be undone and the person who sent it is not told. So it arms first, says so in
 * a sentence, and sits apart from Save.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { submissionTargets, type GalleryTree } from '@spsm/shared';

import { Close, Field, Picker, Problem, Sheet, type ChoiceOption } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { mayAdminProgramEvent } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import type { MediaRow, NodeRow, ProgramRow } from './data';
import { deleteMediaForever, editMedia } from './review';

export function PictureTools({
  media,
  program,
  tree,
  /** Re-read the page, so a moved or deleted photograph leaves this gallery. */
  onChanged,
}: {
  media: MediaRow;
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const grants = useGrants();
  const [open, setOpen] = useState(false);

  if (!mayAdminProgramEvent(grants, program.id, media.programEventId)) return null;

  return (
    <>
      {/*
        Over the top-right corner of the picture, which is the one region of a
        photograph that is least often the subject of it — and the corner a
        right thumb reaches without covering what it is deciding about.

        Its own scrim disc rather than a bare glyph: these sit on photographs,
        and a white icon on a white sky is not a button.
      */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={media.caption ? `Edit “${media.caption}”` : 'Edit this photograph'}
        hitSlop={theme.space.xs}
        style={({ pressed }) => ({
          position: 'absolute',
          top: theme.space.xs,
          right: theme.space.xs,
          width: 36,
          height: 36,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.color.accent : theme.color.deep,
          opacity: pressed ? 1 : 0.82,
        })}
      >
        <Icon name="pencil" size={18} color={theme.color.inkInverse} />
      </Pressable>

      {/*
        Mounted only while it is open, so its fields are seeded from the
        document every time rather than once: somebody else may have changed the
        caption between two openings, and a sheet that kept its first answer
        would quietly write the old one back.
      */}
      {open ? (
        <ToolSheet
          onClose={() => setOpen(false)}
          media={media}
          program={program}
          tree={tree}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}

function ToolSheet({
  onClose,
  media,
  program,
  tree,
  onChanged,
}: {
  onClose: () => void;
  media: MediaRow;
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  onChanged: () => void;
}) {
  const theme = useTheme();

  /*
   * Seeded from the document once, when the sheet is built, and left alone
   * afterwards. The page re-reads on every change, so a value pulled from
   * `media` on each render would overwrite what somebody is halfway through
   * typing the moment anything else on the screen moved.
   */
  const [caption, setCaption] = useState(media.caption);
  const [filing, setFiling] = useState(media.programEventId);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const targets = useMemo(
    (): ChoiceOption[] =>
      submissionTargets({ id: program.id, name: program.name }, tree).map((target) => ({
        value: target.id,
        label: `${'  '.repeat(Math.min(target.depth, 4))}${target.title}`,
        note: target.isProgram ? 'The ministry' : undefined,
      })),
    [program.id, program.name, tree],
  );

  const moved = filing !== media.programEventId;
  const recaptioned = caption.trim() !== media.caption.trim();

  const run = async (write: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      await write();
      onChanged();
      onClose();
    } catch (error) {
      console.error('[gallery] the photograph could not be changed:', error);
      setFailure(
        'That could not be saved. Either the connection, or this account no longer runs the level this photograph is filed on.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      label="This photograph"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>THIS PHOTOGRAPH</Label>
          </View>
          <Close onPress={onClose} what="this photograph" />
        </View>
      }
    >
      <View style={{ gap: theme.space.md }}>
        <Field
          label="Caption"
          value={caption}
          onChange={setCaption}
          placeholder="Optional — who or what this is"
          lines={2}
          autoCapitalize="sentences"
          hint="Shown under the photograph here and on the website, and read aloud to anybody using a screen reader."
        />

        <Picker
          label="Filed under"
          value={filing}
          options={targets}
          onChange={setFiling}
          hint="Moving it changes which page shows it — here and on the website."
        />

        {failure ? <Problem>{failure}</Problem> : null}

        <Button
          label="Save"
          busy={busy}
          disabled={!moved && !recaptioned}
          onPress={() => {
            void run(() =>
              editMedia(media.id, {
                ...(moved ? { programEventId: filing } : {}),
                ...(recaptioned ? { caption } : {}),
              }),
            );
          }}
        />

        {/*
          Below a rule and under its own heading, because it is not the other
          half of Save. Everything above this is a correction; this is the end
          of the photograph.
        */}
        <View
          style={{
            gap: theme.space.sm,
            borderTopWidth: 1,
            borderTopColor: theme.color.rule,
            paddingTop: theme.space.md,
          }}
        >
          <Label>Take it down</Label>
          {armed ? (
            <Problem>
              This deletes the photograph and its files for good — here, on the website, and out
              of the church&rsquo;s storage. It cannot be undone.
            </Problem>
          ) : (
            <Body color={theme.color.inkSoft}>
              Removing a photograph deletes it everywhere and cannot be undone.
            </Body>
          )}

          <Button
            label={armed ? 'Delete for good' : 'Remove from the gallery'}
            tone="danger"
            busy={busy}
            onPress={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              void run(() => deleteMediaForever(media.id));
            }}
          />

          {armed ? (
            <Pressable
              onPress={() => setArmed(false)}
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Small color={theme.color.inkSoft}>Keep it</Small>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
