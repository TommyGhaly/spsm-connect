/**
 * Contact: the website's `/contact`, on a phone.
 *
 * ---------------------------------------------------------------------------
 * ## Four bands, in the website's order
 *
 *   our church        the address, the phone number, the email address, and the
 *                     map. One band rather than two stacked blocks, because they
 *                     are one statement — where the church is and how to reach
 *                     it — and the web page puts them side by side for that
 *                     reason. A phone has one column, so they stack; the heading
 *                     still covers both.
 *   the office        the `contact` form, which is an ordinary form definition.
 *                     See `ContactForm`.
 *   visiting          whatever prose the office has written in `notes` —
 *                     "where to park", "ring the side door". Absent until they
 *                     write some, which is why the grounds are counted rather
 *                     than written down.
 *   every week        the regular services. **The schedule closes the page**
 *                     rather than sitting between the address and the form, at
 *                     Tommy's direction on the website: somebody who wants
 *                     liturgy times has the calendar, somebody on Contact wants
 *                     the address or a way to write, and it makes a good last
 *                     word — it is the one block here with real colour in it.
 *
 * ## No title over the first band
 *
 * The website's `PageHeader` renders an `h1` and nothing visible — it is there
 * for the document outline and for search results. The app's equivalent is the
 * drawer's own header, which already says "Contact" on the way in, so the page
 * opens on the eyebrow exactly as the web page does.
 *
 * ## Bands rather than `Screen`
 *
 * `components/Surface`'s `Screen` puts the gutter on the whole page, and a band
 * has to reach both edges with its ground and pad its own contents. `Band` below
 * is the same twenty lines as the one in `GivingScreen`, and for the same reason
 * that one is not imported from `about/parts.tsx`: the About copy is slot-aware,
 * and tying Contact to that feature's copy machinery for the sake of a
 * background colour would be a strange dependency. Keep the three looking alike.
 * ---------------------------------------------------------------------------
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rich } from '@/about/Rich';
import { Heading, Label } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { ContactDetails } from './ContactDetails';
import { ContactForm } from './ContactForm';
import { ChurchMap } from './ChurchMap';
import { ServiceTimes } from './ServiceTimes';
import { useChurchConfig } from './config';

export function ContactScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, church } = useChurchConfig();

  /*
   * Off while a finger is on the map, and on the rest of the time. See
   * `ChurchMap` for why a live map inside a scroller cannot be panned without
   * this — the scroller cancels the touch it handed to the frame.
   */
  const [scrollable, setScrollable] = useState(true);

  /*
   * Grounds alternate, and the count has to be computed rather than written
   * down, because the "Visiting" band only exists on a church that has written
   * notes. Hardcoding `sunken` on the schedule would put two sunken bands back
   * to back the moment somebody fills that field in — and two bands of the same
   * ground with no seam between them read as one very tall section.
   */
  let count = 0;
  const ground = (): Ground => (count++ % 2 === 0 ? 'paper' : 'sunken');

  const notes = church.notes.trim();

  if (!ready) {
    /*
     * One Firestore read, usually a few hundred milliseconds. A spinner rather
     * than the page drawn from the parsed defaults, which are blank: those would
     * flash "contact details aren't published yet" at somebody whose church has
     * published them.
     */
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.paper,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      <ScrollView
        scrollEnabled={scrollable}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.space.xl }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        // The form lives in the second band, and a keyboard over the last field
        // is the ordinary state of this screen. A tap anywhere else should put it
        // away without also counting as a press on whatever was tapped.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Band ground={ground()}>
          <Head eyebrow="WAYLAND, MASSACHUSETTS" title="Our church" />
          <ContactDetails church={church} />
          <ChurchMap church={church} onPageScroll={setScrollable} />
        </Band>

        <Band ground={ground()}>
          <Head eyebrow="THE OFFICE" title="Write to the church office" />
          <ContactForm church={church} />
        </Band>

        {notes !== '' && (
          <Band ground={ground()}>
            <Head eyebrow="BEFORE YOU COME" title="Visiting" />
            {/*
              `notes` is markdown on the website, where a full renderer reads it.
              Here it goes through `Rich`, which is three forms and no parser —
              *italic*, **bold**, and a link — split into paragraphs on blank
              lines. Anything the office writes beyond that degrades to its own
              source text rather than to markup, which is the honest failure.
            */}
            {notes.split(/\n{2,}/).map((paragraph, at) => (
              <Rich key={at} color={theme.color.inkSoft}>
                {paragraph.trim()}
              </Rich>
            ))}
          </Band>
        )}

        <Band ground={ground()}>
          <Head eyebrow="EVERY WEEK" title="Regular services" />
          <ServiceTimes services={church.serviceTimes} />
        </Band>
      </ScrollView>
    </View>
  );
}

type Ground = 'paper' | 'sunken';

/** A full-bleed section with a ground, padding its own contents. */
function Band({
  ground = 'paper',
  children,
  gap,
}: {
  ground?: Ground;
  children: ReactNode;
  gap?: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: ground === 'sunken' ? theme.color.paperSunken : theme.color.paper,
        paddingHorizontal: theme.space.gutter,
        paddingVertical: theme.space.xl,
        gap: gap ?? theme.space.md,
      }}
    >
      {children}
    </View>
  );
}

/**
 * The eyebrow and the heading a band opens with — the website's
 * `SectionHeading`, minus the `id` it needs for `aria-labelledby`.
 *
 * The eyebrow is `accent` rather than the web's gold, which is what every other
 * section head in this app does on a paper ground (`about/parts.tsx`'s `Head`,
 * `AppsScreen`). Gold is reserved for the deep bands, where it has to lift off
 * the ground rather than sink into it — the same rule the website's stylesheet
 * keeps with `.band--deep .section-head__eyebrow`.
 */
function Head({ eyebrow, title }: { eyebrow: string; title: string }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label color={theme.color.accent}>{eyebrow}</Label>
      <Heading>{title}</Heading>
    </View>
  );
}
