/**
 * /about/our-belief — the Creed, and what it means.
 *
 * The shape of the page is the website's, and so is the reason for it:
 *
 *   1. A short opening band. The point of this page is the Creed, and a hero
 *      that fills the screen pushes it below the fold.
 *   2. Why the Church has dogma at all, before any of it is stated.
 *   3. **The Creed itself**, high up, whole, quoted rather than summarised.
 *   4. Where it came from: Arius, Nicaea, Constantinople, Ephesus.
 *   5. The Creed again, clause by clause, with what each clause means.
 *   6. Whose confession this is — the See of St. Mark, and Chalcedon.
 *
 * The Creed sits on `tinted`, the third ground, used nowhere else here: it is
 * the one thing on this page a reader might have come for, and it should be
 * findable by scrolling past everything else at speed.
 */
import { Text, View } from 'react-native';

import { Body, Label, Lede } from '@/components/Type';
import { lineHeightFor } from '@/theme/tokens';
import {
  AboutSections,
  Aside,
  Band,
  Bands,
  Head,
  Hero,
  MoreOfAbout,
  Plate,
  Prose,
} from './parts';
import { textOf, useAboutSlots } from './overrides';
import {
  ARTICLES,
  BELIEF_PICTURES,
  COUNCILS,
  CREED,
  CREED_HEAD,
  HERO,
  LINE_BY_LINE,
  OPENING,
  THE_SEE,
  belief,
} from './belief';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The Creed, set as verse.
 *
 * One `Text` per line rather than one per stanza with newlines in it. The
 * breaks are content — the Creed is said in breaths, and the breaks are where
 * the church breathes — so each one is a box the layout cannot collapse.
 *
 * **Not overridable, and that is deliberate on both ends.** The website
 * computes a slot id per line and then does not put them in `ABOUT_BANDS`;
 * its comment beside that omission is the clearest statement of the rule in
 * the whole manifest — *it is the text of the whole Church, said aloud at
 * every Liturgy, and a typo introduced here would be said aloud with it.* A
 * slot the manifest does not declare cannot be written by anything, so reading
 * one here would be a lookup that can only ever miss, and would suggest the
 * Creed is editable when it is not. These lines come from `creed.ts` and
 * nowhere else.
 *
 * The website distinguishes a line the Church breaks from a line a narrow
 * screen breaks with a hanging indent. React Native has no `text-indent` and
 * no way to style the wrapped remainder of a line differently from its start,
 * so that distinction is not available here and is not faked: a line is set in
 * the display face against the body face the commentary uses, and a wrapped
 * remainder simply continues. On a phone in portrait most of these do not wrap.
 */
function Creed() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {CREED.map((stanza) => (
        <View key={stanza.about} style={{ gap: 2 }}>
          {stanza.lines.map((line, at) => (
            <Text
              key={line}
              style={{
                color: theme.color.ink,
                fontFamily: theme.fontFamily.display,
                fontSize: theme.fontSize.body,
                lineHeight: lineHeightFor(theme, 'body', 'snug'),
              }}
            >
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function BeliefScreen() {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <Bands>
      <Hero band="belief-hero" eyebrow={HERO.eyebrow} title={HERO.title} lede={HERO.lede} />

      <Band>
        <View style={{ gap: 2 }}>
          {/*
            The Latin and its gloss are one heading on the website, not a
            heading with a caption under it, and they are kept that way here.
            Neither is a slot over there — `the-faith` declares only its body
            and its photograph — so no band id is passed and nothing is looked
            up for them.
          */}
          <Head title={OPENING.title} />
          <Lede color={theme.color.inkSoft}>{OPENING.gloss}</Lede>
        </View>
        <Prose slot="the-faith.body">{OPENING.body}</Prose>
        <Plate
          source={belief('wadi-natrun-frescos')}
          meta={BELIEF_PICTURES['wadi-natrun-frescos']}
          slot="the-faith.picture"
          captionSlot="the-faith.cap-wadi-natrun-frescos"
        />
      </Band>

      <Band ground="tinted">
        <Head
          band="the-creed"
          eyebrow={CREED_HEAD.eyebrow}
          title={CREED_HEAD.title}
          lede={CREED_HEAD.lede}
          ground="tinted"
        />
        <Creed />
        <Aside slot="the-creed.note">{CREED_HEAD.note}</Aside>
        <Plate
          source={belief('council-of-nicaea')}
          meta={BELIEF_PICTURES['council-of-nicaea']}
          captionSlot="the-creed.cap-council-of-nicaea"
          ground="tinted"
        />
      </Band>

      <Band>
        <Head band="the-councils" title={COUNCILS.title} />
        <Prose slot="the-councils.body">{COUNCILS.body}</Prose>
        <Plate
          source={belief('alexandrian-fathers')}
          meta={BELIEF_PICTURES['alexandrian-fathers']}
          captionSlot="the-councils.cap-alexandrian-fathers"
        />
      </Band>

      <Band ground="sunken" gap={theme.space.xl}>
        <Head
          band="line-by-line"
          title={LINE_BY_LINE.title}
          lede={LINE_BY_LINE.lede}
          ground="sunken"
        />

        {ARTICLES.map((article, at) => (
          <View key={article.id} style={{ gap: theme.space.sm }}>
            <Label color={theme.color.accent}>{`Article ${at + 1}`}</Label>
            {/*
              The Creed line this article explains, quoted. Set apart from the
              commentary by a rule rather than by quotation marks, because the
              line is already a quotation inside a page of them.
            */}
            <Aside slot={`line-by-line.art-${article.id}-line`}>{article.line}</Aside>
            <Body>
              {textOf(slots, `line-by-line.art-${article.id}-heading`, article.heading)}
            </Body>
            <Prose slot={`line-by-line.art-${article.id}-body`}>{article.body}</Prose>
            <Plate
              source={belief(article.picture)}
              meta={BELIEF_PICTURES[article.picture]}
              captionSlot={`line-by-line.art-${article.id}-caption`}
              ground="sunken"
            />
          </View>
        ))}
      </Band>

      <Band>
        <Head band="the-see" title={THE_SEE.title} />
        <Plate
          source={belief('st-mark-preaching')}
          meta={BELIEF_PICTURES['st-mark-preaching']}
          slot="the-see.picture"
          captionSlot="the-see.cap-st-mark-preaching"
        />
        <Prose slot="the-see.body">{THE_SEE.body}</Prose>
      </Band>

      <AboutSections />
      <MoreOfAbout current="our-belief" />
    </Bands>
  );
}
