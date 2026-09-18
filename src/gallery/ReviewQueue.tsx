/**
 * The photographs parishioners have sent, awaiting a decision — on a phone.
 *
 * The website's `SubmissionQueue` is a list: every pending item in a column,
 * each with its own controls, worked down the page with a bulk bar at the top.
 * That is the right shape for a desk and the wrong one for this app, and the
 * difference is not taste.
 *
 * **A phone has room for one photograph or for forty controls, never both.** The
 * decision being made here is "is this a picture the church should publish", and
 * it is made by *looking*. A list on a 390pt screen gives each row a thumbnail
 * the size of a stamp and puts Approve and Decline a thumb's width apart, which
 * is the one layout where an irreversible button is easy to hit by accident. So
 * this is a deck instead: one photograph as large as the screen allows, its
 * filing and its caption under it, and the decision at the bottom where a thumb
 * already is.
 *
 * The queue itself is the same queue. Same query, same live listener, same two
 * writes — see `review.ts`. Somebody clearing it from a pew and somebody
 * clearing it from the parish office are working the same list, and a
 * photograph decided by one vanishes from under the other.
 *
 * ## Who sees it, and where
 *
 * A ministry's own page — `/events/summercamp` — and only for somebody holding
 * that **program**. A volunteer given one level of it sees nothing here, which
 * looks like an oversight and is not: `firestore.rules` cannot prove a
 * ministry-wide list for an event-scoped grant, so serving them the queue would
 * mean a query per granted level, and what they would actually get today is a
 * screen that renders and then fails. The website makes exactly this trade and
 * for exactly this reason; the two must agree, because the same person uses
 * both.
 *
 * Deeper pages draw nothing. It is one queue per ministry, in one place, and a
 * copy of it on every day of camp would be four hundred listeners on a public
 * screen.
 *
 * ## Nothing here is armed by accident
 *
 * Approving is reversible — a photograph can be deleted afterwards. Declining is
 * not: it deletes the document, and `onGalleryMediaDeleted` takes the files with
 * it. So Decline takes two presses, says what it is about to do between them,
 * and is drawn as an outline rather than as the other half of a pair of buttons.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { submissionTargets, type GalleryTree } from '@spsm/shared';

import { Close, Field, Picker, Problem, Sheet, type ChoiceOption } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card } from '@/components/Surface';
import { Body, Label, Micro, Small } from '@/components/Type';
import { mayAdminProgram } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import type { NodeRow, ProgramRow } from './data';
import {
  approveInto,
  deleteMediaForever,
  reviewUrl,
  watchPendingForProgram,
  type PendingItem,
} from './review';

export function ReviewQueue({
  program,
  tree,
  /**
   * Re-read the page. An approved photograph belongs in the gallery above this
   * card and nothing here can draw it — at the moment of approval the file does
   * not exist yet, because the Function has not copied it into the public
   * bucket. A re-read a moment later is what makes it appear.
   */
  onDecided,
}: {
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  onDecided: () => void;
}) {
  const theme = useTheme();
  const grants = useGrants();
  const mayReview = mayAdminProgram(grants, program.id);

  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [refused, setRefused] = useState(false);
  const [open, setOpen] = useState(false);

  /*
   * The listener is opened only for somebody who may read it — a refused listen
   * still costs a round trip and logs a permission denial, and this is a public
   * page that strangers open.
   */
  useEffect(() => {
    if (!mayReview) return;

    return watchPendingForProgram(
      program.id,
      (next) => {
        setItems(next);
        setRefused(false);
      },
      (error) => {
        console.error('[gallery] the approval queue could not be watched:', error);
        setRefused(true);
      },
    );
  }, [mayReview, program.id]);

  if (!mayReview) return null;

  /*
   * A refusal is worth a line, because it is the one failure somebody here can
   * act on: it means the grant is not what they think it is. Everything else —
   * still connecting, nothing waiting — draws nothing at all, so a ministry
   * with an empty queue reads exactly as it does for a visitor.
   */
  if (refused) {
    return (
      <Card>
        <Label>The queue could not be opened</Label>
        <Body color={theme.color.inkSoft}>
          Photographs sent to {program.name} cannot be listed with this account. Running a
          ministry is given out one person at a time, on the church website at /access.
        </Body>
      </Card>
    );
  }

  if (items === null || items.length === 0) return null;

  const waiting = items.length;

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Icon name="photos" size={16} color={theme.color.accent} />
          <Label>Waiting for you</Label>
        </View>
        <Body color={theme.color.inkSoft}>
          {waiting === 1
            ? 'One photograph has been sent to this ministry and is not on the site yet.'
            : `${waiting} photographs have been sent to this ministry and are not on the site yet.`}
        </Body>
        <Button label={waiting === 1 ? 'Review it' : `Review all ${waiting}`} onPress={() => setOpen(true)} />
      </Card>

      {/*
        Mounted only while it is open. Everything the deck holds — what has been
        decided here, what was passed over, what somebody typed — is about one
        sitting at the queue, and carrying it to the next one would re-order a
        list that has moved on without it.
      */}
      {open ? (
        <ReviewDeck
          onClose={() => setOpen(false)}
          program={program}
          tree={tree}
          items={items}
          onDecided={onDecided}
        />
      ) : null}
    </>
  );
}

/**
 * One at a time, from the top of the queue.
 *
 * ## Why it holds ids rather than an index
 *
 * The list under this is a live listener. A photograph decided by somebody else
 * at the next table shortens it, and an index would then be pointing at a
 * different picture than the one on screen a moment ago — with an approval
 * already half-typed against it. Every piece of state here is keyed by media id
 * instead, so a list that changes underneath moves the deck along rather than
 * re-aiming it.
 *
 * ## The edits are intentions until they are written
 *
 * `edits` holds every re-filing and every caption anybody has typed on this
 * screen, and nothing here writes one on its own. Close the sheet and they are
 * gone — the choice was an intention, and only approving turns it into a fact.
 * That is the website's rule too, and it is what makes it safe to flick through
 * the queue changing your mind.
 */
function ReviewDeck({
  onClose,
  program,
  tree,
  items,
  onDecided,
}: {
  onClose: () => void;
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  items: readonly PendingItem[];
  onDecided: () => void;
}) {
  const theme = useTheme();

  /** Decided here. The listener catches up a moment later; this is immediate. */
  const [done, setDone] = useState<ReadonlySet<string>>(EMPTY);
  /** Passed over for now. Sent to the back rather than removed. */
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(EMPTY);
  const [edits, setEdits] = useState<Readonly<Record<string, Edit>>>(EMPTY_EDITS);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const queue = useMemo(() => {
    const live = items.filter((item) => !done.has(item.id));
    // Skipped ones go to the back rather than out of the list: "not now" is not
    // a decision, and a queue that loses them would strand exactly the
    // photographs somebody was unsure about.
    return [
      ...live.filter((item) => !skipped.has(item.id)),
      ...live.filter((item) => skipped.has(item.id)),
    ];
  }, [items, done, skipped]);

  const current = queue[0] ?? null;
  const edit = current ? edits[current.id] : undefined;
  const filing = edit?.programEventId ?? current?.programEventId ?? '';
  const caption = edit?.caption ?? current?.caption ?? '';

  const targets = useMemo((): ChoiceOption[] =>
    submissionTargets({ id: program.id, name: program.name }, tree).map((target) => ({
      value: target.id,
      /*
       * Indented with figure spaces so the list reads as the tree it came from.
       * A phone's option row has no room for a rail and a chevron, and "Day 3"
       * on its own in a list of four weeks says nothing about which week.
       */
      label: `${'  '.repeat(Math.min(target.depth, 4))}${target.title}`,
      note: target.isProgram ? 'The ministry' : undefined,
    })),
    [program.id, program.name, tree],
  );

  const change = (id: string, next: Edit): void =>
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...next } }));

  const decide = async (item: PendingItem, run: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      await run();
      setDone((all) => new Set(all).add(item.id));
      setArmed(null);
      onDecided();
    } catch (error) {
      console.error('[gallery] the decision could not be written:', error);
      setFailure('That could not be saved. The connection, or this account no longer runs this ministry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      label="Photographs waiting for approval"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>WAITING FOR APPROVAL</Label>
            {queue.length > 0 ? (
              <Micro color={theme.color.inkFaint}>
                {queue.length === 1 ? 'One left' : `${queue.length} left`}
              </Micro>
            ) : null}
          </View>
          <Close onPress={onClose} what="the queue" />
        </View>
      }
    >
      {current === null ? (
        <View style={{ gap: theme.space.sm, paddingVertical: theme.space.lg }}>
          <Label>That is the lot</Label>
          <Body color={theme.color.inkSoft}>
            Nothing is waiting for {program.name}. Approved photographs appear in the gallery
            once the church&rsquo;s copy of them has been made, which takes a moment.
          </Body>
          <Button label="Close" onPress={onClose} tone="quiet" />
        </View>
      ) : (
        <View style={{ gap: theme.space.md }}>
          <Preview item={current} />

          <Picker
            label="Filed under"
            value={filing}
            options={targets}
            onChange={(next) => change(current.id, { programEventId: next })}
            hint="Where it will appear. The sender chose this; correct it if they were wrong."
          />

          <Field
            label="Caption"
            value={caption}
            onChange={(next) => change(current.id, { caption: next })}
            placeholder="Optional — who or what this is"
            lines={2}
            autoCapitalize="sentences"
            hint="Shown under the photograph, and read aloud to anybody using a screen reader."
          />

          {failure ? <Problem>{failure}</Problem> : null}

          {armed === current.id ? (
            <Problem>
              This deletes the photograph and its files for good. It cannot be undone, and the
              person who sent it is not told.
            </Problem>
          ) : null}

          <View style={{ gap: theme.space.sm }}>
            <Button
              label="Approve"
              busy={busy}
              onPress={() => {
                void decide(current, () =>
                  approveInto(
                    current.id,
                    filing || current.programEventId,
                    // Only when it was touched, so approving cannot blank one
                    // that was already on the document.
                    edits[current.id]?.caption === undefined ? null : caption,
                  ),
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              {queue.length > 1 ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label="Not now"
                    tone="quiet"
                    disabled={busy}
                    onPress={() => {
                      setArmed(null);
                      setSkipped((all) => new Set(all).add(current.id));
                    }}
                  />
                </View>
              ) : null}

              <View style={{ flex: 1 }}>
                <Button
                  label={armed === current.id ? 'Delete for good' : 'Decline'}
                  tone="danger"
                  busy={busy}
                  onPress={() => {
                    if (armed !== current.id) {
                      setArmed(current.id);
                      return;
                    }
                    void decide(current, () => deleteMediaForever(current.id));
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

/** A re-filing and a caption somebody typed here, neither of them written yet. */
interface Edit {
  programEventId?: string;
  caption?: string;
}

const EMPTY: ReadonlySet<string> = new Set();
const EMPTY_EDITS: Readonly<Record<string, Edit>> = {};

/**
 * The photograph, as large as the sheet will allow.
 *
 * `contentFit: 'contain'` rather than the gallery's crop, because this is the
 * one place the *whole* frame matters: an administrator is deciding whether a
 * picture is publishable, and a crop can hide exactly the thing that makes it
 * not. It is drawn on sunken paper so a photograph with white edges still has a
 * shape on screen.
 *
 * The URL is fetched with credentials and is the only image in this app that is
 * — see `reviewUrl`. It is also short-lived enough not to be worth caching, so
 * `expo-image` is pointed at a plain string and left to its own memory cache.
 */
function Preview({ item }: { item: PendingItem }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  /*
   * Keyed by the media id, for the same reason the trail screen keys its own
   * state: a URL that arrives for the photograph that *was* on screen must not
   * be drawn against the one that is. `undefined` is "still asking", which is a
   * different picture from "there is nothing to show".
   */
  const [got, setGot] = useState<{ for: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void reviewUrl(item).then((url) => {
      if (!cancelled) setGot({ for: item.id, url });
    });

    return () => {
      cancelled = true;
    };
    // The identity of the document, not the object: a snapshot rebuilds every
    // row on every change, and depending on `item` would refetch the URL of the
    // photograph on screen each time somebody else decided a different one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.previewPath, item.sourcePath]);

  // Tall enough to judge a photograph by, short enough that the filing, the
  // caption and the buttons are all still on screen under it without a scroll.
  const box = Math.round(height * 0.42);
  const url = got?.for === item.id ? got.url : undefined;

  const frame = {
    height: box,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.paperSunken,
    borderWidth: 1,
    borderColor: theme.color.rule,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    overflow: 'hidden',
  } as const;

  if (item.kind === 'video') {
    return (
      <View style={frame}>
        <Icon name="film" size={28} color={theme.color.inkFaint} />
        <Small color={theme.color.inkSoft}>A video clip</Small>
        {/* Honest rather than reassuring: nothing transcodes a video before
            approval, so there is genuinely nothing to look at here and the
            decision is being made on where it came from. */}
        <Micro color={theme.color.inkFaint}>It cannot be played until it is approved</Micro>
      </View>
    );
  }

  if (url === undefined) {
    return (
      <View style={frame}>
        <ActivityIndicator color={theme.color.inkFaint} />
      </View>
    );
  }

  if (url === null) {
    return (
      <View style={frame}>
        <Icon name="photos" size={28} color={theme.color.inkFaint} />
        <Small color={theme.color.inkSoft}>Still being prepared</Small>
        <Micro color={theme.color.inkFaint}>Come back to this one in a moment</Micro>
      </View>
    );
  }

  return (
    <View style={frame}>
      <Image
        source={url}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        transition={120}
        accessibilityLabel="The photograph being reviewed"
      />
    </View>
  );
}
