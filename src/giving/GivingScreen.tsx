/**
 * Giving: the website's `/giving`, on a phone.
 *
 * ---------------------------------------------------------------------------
 * ## What this replaced, and why the old note no longer holds
 *
 * This screen was one card and one sentence — "the giving form opens in your
 * browser, so you can see the address you are typing your card into" — carried
 * over from `more.tsx` when giving became a tab. The concern behind it was
 * right and is kept; the screen built around it was not. The page that asks
 * something of somebody was the only one in the app with nothing to look
 * at, which is precisely the complaint that got the website's giving page
 * redesigned. See `open.ts` for how the address bar survives the redesign.
 *
 * ## Four bands, and each one is the website's
 *
 *   the hero        `GivingHero` — the dome and its cross, the offering verse,
 *                   and the one thing the page is for.
 *   scripture       ours. The website has no such band, and does not need one:
 *                   a laptop reader sees the whole page at once, where a phone
 *                   reader sees a band at a time and arrives at the second one
 *                   having already decided. See `verses.ts`.
 *   the appeal      the homepage's `Giving` band — the hands photograph, the
 *                   cheerful-giver verse, and the give action a second time,
 *                   which is where somebody who read rather than pressed has
 *                   ended up.
 *   the app         `GivingApps` — Tithe.ly's own app, for giving on a
 *                   schedule without this one.
 *
 * **What is deliberately absent is prose about where the money goes.** The
 * website had some and Tommy cut it as "unnecessary and inaccurate", and
 * nothing since has told us how the church receives an offering in person.
 * Anything that goes in here has to come from the church. The one sentence
 * about what the offering sustains is the homepage's own, verbatim.
 *
 * ## Bands rather than `Screen`
 *
 * `components/Surface`'s `Screen` puts the gutter on the whole page, and a band
 * has to reach both edges with its photograph and pad its own contents. The
 * About screens solved this already in `about/parts.tsx`; `Band` there is
 * twenty lines and slot-aware, and importing it would tie giving to the About
 * feature's copy machinery for the sake of a background colour. So this file
 * has its own, and they should be kept looking alike.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { siteUrl } from '@/about/media';
import { StoreBadges } from '@/components/StoreBadges';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Small, Subheading, Title } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { TITHELY_APP } from './config';
import { openGiving } from './open';
import { Verse } from './Verse';
import { CHEERFUL_VERSE, GIVING_VERSES, OFFERING_VERSE } from './verses';

/*
 * The website's own files, fetched rather than bundled, for the reason
 * `about/media.ts` gives at length: they are already emitted at two widths by
 * the Website repo's asset pipeline, and a copy in `assets/` here is a fork
 * that stays forked until somebody remembers it.
 *
 * `hero-giving-1600` is the *landscape* crop, where the web page hands a phone
 * the portrait one. The web's band is taller than it is wide on a phone and
 * this one is not — it is four short lines deep — so the portrait file's dome
 * and bells would arrive as a slice of dome. The landscape crop is cut to hold
 * "the cross and the whole dome and nothing below it", and the dome sits at 36%
 * across it, so a centre crop to this band's shape keeps the subject and throws
 * away sky. Re-aim it in `scripts/optimize-assets.mjs`, not here.
 */
const DOME = siteUrl('/img/hero-giving-1600.webp');
const HANDS = siteUrl('/img/backdrop-giving-1600.webp');
/* The Coptic cross inscribed Ⲓⲏⲥ Ⲡⲭⲥ / Ⲡ̀ϣⲏⲣⲓ ⲙ̀Ⲫϯ — "Jesus Christ, the Son of
   God" — which is the church's own, chosen by Tommy for the homepage. It opens
   the scripture band the way a cross opens a page of a lectionary. */
const CROSS = siteUrl('/img/cross-coptic-360.webp');

export function GivingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.space.xl }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Hero />
        <Scripture />
        <Appeal />
        <TheApp />
      </ScrollView>
    </View>
  );
}

/* ── The bands ───────────────────────────────────────────────────────────── */

/** A full-bleed section with a ground, padding its own contents. */
function Band({
  ground = 'paper',
  children,
  gap,
}: {
  ground?: 'paper' | 'sunken';
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
 * The same, with a photograph behind it.
 *
 * ## The veil is not decoration and its number is not taste
 *
 * The website draws two mirrored gradients here. React Native has no gradient
 * without another dependency, so this is one flat layer, and a flat layer has
 * to be as dark as the *weakest* point of that gradient needed to be — the
 * text is full width on a phone, so every line crosses the whole frame.
 *
 * 0.84 of `deep` is where the gold eyebrow clears 3:1 against the worst ground
 * in either photograph, which is the blown-out midday sky the cross stands in;
 * at the 0.72 that reads fine on a laptop it measures about 2.6:1. The
 * stylesheet takes the same trade in its narrow-screen rule and names it: "a
 * photograph nobody can read the page over is worth less than a dimmer one they
 * can."
 *
 * The hands photograph gets a little less, 0.82, and not the 0.78 the website
 * spends on it: the web band puts its text over the dark left half of that
 * frame, and a phone's column crosses the sunrise on the right as well.
 */
function PhotoBand({
  source,
  veil,
  children,
}: {
  source: string;
  veil: number;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ backgroundColor: theme.color.deep }}>
      {/*
        Hidden from a screen reader rather than described. It is the band's
        ground, the band says what it is about in text, and "a dome against the
        sky" read aloud before the heading is noise. The website's `alt=""` and
        `aria-hidden` say exactly this.

        Not lazy and given `priority="high"`: this is the first thing on the
        tab and the alternative is a flat oxblood rectangle that fills in a
        moment later.
      */}
      <Image
        source={source}
        contentFit="cover"
        contentPosition="center"
        transition={200}
        priority="high"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.color.deep,
          opacity: veil,
        }}
      />

      <View
        style={{
          paddingHorizontal: theme.space.gutter,
          paddingVertical: theme.space.xxl,
          gap: theme.space.sm,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

function Hero() {
  const theme = useTheme();

  return (
    <PhotoBand source={DOME} veil={0.84}>
      <Label color={theme.color.gold}>Offering</Label>
      {/* `Title`, not `Display`: the tab's header bar already says "Giving"
          two centimetres above this, and a display line under it is the same
          word twice at two sizes. The website's hero makes the same call. */}
      <Title color={theme.color.inkInverse}>Giving to the church</Title>

      <Verse verse={OFFERING_VERSE} on="deep" />

      <View style={{ paddingTop: theme.space.xs }}>
        <Button label="Give" onPress={() => openGiving(theme)} />
      </View>

      <Small color={theme.color.goldSoft}>
        Tithe.ly processes the payment. The church never sees your card details.
      </Small>
    </PhotoBand>
  );
}

/**
 * The scripture band.
 *
 * Sunken rather than plain paper, so that the three bands read as three things
 * on a scroll — the About screens alternate grounds for the same reason and it
 * matters more here, where the band above and the band below are both dark.
 */
function Scripture() {
  const theme = useTheme();

  return (
    <Band ground="sunken" gap={theme.space.lg}>
      <View style={{ gap: theme.space.xs, alignItems: 'center' }}>
        <Image
          source={CROSS}
          alt="The Coptic cross"
          contentFit="contain"
          transition={200}
          style={{ width: 40, height: 52 }}
        />
      </View>

      <View style={{ gap: theme.space.xs }}>
        <Label color={theme.color.accent}>Scripture</Label>
        <Heading>Why the church asks</Heading>
      </View>

      {GIVING_VERSES.map((verse) => (
        <Verse key={verse.reference} verse={verse} />
      ))}
    </Band>
  );
}

/**
 * The homepage's giving band, which is where a reader who scrolled rather than
 * pressed arrives — so the give action is here a second time rather than being
 * a scroll back to the top.
 */
function Appeal() {
  const theme = useTheme();

  return (
    <PhotoBand source={HANDS} veil={0.82}>
      <Heading color={theme.color.inkInverse}>Supporting the church</Heading>
      {/* The church's own sentence, from the homepage band, verbatim. It is the
          only thing on this screen that says what an offering is for, and it is
          the only such sentence anybody has approved. */}
      <Body color={theme.color.goldSoft}>
        What is offered here sustains the church, its services, and the poor.
      </Body>

      <Verse verse={CHEERFUL_VERSE} on="deep" />

      <View style={{ paddingTop: theme.space.xs }}>
        <Button label="Give online" onPress={() => openGiving(theme)} />
      </View>
    </PhotoBand>
  );
}

/**
 * Tithe.ly's app, at the foot of the screen.
 *
 * The same card the website shows, and it shows the icon and the publisher for
 * the reason that page gives: what is being asked of somebody is to go to a
 * store and find a blue app that is not named after this church, and the icon
 * and the publisher are how they know they have found it.
 *
 * The stores' own badges, as on the website. This card used to carry two
 * plainly labelled buttons instead, on the argument that a button which does
 * not use the vendors' artwork cannot misuse it — but the same two links are
 * shown on `/apps`, and two screens offering one app two different ways is the
 * drift these headers exist to prevent. `components/StoreBadges.tsx` now owns
 * both files and every rule about them, in one place, exactly as the website's
 * component does.
 *
 * Both stores are offered on both platforms, as on the website — somebody
 * holding an iPhone is quite often the person setting up a parent's Android.
 */
function TheApp() {
  const theme = useTheme();

  return (
    <Band>
      <View style={{ gap: theme.space.xs }}>
        <Label color={theme.color.accent}>The app</Label>
        <Heading>Giving from a phone</Heading>
      </View>

      <Card gap={theme.space.md}>
        <View style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'center' }}>
          <Image
            source={siteUrl(TITHELY_APP.icon)}
            alt={`The ${TITHELY_APP.name} app icon`}
            contentFit="cover"
            transition={200}
            style={{
              width: 64,
              height: 64,
              // `lg` and a hairline, matching the icon on `/apps` — the note
              // there says why an app icon is not rounded like a thumbnail.
              borderRadius: theme.radius.lg,
              borderColor: theme.color.rule,
              borderWidth: 1,
              backgroundColor: theme.color.paperSunken,
            }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Subheading>{TITHELY_APP.name}</Subheading>
            <Small color={theme.color.inkFaint}>by {TITHELY_APP.by}</Small>
          </View>
        </View>

        <Body color={theme.color.inkSoft}>{TITHELY_APP.what}</Body>

        <View style={{ height: 1, backgroundColor: theme.color.rule }} />

        <StoreBadges ios={TITHELY_APP.ios} android={TITHELY_APP.android} appName={TITHELY_APP.name} />
      </Card>
    </Band>
  );
}
