/**
 * One thing on one day.
 *
 * The website's `.sched-entry`, point for point, which is also what the App
 * Clip's `EntryRow` draws — the reader who tapped the tag in the narthex and
 * then opened the app should see the same row in both:
 *
 * - **A 3pt rule down the left in the kind's colour**, dashed in the faint ink
 *   for a servants entry (a marking on top of a kind, not a kind of its own).
 * - **The time in a fixed column, right-aligned**, so a day scans down its
 *   left edge. The start is semibold in `color-mix(tone 55%, ink)` — the tone at
 *   full strength fails contrast at this size, gold on cream measured about
 *   2.9:1 — with "until" and the end beneath it, small and faint, only when
 *   there is an end that says something the start did not.
 * - **The title**, in the app's own face like every other screen — the
 *   church's serif read as pasted on next to the system's tab bar — and
 *   location, note and contact after it on one faint line each.
 * - **The bulletin's picture at its own shape** in a fixed box at the end.
 *
 * Text on the card rather than a card per row: the day card is the ground, and
 * the rule is what separates one service from the next.
 *
 * ## The whole row is the control here, and on the website only the title is
 *
 * That is not drift. A row can contain a telephone number, and on the web a
 * link inside a button is invalid HTML that browsers unnest — so the row could
 * not be the control. React Native has no such rule: a nested `Pressable`
 * simply wins the touch it is under, so the contact stays dialable inside a row
 * that is itself pressable. On a phone the larger target is worth having.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { formatClock, kindOf, type CalendarOccurrence } from '@spsm/shared';

import { useTheme } from '@/theme/ThemeProvider';

import { mix } from './mix';
import { tintFor } from './kinds';

/** The time column: the website's 5rem at phone width. */
const WHEN_WIDTH = 70;

/**
 * The picture's box. Fixed, so the times line up down a day and a tall icon
 * cannot make its row tall; 48 is no taller than a two-line title, and big
 * enough that a wide flyer fitted into it still reads as a picture.
 */
export const THUMB = 48;

export function Entry({
  occurrence,
  onOpen,
  thumb = THUMB,
}: {
  occurrence: CalendarOccurrence;
  onOpen: () => void;
  /**
   * The picture's box. Larger in the month's day sheet, which has the full
   * width and no neighbouring day to keep level with — the website's
   * `.sched-daysheet .sched-entry__thumb`.
   */
  thumb?: number;
}) {
  const theme = useTheme();
  // Through `kindOf`, never off `.kind` directly — it is null for everything
  // read from Breeze or the bulletin, where the title is all there is.
  const kind = kindOf(occurrence);
  const tone = tintFor(kind, theme);
  const timeTone = mix(tone, theme.color.ink, 0.55);
  const servants = occurrence.source === 'servants';

  const aside = [occurrence.location, occurrence.description].filter((part) => part !== '');
  const hasEnd =
    !occurrence.allDay && occurrence.endTime && occurrence.endTime !== occurrence.startTime;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${occurrence.title}, ${whenLabel(occurrence)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        // `.sched-entry:hover` — the row's own tone at 7%, enough to say which
        // one the thumb is on and not enough to be a highlight.
        backgroundColor: pressed ? mix(tone, theme.color.paperRaised, 0.07) : 'transparent',
        borderTopRightRadius: theme.radius.sm,
        borderBottomRightRadius: theme.radius.sm,
      })}
    >
      {/* A border on a zero-width view rather than the row's own left border:
          that is the one way to get a dashed edge on a single side. */}
      <View
        style={{
          width: 0,
          alignSelf: 'stretch',
          borderLeftWidth: 3,
          borderLeftColor: servants ? theme.color.inkFaint : tone,
          borderStyle: servants ? 'dashed' : 'solid',
        }}
      />

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.space.sm,
          paddingVertical: 5,
          paddingLeft: theme.space.sm,
          paddingRight: 4,
        }}
      >
        <View style={{ width: WHEN_WIDTH, alignItems: 'flex-end', paddingTop: 2 }}>
          {occurrence.allDay ? (
            <Text
              style={{
                fontSize: theme.fontSize.micro,
                fontWeight: '600',
                letterSpacing: 0.8,
                color: timeTone,
              }}
            >
              ALL DAY
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
                color: timeTone,
              }}
            >
              {formatClock(occurrence.startTime)}
            </Text>
          )}
          {hasEnd ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontSize: 11, fontVariant: ['tabular-nums'], color: theme.color.inkFaint }}
            >
              until {formatClock(occurrence.endTime!)}
            </Text>
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: theme.fontFamily.body,
              fontSize: 16,
              lineHeight: 21,
              color: theme.color.ink,
            }}
          >
            {occurrence.title}
          </Text>

          {servants || occurrence.source === 'manual' ? (
            <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
              {servants ? <Tag label="Servants" /> : null}
              {occurrence.source === 'manual' ? <Tag label="Added" /> : null}
            </View>
          ) : null}

          {aside.length > 0 ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: theme.fontSize.micro, color: theme.color.inkFaint }}
            >
              {aside.join(' · ')}
            </Text>
          ) : null}
          {occurrence.contact ? <Contact contact={occurrence.contact} /> : null}
        </View>

        {occurrence.imageUrl ? <Thumb url={occurrence.imageUrl} box={thumb} /> : null}
      </View>
    </Pressable>
  );
}

/** What a screen reader hears before the title, so the row reads as a plan. */
function whenLabel(occurrence: CalendarOccurrence): string {
  if (occurrence.allDay) return 'all day';
  const start = formatClock(occurrence.startTime);
  const end =
    occurrence.endTime && occurrence.endTime !== occurrence.startTime
      ? ` until ${formatClock(occurrence.endTime)}`
      : '';
  return `${start}${end}`;
}

/** `.sched-entry__tag`: small capitals on a solid azure, as the website's. */
function Tag({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.color.azure,
        borderRadius: theme.radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.6,
          color: theme.color.inkInverse,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** "Servant Michael · (774) 573-…", with the number dialable. */
function Contact({ contact }: { contact: string }) {
  const theme = useTheme();
  const [name, phone] = contact.split(' · ');
  const faint = { fontSize: theme.fontSize.micro, color: theme.color.inkFaint };

  if (!phone) {
    return (
      <Text numberOfLines={1} style={faint}>
        {contact}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
      <Text numberOfLines={1} style={[faint, { flexShrink: 1 }]}>
        {name} ·{' '}
      </Text>
      <Pressable
        // Stripped to digits for the dialler, printed as the church wrote it.
        onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
        accessibilityRole="button"
        accessibilityLabel={`Call ${name ?? ''} on ${phone}`}
        hitSlop={theme.space.xs}
      >
        <Text numberOfLines={1} style={[faint, { color: theme.color.accent }]}>
          {phone}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The bulletin's picture, at its own shape, in a fixed box.
 *
 * `contentFit="contain"` alone would letterbox the picture inside a bordered
 * square, so the hairline and the corners would trace an invisible box rather
 * than the picture. Instead the picture is sized from its own aspect ratio once
 * it loads, and the border sits on it — the website's `.week__thumb img`.
 *
 * Nothing at all if it will not load: a grey box reads as the screen having
 * failed rather than as an entry with no picture.
 */
function Thumb({ url, box }: { url: string; box: number }) {
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  if (broken) return null;

  const width = ratio === null ? box : ratio >= 1 ? box : box * ratio;
  const height = ratio === null ? box : ratio >= 1 ? box / ratio : box;

  return (
    <View
      style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={{ uri: url }}
        onLoad={(event) => {
          const { width: w, height: h } = event.source;
          if (w > 0 && h > 0) setRatio(w / h);
        }}
        onError={() => setBroken(true)}
        contentFit="contain"
        style={{
          width,
          height,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: mix(theme.color.ink, theme.color.paperRaised, 0.12),
          backgroundColor: ratio === null ? theme.color.paperSunken : 'transparent',
        }}
      />
    </View>
  );
}
