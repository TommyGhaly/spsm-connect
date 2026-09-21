/**
 * An event's own page — the thing a parishioner reads.
 *
 * The website's `EventArticle`, and it answers a gap rather than adding a
 * feature: the church has authored these pages for years, the calendar has
 * linked to them for as long, and until now this app had nowhere for that link
 * to land. An occurrence built from the `events` collection carries
 * `href: '/events/christmas-festival'`, `EventSheet` offers it as "read more",
 * and the catch-all under `/events` resolved it against the *galleries*, found
 * no ministry with that slug, and said "No such gallery" — a working link to a
 * page that exists, reported as a dead one.
 *
 * ## Nothing at all until somebody presses Edit
 *
 * With editing off, whoever holds the parish calendar grant sees exactly what a
 * parishioner sees, apart from the one bar offering to edit. That is deliberate
 * and load-bearing: it is the only honest way to check how a page reads. The
 * editor is a separate module and the rest of the church never renders a line
 * of it.
 *
 * ## The one piece of state that has to live here
 *
 * `live`. This screen owns the row it draws, so the editor hands each saved row
 * back up as it writes — otherwise pressing Done would show the words that were
 * read when the page opened, and the edit would look lost.
 *
 * ## And it is kept live from Firestore, except while it is being edited
 *
 * The route reads this document once, to decide whether the address resolves to
 * an event at all. From then on `watchEvent` keeps it current, which is what
 * makes **the photograph** arrive: the hero is the thing most likely to be
 * changed from somewhere else — a browser, or another phone — and without a
 * subscription the person reading the page keeps the picture that was there when
 * they opened it.
 *
 * **The subscription is dropped while the editor is open**, and that is not a
 * detail. The editor autosaves, every save comes straight back as a snapshot,
 * and a snapshot applied into `live` under somebody's hands would reset the form
 * to the server's copy a second after each keystroke settled — cursor and all.
 * While `editing` is true the editor is the truth; `onSaved` is how its writes
 * reach this screen, and the watch resumes on Done with whatever the world has
 * by then.
 */
import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { formatEventWhen } from '@spsm/shared';

import { Rich } from '@/about/Rich';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Label, Micro, Small, Title } from '@/components/Type';
import { mayAdminScreen } from '@/firebase/grants';
import { storageUrl } from '@/gallery/media';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { watchEvent, type EventDoc } from './data';
import { EventEditor } from './EventEditor';

const HERO_HEIGHT = 200;

export function EventScreen({ event }: { event: EventDoc }) {
  const grants = useGrants();
  const [live, setLive] = useState<EventDoc>(event);
  const [editing, setEditing] = useState(false);

  const mayEdit = mayAdminScreen(grants, 'events');

  useEffect(() => {
    // See the header. The editor owns the document while it is open.
    if (editing) return undefined;

    return watchEvent(event.id, (fresh) => {
      /*
       * A null is the document having been deleted in a browser while this was
       * open, and the page keeps drawing what it last had rather than emptying
       * itself. There is nothing useful to put in its place — the route is what
       * says "no such thing", and it says it to somebody arriving, not to
       * somebody already reading.
       */
      if (fresh) setLive(fresh);
    });
    // `event.id` and not `event`: the route hands a fresh object on every
    // render, and the identity of the document is what this subscribes to.
  }, [event.id, editing]);

  return (
    <>
      {/*
        The live title, so renaming an event renames the screen under it as it
        is typed. The header is the one place the old name would otherwise
        survive the edit.
      */}
      <Stack.Screen options={{ title: live.title || 'Event' }} />

      <Screen>
        {mayEdit && !editing ? (
          <EditOffer onPress={() => setEditing(true)} />
        ) : null}

        {/*
          Keyed on the document id so that everything the editor holds — the
          form, the autosave bookkeeping, the photograph's state — is built
          fresh each time editing starts rather than reconciled against whatever
          was left over from the last session.
        */}
        {editing ? (
          <EventEditor
            key={live.id}
            event={live}
            onSaved={setLive}
            onDone={() => setEditing(false)}
          />
        ) : (
          <Article event={live} />
        )}
      </Screen>
    </>
  );
}

function Article({ event }: { event: EventDoc }) {
  const theme = useTheme();
  const shot = storageUrl(event.heroImagePath);

  /*
   * The body is markdown, as it is on the website, and `Rich` renders one
   * paragraph. Splitting on the blank line is what turns what somebody typed
   * back into the paragraphs they meant.
   *
   * The honest limit, the same one `about/overrides.ts` states: markdown this
   * app does not implement — a list, a heading, a table — arrives as literal
   * text. `Rich`'s header names the three forms it understands. Somebody who
   * types a bulleted list into an event will see their hyphens.
   */
  const paragraphs = useMemo(
    () =>
      event.body
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [event.body],
  );

  const when = formatEventWhen(event.startAt, event.endAt, event.allDay, event.timeZone);

  /*
   * Pulled off the document once, up here, because both are optional and both
   * are read twice below — once to decide whether to draw the row and once to
   * open it. `event.registration?.externalUrl` inline in an `onPress` narrows
   * to `string | undefined` all over again, which the handler then has to
   * coalesce, and a `?? ''` on a link is a way to open a blank page.
   */
  const registrationUrl = event.registration?.externalUrl ?? '';
  const meetingUrl = event.location?.meetingUrl ?? '';

  return (
    <>
      {shot ? (
        <Image
          source={{ uri: shot }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          contentFit="cover"
          style={{
            width: '100%',
            height: HERO_HEIGHT,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.paperSunken,
          }}
        />
      ) : null}

      <View style={{ gap: theme.space.xs }}>
        <Title>{event.title}</Title>
        {when ? <Small color={theme.color.inkSoft}>{when}</Small> : null}

        {event.location?.name ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <Icon name="pin" size={14} color={theme.color.inkFaint} />
            <Small color={theme.color.inkSoft}>
              {event.location.name}
              {event.location.address ? ` · ${event.location.address}` : ''}
            </Small>
          </View>
        ) : null}
      </View>

      {paragraphs.map((paragraph, index) => (
        /* The index is the key because a paragraph has no id and the same
           sentence can legitimately appear twice. Nothing reorders this list. */
        <Rich key={index}>{paragraph}</Rich>
      ))}

      {/*
        Opened in the in-app browser rather than handed to Safari: it comes back
        to the event, which is where the reader was. Only `registrationUrl` is
        offered — `registration.formId` points at the `forms` collection, and
        `data.ts` says why neither surface follows it yet.
      */}
      {registrationUrl ? (
        <Button
          label="Register for this event"
          onPress={() => void WebBrowser.openBrowserAsync(registrationUrl)}
        />
      ) : null}

      {/*
        The link for an event people join remotely, under the sign-up rather
        than beside it: one of them is the thing to do beforehand and the other
        is the thing to do on the day, and a row of two identical buttons does
        not say which is which.
      */}
      {meetingUrl ? (
        <View style={{ gap: theme.space.xs }}>
          <Label>JOINING ONLINE</Label>
          <Button
            label="Open the meeting link"
            tone="quiet"
            onPress={() => void WebBrowser.openBrowserAsync(meetingUrl)}
          />
        </View>
      ) : null}
    </>
  );
}

/**
 * The offer to edit, for whoever holds the parish calendar grant.
 *
 * A row at the top of the page rather than a pill floating over the corner of
 * it, which is what the website uses. `ManageBar` on the forms hub and the
 * shop's admin bar both took this shape and the argument is theirs: a phone
 * screen is narrow enough that anything floating covers the thing it is about,
 * and a bar at the top is read once on the way in and then ignored.
 *
 * It says what it is granting, because "Edit" on a public page is worth one
 * sentence: there is no draft, so the first keystroke is the parish's copy, on
 * the website as much as here.
 */
function EditOffer({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Card gap={theme.space.sm}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Label>PARISH CALENDAR</Label>
        </View>
        <Button label="Edit this page" tone="quiet" onPress={onPress} />
      </View>
      <Micro color={theme.color.inkSoft}>
        Typing is the save. There is no draft and no undo — what you write is on the website
        about a second later.
      </Micro>
    </Card>
  );
}
