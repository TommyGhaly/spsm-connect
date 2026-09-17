/**
 * /about/who-we-are — the history, from Alexandria to Rice Road.
 *
 * One story in three movements, which is how the website tells it: the Coptic
 * Orthodox Church in Egypt, the emigration to America, and this church. The
 * bands are in the website's order and carry the website's grounds, including
 * the one use of `tinted` — the nineteen centuries as a dated spine, which is
 * the thing a reader scrolling fast should find.
 *
 * **What this page does not do is argue.** Our Belief states the faith and
 * explains the councils; this one gives each council a line and a date and
 * links there.
 *
 * Nor does it end by inviting anybody. It ends on the six people who serve in
 * the room it has just described.
 *
 * The `band=` and `slot=` props are the website's own ids, from
 * `features/about/slots.ts` in that repo — see `overrides.tsx`.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Body, Label, Small } from '@/components/Type';
import {
  AboutSections,
  Band,
  Bands,
  Head,
  Hero,
  MoreOfAbout,
  Plate,
  Prose,
  Spine,
} from './parts';
import { textOf, useAboutSlots } from './overrides';
import { clergyPortrait, siteUrl } from './media';
import {
  CLERGY_HEAD,
  CROSSING,
  EGYPT,
  HERO,
  IN_EGYPT,
  IN_NEW_ENGLAND,
  MINORITY,
  NEW_ENGLAND,
  ORIGIN,
  ROSTER,
  SANCTUARY,
  THIS_CHURCH,
  WHO_PICTURES,
  clericInitial,
  who,
  type Cleric,
} from './who';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A cleric's photograph, or his initial.
 *
 * `alt=""` and hidden from the accessibility tree, because the name is
 * rendered beside it: a screen reader announcing both reads every father
 * twice. The circle is a fixed 64pt — smaller than the website's 136px, which
 * is sized for a three-column grid this screen does not have.
 *
 * `onError` is what makes the fallback real rather than theoretical. The
 * website lists its logo directory at build time and knows; this app cannot,
 * so it asks for the file and draws the initial if it does not come.
 */
function Portrait({ cleric }: { cleric: Cleric }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderColor: theme.color.gold,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.paperSunken,
        }}
      >
        <Body color={theme.color.gold}>{clericInitial(cleric.name)}</Body>
      </View>
    );
  }

  return (
    <Image
      source={clergyPortrait(cleric.slug)}
      alt=""
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.color.paperSunken,
      }}
    />
  );
}

export function WhoScreen() {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <Bands>
      <Hero band="who-hero" eyebrow={HERO.eyebrow} title={HERO.title} lede={HERO.lede} />

      <Band>
        <Head band="what-copt-means" title={ORIGIN.title} />
        <Prose slot="what-copt-means.body">{ORIGIN.body}</Prose>
        <Plate
          source={who('coptic-family')}
          meta={WHO_PICTURES['coptic-family']}
          slot="what-copt-means.picture"
          captionSlot="what-copt-means.cap-coptic-family"
        />
      </Band>

      <Band ground="tinted">
        <Head
          band="in-egypt"
          eyebrow={IN_EGYPT.eyebrow}
          title={IN_EGYPT.title}
          lede={IN_EGYPT.lede}
          ground="tinted"
        />
        <Spine moments={EGYPT} slotPrefix="in-egypt.moment" ground="tinted" />
        <Plate
          source={who('desert-monastery')}
          meta={WHO_PICTURES['desert-monastery']}
          captionSlot="in-egypt.cap-desert-monastery"
          ground="tinted"
        />
      </Band>

      <Band>
        <Head band="a-minority-at-home" title={MINORITY.title} />
        <Prose slot="a-minority-at-home.body">{MINORITY.body}</Prose>
        <Plate
          source={who('coptic-houses-cairo')}
          meta={WHO_PICTURES['coptic-houses-cairo']}
          slot="a-minority-at-home.picture"
          captionSlot="a-minority-at-home.cap-coptic-houses-cairo"
        />
        <Plate
          source={who('coptic-monks')}
          meta={WHO_PICTURES['coptic-monks']}
          captionSlot="a-minority-at-home.cap-coptic-monks"
        />
      </Band>

      <Band ground="sunken">
        <Head band="the-crossing" title={CROSSING.title} />
        <Prose slot="the-crossing.body">{CROSSING.body}</Prose>
        <Plate
          source={who('pope-kyrillos')}
          meta={WHO_PICTURES['pope-kyrillos']}
          slot="the-crossing.picture"
          captionSlot="the-crossing.cap-pope-kyrillos"
          ground="sunken"
        />
        <Prose slot="the-crossing.more">{CROSSING.more}</Prose>
        <Plate
          source={who('pope-shenouda')}
          meta={WHO_PICTURES['pope-shenouda']}
          slot="the-crossing.picture2"
          captionSlot="the-crossing.cap-pope-shenouda"
          ground="sunken"
        />
      </Band>

      <Band>
        <Head
          band="in-new-england"
          eyebrow={IN_NEW_ENGLAND.eyebrow}
          title={IN_NEW_ENGLAND.title}
          lede={IN_NEW_ENGLAND.lede}
        />
        <Plate
          source={who('queens-church')}
          meta={WHO_PICTURES['queens-church']}
          captionSlot="in-new-england.cap-queens-church"
        />
        <Spine moments={NEW_ENGLAND} slotPrefix="in-new-england.moment" />
      </Band>

      <Band ground="sunken">
        <Head band="this-church" title={THIS_CHURCH.title} />
        {/*
          The one photograph on these five pages that is of this church. It is
          not in `WHO_PICTURES` for the reason the website keeps it out of that
          set: those are Wikimedia plates with credits behind them, and this is
          the church's own room.
        */}
        <Plate
          source={siteUrl(SANCTUARY.src)}
          meta={SANCTUARY.meta}
          captionSlot="this-church.cap-sanctuary"
          ground="sunken"
        />
        <Prose slot="this-church.body">{THIS_CHURCH.body}</Prose>
      </Band>

      <Band>
        <Head
          band="the-clergy-here"
          eyebrow={CLERGY_HEAD.eyebrow}
          title={CLERGY_HEAD.title}
          lede={CLERGY_HEAD.lede}
        />

        <View style={{ gap: theme.space.md }}>
          {ROSTER.map((cleric) => (
            <View
              key={cleric.slug}
              style={{
                backgroundColor: theme.color.paperRaised,
                borderColor: theme.color.rule,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                padding: theme.space.md,
                gap: theme.space.xs,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Portrait cleric={cleric} />
              <View style={{ flex: 1, gap: 2 }}>
              <Body>{textOf(slots, `the-clergy-here.cleric-${cleric.slug}-name`, cleric.name)}</Body>
              <Label color={theme.color.accent}>
                {textOf(slots, `the-clergy-here.cleric-${cleric.slug}-rank`, cleric.rank)}
              </Label>
              <Small color={theme.color.inkSoft}>
                {textOf(slots, `the-clergy-here.cleric-${cleric.slug}-note`, cleric.note)}
              </Small>
              </View>
            </View>
          ))}
        </View>
      </Band>

      <AboutSections />
      <MoreOfAbout current="who-we-are" />
    </Bands>
  );
}
