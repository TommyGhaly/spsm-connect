/**
 * /about/welcome-newcomers — the six stations of the festival tour.
 *
 * ---------------------------------------------------------------------------
 * The website's tour is walked by a visitor holding a phone in a crowded hall:
 * six stations, each a stack of disclosures, with a passport of stamps and a
 * QR code beside every station in the room. This screen is the same six
 * stations, the same words and the same passport.
 *
 * The disclosures are kept, and they are not decoration here either. Station 6
 * alone is twelve entries — five objects on the altar and the seven sacraments
 * — and a screen that opened with all of them expanded would be four thousand
 * words of scroll before station 1 ended.
 *
 * ## The passport, and how a stamp is collected
 *
 * Two ways, because neither alone is right. The **button** at the foot of a
 * station is for the reader who wants to say "done", and it is the only way
 * that works for somebody using VoiceOver, who may never scroll past anything.
 * The **tripwire** is for everyone else, because a visitor who has read a
 * station should not also have to report having read it.
 *
 * The web version's tripwire is an `IntersectionObserver` on a sentinel at the
 * end of each station. There is no such thing here, so the equivalent is
 * measured: every band reports its offset and height as it lays out, and a
 * station stamps once its foot has come up past the bottom fifth of the
 * screen. Same rule, same threshold — you have to have brought the end of a
 * station into view, so scrolling quickly past does not stamp it.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Body, Label, Small, Subheading, Title } from '@/components/Type';
import { Button } from '@/components/Surface';
import { Icon } from '@/components/Icon';
import {
  AboutSections,
  Aside,
  Band,
  Bands,
  Fold,
  Head,
  Hero,
  MoreOfAbout,
  Prose,
  Strip,
  type Ground,
} from './parts';
import { COPTIC_SEASONS, PASCHAL_PRAISE, transliterate } from './coptic';
import { usePassport, type Passport } from './passport';
import {
  HERO,
  STATIONS,
  TOUR_PICTURES,
  tourSmall,
  type Block,
  type Station,
} from './tour';
import { useTheme } from '@/theme/ThemeProvider';

/* ── The passport ────────────────────────────────────────────────────────── */

/**
 * The strip across the top: the count, the six stamps, and Reset.
 *
 * Pinned above the scroller rather than scrolling with the page, which is what
 * `position: sticky` buys it on the web — a visitor walking a hall wants to
 * see how many they have without scrolling back to the top.
 *
 * **Clearing it takes two presses.** The reward at the foot can clear in one,
 * because a reader has to have scrolled the whole tour to reach it. This
 * button sits an inch from six stamps for the entire visit, so a one-press
 * version is a thumb-slip that throws away five stations in a crowded hall.
 * The arming un-arms itself after a few seconds, so a passport is never left
 * one stray tap from empty.
 */
function PassportStrip({ passport }: { passport: Passport }) {
  const theme = useTheme();
  const { stamped, ready, count, reset } = passport;
  const [arming, setArming] = useState(false);

  useEffect(() => {
    if (!arming) return undefined;
    const timer = setTimeout(() => setArming(false), 4000);
    return () => clearTimeout(timer);
  }, [arming]);

  const clearable = ready && count > 0;

  return (
    <View
      style={{
        backgroundColor: theme.color.paperRaised,
        borderBottomColor: theme.color.rule,
        borderBottomWidth: 1,
        paddingHorizontal: theme.space.gutter,
        paddingVertical: theme.space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
      }}
    >
      <View style={{ gap: 2 }}>
        <Label>Passport</Label>
        {/*
          `ready` gates the number, not the strip. The six stamps render
          identically before and after storage is read — all unfilled — so the
          row never moves; only the count changes, and it changes in place.
        */}
        <Small color={theme.color.accent} accessibilityLiveRegion="polite">
          {ready ? `${count} of ${STATIONS.length}` : `— of ${STATIONS.length}`}
        </Small>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.xs, flex: 1 }}>
        {STATIONS.map((station) => {
          const done = ready && stamped.has(station.id);
          return (
            <View
              key={station.id}
              accessibilityLabel={`Station ${station.number}: ${station.title}${
                done ? ' — stamped' : ''
              }`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: done ? theme.color.accent : theme.color.rule,
                backgroundColor: done ? theme.color.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? (
                <Icon name="check" size={14} color={theme.color.inkInverse} />
              ) : (
                <Small color={theme.color.inkFaint}>{String(station.number)}</Small>
              )}
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          if (!arming) {
            setArming(true);
            return;
          }
          setArming(false);
          reset();
        }}
        disabled={!clearable}
        accessibilityRole="button"
        accessibilityLabel={
          arming ? `Press again to clear all ${count} stamps` : 'Start the passport over'
        }
        // The box stays whether or not there is anything to clear, so the six
        // stamps do not shift sideways under the reader's thumb the moment
        // storage lands.
        style={{ minHeight: 44, justifyContent: 'center', opacity: clearable ? 1 : 0.35 }}
      >
        <Small color={arming ? theme.color.accent : theme.color.inkSoft}>
          {arming ? 'Sure?' : 'Reset'}
        </Small>
      </Pressable>
    </View>
  );
}

/** The button at the foot of a station. The tripwire presses the same thing. */
function StampLine({ station, passport }: { station: string; passport: Passport }) {
  const theme = useTheme();
  const done = passport.ready && passport.stamped.has(station);

  return (
    <View style={{ paddingTop: theme.space.sm }}>
      <Button
        label={done ? 'Stamped' : 'Stamp this station'}
        tone={done ? 'quiet' : 'primary'}
        disabled={done}
        onPress={() => passport.stamp(station)}
      />
    </View>
  );
}

/**
 * What a full passport is worth.
 *
 * Shown only once all six are collected. The dessert stall wants to see a
 * screen, so this has to be the loudest thing on it and it has to say which
 * church and which offer without the visitor scrolling.
 */
function Reward({ passport }: { passport: Passport }) {
  const theme = useTheme();
  if (!passport.complete) return null;

  return (
    <Band ground="deep" gap={theme.space.sm}>
      <Label color={theme.color.gold}>All six stations</Label>
      <Title color={theme.color.inkInverse}>$2 off any dessert</Title>
      <Body color={theme.color.goldSoft}>
        Show this screen at the dessert table. One per passport, please.
      </Body>
      <Pressable
        onPress={passport.reset}
        accessibilityRole="button"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Small color={theme.color.gold}>Clear my passport</Small>
      </Pressable>
    </Band>
  );
}

/* ── The three widgets ───────────────────────────────────────────────────── */

/**
 * A visitor's name, spelled in Coptic letters.
 *
 * The one place in the five About pages that takes an input, and it writes
 * nothing anywhere: the name is state in this component and is gone when the
 * screen is. It is not a form and there is nothing to submit.
 *
 * The caveat under the box is load-bearing and is the website's, word for
 * word. This is a *transliteration* — letter for letter, sound for sound — and
 * a visitor handed "your name in Coptic" by a Coptic Orthodox church will
 * believe it. Being clear that a machine spelled it out phonetically is the
 * difference between a good activity and a small lie printed under the
 * church's name.
 */
function CopticName() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const written = transliterate(name.trim());

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label>Your name</Label>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Type a name"
        placeholderTextColor={theme.color.inkFaint}
        autoCapitalize="words"
        autoCorrect={false}
        accessibilityLabel="Your name, to spell in Coptic letters"
        style={{
          borderColor: theme.color.rule,
          borderWidth: 1,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space.md,
          minHeight: 44,
          color: theme.color.ink,
          fontFamily: theme.fontFamily.body,
          fontSize: theme.fontSize.body,
          backgroundColor: theme.color.paperRaised,
        }}
      />

      {/*
        The empty state is the Coptic for "your name", which is what the
        website shows before anything is typed — a box that is blank until you
        use it does not say what it is going to do.
      */}
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: theme.color.paperRaised,
          borderColor: theme.color.rule,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          padding: theme.space.md,
        }}
      >
        <Body color={written === '' ? theme.color.inkFaint : theme.color.ink}>
          {written === '' ? 'ⲡⲉⲕⲣⲁⲛ' : written}
        </Body>
      </View>

      <Small color={theme.color.inkFaint}>
        Letter for letter, by sound. This spells your name in the Coptic alphabet — it does not
        translate it, and it is not necessarily how the Church writes the name of a saint you may
        share it with.
      </Small>
    </View>
  );
}

/**
 * The Coptic year: three seasons of the Nile and the little month.
 *
 * A tab set, as on the website — four seasons across the top and the months
 * of the open one under them. Four stacked blocks would say the same words and
 * lose the one thing the widget is for: that the year *divides* into these
 * four, and you look at one at a time.
 */
function CopticYear() {
  const theme = useTheme();
  const [open, setOpen] = useState(0);
  const season = COPTIC_SEASONS[open] ?? COPTIC_SEASONS[0];
  if (!season) return null;

  return (
    <View style={{ gap: theme.space.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.xs, paddingRight: theme.space.gutter }}
      >
        {COPTIC_SEASONS.map((entry, at) => (
          <Pressable
            key={entry.name}
            onPress={() => setOpen(at)}
            accessibilityRole="tab"
            accessibilityState={{ selected: at === open }}
            style={{
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.xs,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: at === open ? theme.color.accent : theme.color.rule,
              backgroundColor: at === open ? theme.color.accentSoft : 'transparent',
              minHeight: 44,
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Small color={at === open ? theme.color.accent : theme.color.ink}>{entry.name}</Small>
            <Label>{entry.gloss}</Label>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ gap: 2 }}>
        <Body color={theme.color.accent}>{season.months.join(' · ')}</Body>
        <Small color={theme.color.inkSoft}>{season.note}</Small>
      </View>
    </View>
  );
}

/**
 * The Paschal praise: the transliteration, and the English under it.
 *
 * Two columns and not three. The Coptic column is absent on the website too —
 * setting liturgical text from memory is how a church publishes a misspelled
 * hymn under its own name, and a missing column is a smaller fault than a
 * wrong one. Fill `coptic` in `coptic.ts` from the church's service book and
 * the third line appears with no change here.
 *
 * No heading over it. The website prints the three lines and nothing else; the
 * sentence introducing it is the station's own prose.
 */
function Hymn() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {PASCHAL_PRAISE.map((line) => (
        <View key={line.english} style={{ gap: 2 }}>
          <Body>{line.transliteration}</Body>
          <Small color={theme.color.inkSoft}>{line.english}</Small>
        </View>
      ))}
    </View>
  );
}

/* ── A station's body ────────────────────────────────────────────────────── */

function Blocks({ blocks, ground }: { blocks: readonly Block[]; ground: Ground }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {blocks.map((block, at) => {
        switch (block.kind) {
          case 'prose':
            return <Prose key={at}>{block.paragraphs}</Prose>;

          case 'aside':
            return <Aside key={at}>{block.text}</Aside>;

          case 'quote':
            return (
              <View key={at} style={{ gap: theme.space.xs }}>
                <Label color={theme.color.accent}>{block.label}</Label>
                <View
                  style={{
                    borderLeftWidth: 2,
                    borderLeftColor: theme.color.gold,
                    paddingLeft: theme.space.md,
                    gap: theme.space.sm,
                  }}
                >
                  {block.paragraphs.map((paragraph) => (
                    <Body key={paragraph.slice(0, 24)} color={theme.color.inkSoft}>
                      {paragraph}
                    </Body>
                  ))}
                </View>
              </View>
            );

          case 'folds':
            return (
              <View key={at}>
                {block.entries.map((entry) => (
                  <Fold key={entry.label} label={entry.label} aside={entry.aside} ground={ground}>
                    <Prose>{entry.body}</Prose>
                    {entry.parts ? (
                      <View style={{ gap: theme.space.xs }}>
                        {entry.parts.map((part) => (
                          <View
                            key={part.term}
                            style={{ flexDirection: 'row', gap: theme.space.xs, flexWrap: 'wrap' }}
                          >
                            <Body>{part.term}</Body>
                            <Small color={theme.color.inkSoft}>{part.detail}</Small>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Fold>
                ))}
              </View>
            );

          case 'sides':
            return (
              <View key={at} style={{ gap: theme.space.md }}>
                {block.sides.map((side) => (
                  <View
                    key={side.label}
                    style={{
                      backgroundColor: theme.color.paperRaised,
                      borderColor: theme.color.rule,
                      borderWidth: 1,
                      borderRadius: theme.radius.md,
                      padding: theme.space.md,
                      gap: theme.space.xs,
                    }}
                  >
                    <Label color={theme.color.accent}>{side.label}</Label>
                    {side.items.map((item) => (
                      <Body key={item}>{item}</Body>
                    ))}
                  </View>
                ))}
              </View>
            );

          case 'steps':
            return (
              <View key={at} style={{ gap: theme.space.lg }}>
                {block.steps.map((step, index) => (
                  <View key={step.title} style={{ flexDirection: 'row', gap: theme.space.md }}>
                    <Label color={theme.color.accent}>{String(index + 1).padStart(2, '0')}</Label>
                    <View style={{ flex: 1, gap: theme.space.xs }}>
                      <Subheading>{step.title}</Subheading>
                      <Label>{step.service}</Label>
                      <Prose>{step.body}</Prose>
                    </View>
                  </View>
                ))}
              </View>
            );

          case 'hymn':
            return <Hymn key={at} />;

          case 'year':
            return <CopticYear key={at} />;

          case 'name':
            return <CopticName key={at} />;
        }
      })}
    </View>
  );
}

function StationBand({
  station,
  passport,
  onMeasure,
}: {
  station: Station;
  passport: Passport;
  onMeasure: (id: string, bottom: number) => void;
}) {
  const theme = useTheme();
  // Alternating grounds, so six long stations read as six things rather than
  // one scroll — the website's rule, and the same parity.
  const ground: Ground = station.number % 2 === 0 ? 'sunken' : 'paper';

  return (
    <Band
      ground={ground}
      gap={theme.space.lg}
      onLayout={(top, height) => onMeasure(station.id, top + height)}
    >
      {/*
        Only the title and the standfirst are slots. A station's *body* is a
        set of disclosures, a switcher, a hymn table and a stamp button, and a
        markdown box in its place would save cleanly and quietly delete the
        tour — which is why the website does not declare one either.
      */}
      {/*
        The eyebrow is drawn here rather than passed to `Head`, because it is
        not a slot: a station's number is generated from its place in the list
        and the website declares only `.h2` and `.lede` for these bands.
      */}
      <Label color={theme.color.accent}>{`Station ${station.number}`}</Label>
      <Head band={station.id} title={station.title} lede={station.lede} ground={ground} />

      {/*
        The pictures before the words, which is the website's mobile reading
        order too: a visitor standing at a station wants to see the thing being
        described before reading about it.
      */}
      <Strip
        // Every tile on the website carries "open larger"; `tour` is the 1280
        // file the lightbox opens.
        full={(source) => source.replace('-640.webp', '-1280.webp')}
        items={station.pictures.map((name) => ({
          source: tourSmall(name),
          meta: TOUR_PICTURES[name],
        }))}
      />

      {station.sections.map((section) => (
        <View key={section.title} style={{ gap: theme.space.sm }}>
          <Subheading>{section.title}</Subheading>
          <Blocks blocks={section.blocks} ground={ground} />
        </View>
      ))}

      <StampLine station={station.id} passport={passport} />
    </Band>
  );
}

export function TourScreen() {
  const passport = usePassport();
  const { stamp, resetSeq } = passport;

  /*
   * The tripwire's two pieces of geometry: where each station ends, and how
   * tall the scroller is. Refs rather than state — they change on layout and
   * on every scroll frame, and re-rendering six long stations to record a
   * number nothing draws would be the most expensive thing on this screen.
   */
  const bottoms = useRef<Record<string, number>>({});
  const viewport = useRef(0);
  const armed = useRef<Record<string, boolean>>({});

  /*
   * Disarmed by a reset, armed on first mount.
   *
   * Without this, pressing Reset while reading station 4 would stamp station 4
   * again before the reader's thumb was off the button, and the passport would
   * look broken. Leaving the screen is what re-arms a station; arriving at one
   * for the first time still stamps, because that is a first mount.
   */
  useEffect(() => {
    if (resetSeq === 0) return;
    armed.current = {};
  }, [resetSeq]);

  const onMeasure = useCallback((id: string, bottom: number) => {
    bottoms.current[id] = bottom;
  }, []);

  const onScroll = useCallback(
    (y: number) => {
      const height = viewport.current;
      if (height === 0) return;

      for (const station of STATIONS) {
        const bottom = bottoms.current[station.id];
        if (bottom === undefined) continue;

        // The website's `rootMargin: '0px 0px -20% 0px'`, in points: the foot
        // of the station has to have come up past the bottom fifth of the
        // screen, not merely peeked into it.
        const reached = y + height * 0.8 >= bottom;

        if (!reached) {
          armed.current[station.id] = true;
        } else if (armed.current[station.id]) {
          stamp(station.id);
        }
      }
    },
    [stamp],
  );

  return (
    <Bands
      header={<PassportStrip passport={passport} />}
      onScroll={onScroll}
      onViewport={(height) => {
        viewport.current = height;
      }}
    >
      <Hero band="tour-hero" eyebrow={HERO.eyebrow} title={HERO.title} lede={HERO.lede} />

      {STATIONS.map((station) => (
        <StationBand
          key={station.id}
          station={station}
          passport={passport}
          onMeasure={onMeasure}
        />
      ))}

      <Reward passport={passport} />

      <AboutSections />
      <MoreOfAbout current="welcome-newcomers" />
    </Bands>
  );
}
