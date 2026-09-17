/**
 * /about/future-plans — the three buildings designed for 169 Rice Road.
 *
 * The bands are the website's, in its order: the hero, the three buildings one
 * at a time, ten more views, the area schedule, the land, where the work
 * stands, the nine firms, and the offering.
 *
 * **The offering is the last band on purpose, and it is the one place on these
 * five pages that asks for anything.** Who We Are ends on the people who serve
 * rather than on an invitation, and the eight bands above this one mention no
 * money at all. The website's note on why this page is the exception is worth
 * repeating: 119,458 square feet is not paid for by a church that never
 * mentions it, and a reader who has just been shown the whole thing and told
 * twice that nothing is built has earned the sentence about what happens next.
 */
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';

import { Label, Small, Subheading } from '@/components/Type';
import { Button } from '@/components/Surface';
import {
  AboutSections,
  Band,
  Bands,
  Figures,
  Head,
  Hero,
  MoreOfAbout,
  Plate,
  Prose,
  Rows,
  Spine,
  Strip,
} from './parts';
import { Film } from './Film';
import { Rich } from './Rich';
import { textOf, useAboutSlots } from './overrides';
import {
  ALL_OF_IT,
  BUILDING_A,
  BUILDING_B,
  BUILDING_C,
  BY_USE,
  FIRMS_WITH_MARKS,
  FLYTHROUGH,
  FUTURE_GALLERY,
  FUTURE_PICTURES,
  HEADLINE,
  HERO,
  MORE_VIEWS,
  PAYING,
  PROGRESS,
  TEAM,
  TEAM_MARKS_HEADING,
  THE_LAND,
  WHAT,
  WHERE_IT_STANDS,
  WHO_IS_DRAWING,
  firmLogo,
  future,
  galleryThumb,
  type FutureGalleryName,
} from './future';
/*
 * The give action, from the giving screen rather than from a second copy of
 * the form's address here.
 *
 * It used to be a `GIVING_URL` constant in this file, with a note saying the
 * form opens in a browser and that this was a deliberate refusal to embed it.
 * That is still true and is still the reasoning — it has just moved to the one
 * place that owns it, along with the presentation, so that the construction
 * fund and the Giving tab open the same form the same way. See
 * `giving/open.ts`.
 */
import { openGiving } from '@/giving/open';
import { useTheme } from '@/theme/ThemeProvider';

const GALLERY = Object.keys(FUTURE_GALLERY) as FutureGalleryName[];

export function FutureScreen() {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <Bands>
      <Hero band="future-hero" eyebrow={HERO.eyebrow} title={HERO.title} lede={HERO.lede} />

      {/*
        The film sits in its own band rather than inside the hero, so it gets a
        light ground under it: a 16:9 poster on the dark hero reads as a hole
        cut in the page. The heading is the website's, which renders it hidden;
        here it is the band's own label.
      */}
      <Band>
        <Label color={theme.color.accent}>{FLYTHROUGH.heading}</Label>
        <Film />
      </Band>

      {/*
        The marks, straight after the film, which is the position Tommy asked
        for on the website: *"put the logos at the top after the video."* A
        reader who has just watched a photorealistic animation of a building
        that does not exist is at their most sceptical in the second after it
        ends, and seven engineering firms' marks answer that in about a second
        — which only works if they are the next thing on the screen.

        The *names* stay at the foot of the page with their roles and towns. A
        row of marks answers "is this serious"; the list answers "who checked
        the structure", and needs a reader who has got that far. Two questions,
        two places, one `TEAM` array.
      */}
      <Band>
        <Rich>{TEAM_MARKS_HEADING}</Rich>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: 'center',
            gap: theme.space.lg,
            paddingRight: theme.space.gutter,
          }}
        >
          {FIRMS_WITH_MARKS.map((slug) => {
            const firm = TEAM.find((member) => member.slug === slug);
            return (
              <Image
                key={slug}
                source={firmLogo(slug)}
                // The name is the accessible text, in the list at the foot of
                // the page. A mark announced as well reads every firm twice.
                alt=""
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                contentFit="contain"
                transition={200}
                style={{ width: firm ? 120 : 120, height: 42 }}
              />
            );
          })}
        </ScrollView>
      </Band>

      <Band>
        <Head band="what-is-being-built" title={WHAT.title} />
        <Prose slot="what-is-being-built.body">{WHAT.body}</Prose>
        <Plate
          source={future('campus-aerial')}
          meta={FUTURE_PICTURES['campus-aerial']}
          captionSlot="what-is-being-built.cap-campus-aerial"
        />
        <Figures figures={HEADLINE} />
        <Plate
          source={future('piazza')}
          meta={FUTURE_PICTURES.piazza}
          captionSlot="what-is-being-built.cap-piazza"
        />
      </Band>

      <Band ground="sunken">
        <Label color={theme.color.accent}>{BUILDING_A.tag}</Label>
        <Head band="the-church" title={BUILDING_A.title} ground="sunken" />
        <Prose slot="the-church.body">{BUILDING_A.body}</Prose>
        <Plate
          source={future('steps')}
          meta={FUTURE_PICTURES.steps}
          captionSlot="the-church.cap-steps"
          ground="sunken"
        />
        <Plate
          source={future('west-front')}
          meta={FUTURE_PICTURES['west-front']}
          captionSlot="the-church.cap-west-front"
          ground="sunken"
        />
      </Band>

      <Band>
        <Label color={theme.color.accent}>{BUILDING_B.tag}</Label>
        <Head band="youth-and-housing" title={BUILDING_B.title} />
        <Prose slot="youth-and-housing.body">{BUILDING_B.body}</Prose>
        <Plate
          source={future('youth-center')}
          meta={FUTURE_PICTURES['youth-center']}
          captionSlot="youth-and-housing.cap-youth-center"
        />
      </Band>

      <Band ground="sunken">
        <Label color={theme.color.accent}>{BUILDING_C.tag}</Label>
        <Head band="the-diocese-centre" title={BUILDING_C.title} ground="sunken" />
        <Prose slot="the-diocese-centre.body">{BUILDING_C.body}</Prose>
        <Plate
          source={future('diocese-center')}
          meta={FUTURE_PICTURES['diocese-center']}
          captionSlot="the-diocese-centre.cap-diocese-center"
          ground="sunken"
        />
      </Band>

      <Band>
        <Head
          band="more-views"
          eyebrow={MORE_VIEWS.eyebrow}
          title={MORE_VIEWS.title}
          lede={MORE_VIEWS.lede}
        />
        <Strip
          // "Open larger" is on every tile on the website, and the tile here is
          // 240pt wide. `galleryFull` is the 1600 file the lightbox opens.
          full={(source) => source.replace('-480.webp', '-1600.webp')}
          items={GALLERY.map((name) => ({
            source: galleryThumb(name),
            // The tiles are cropped to one fixed size by the optimiser, so they
            // carry no intrinsic dimensions of their own; 16:9 is the shape of
            // the frames the lightbox opens.
            meta: { ...FUTURE_GALLERY[name], width: 16, height: 9 },
          }))}
        />
      </Band>

      <Band ground="tinted">
        <Head
          band="all-of-it"
          eyebrow={ALL_OF_IT.eyebrow}
          title={ALL_OF_IT.title}
          lede={ALL_OF_IT.lede}
          ground="tinted"
        />
        <Rows
          ground="tinted"
          rows={BY_USE.map((row, at) => ({
            left: row.use,
            leftSlot: `all-of-it.use-${at}-name`,
            // The area is not a slot on the website. It is read off the
            // AREA BY USE TYPE schedule and the seven rows add to the total
            // exactly; a figure a volunteer can retype is a figure that will
            // eventually disagree with the drawing it came from.
            right: `${row.area.toLocaleString('en-US')} sq ft`,
            note: row.of,
            noteSlot: `all-of-it.use-${at}-of`,
          }))}
        />
      </Band>

      <Band>
        <Head
          band="the-land"
          eyebrow={THE_LAND.eyebrow}
          title={THE_LAND.title}
          lede={THE_LAND.lede}
        />
        <Plate
          source={future('roofs-aerial')}
          meta={FUTURE_PICTURES['roofs-aerial']}
          captionSlot="the-land.cap-roofs-aerial"
        />
        <Plate
          source={future('site-plan')}
          meta={FUTURE_PICTURES['site-plan']}
          captionSlot="the-land.cap-site-plan"
          openable
        />
        <Prose slot="the-land.body">{THE_LAND.body}</Prose>
        <Plate
          source={future('massing')}
          meta={FUTURE_PICTURES.massing}
          captionSlot="the-land.cap-massing"
          openable
        />
      </Band>

      <Band ground="sunken">
        <Head
          band="where-it-stands"
          eyebrow={WHERE_IT_STANDS.eyebrow}
          title={WHERE_IT_STANDS.title}
          lede={WHERE_IT_STANDS.lede}
          ground="sunken"
        />
        <Spine
          moments={PROGRESS}
          slotPrefix="where-it-stands.step"
          parts={['when', 'what']}
          ground="sunken"
        />
        <Prose slot="where-it-stands.foot">{WHERE_IT_STANDS.foot}</Prose>
      </Band>

      <Band ground="tinted">
        <Head
          band="who-is-drawing-it"
          eyebrow={WHO_IS_DRAWING.eyebrow}
          title={WHO_IS_DRAWING.title}
          lede={WHO_IS_DRAWING.lede}
          ground="tinted"
        />

        {/*
          The role comes first and the firm second, because the question a
          reader has is "did anyone check the structure / the traffic / the
          wetland", not "who is Foley Buhl Roberts". Answering in that order
          lets the list be skimmed as a checklist of disciplines, which is what
          it is being offered as. The website's `<dl>`, in the same order.
        */}
        <View style={{ gap: theme.space.md }}>
          {TEAM.map((member) => (
            <View key={member.slug} style={{ gap: 2 }}>
              <Label color={theme.color.accent}>
                {textOf(slots, `who-is-drawing-it.firm-${member.slug}-role`, member.role)}
              </Label>
              <Subheading>
                {textOf(slots, `who-is-drawing-it.firm-${member.slug}-name`, member.firm)}
              </Subheading>
              {/* Empty for the two firms whose address is not printed anywhere
                  in the set. */}
              {member.town ? (
                <Small color={theme.color.inkSoft}>
                  {textOf(slots, `who-is-drawing-it.firm-${member.slug}-town`, member.town)}
                </Small>
              ) : null}
            </View>
          ))}
        </View>

        <Small color={theme.color.inkFaint}>{WHO_IS_DRAWING.credit}</Small>
      </Band>

      <Band ground="deep">
        <Head band="paying-for-it" title={PAYING.title} ground="deep" />
        <Rich color={theme.color.goldSoft}>
          {textOf(slots, 'paying-for-it.lede', PAYING.lede)}
        </Rich>
        <Rich color={theme.color.inkInverse}>
          {textOf(slots, 'paying-for-it.fund', PAYING.fund)}
        </Rich>
        <Button
          label="Give to the construction fund"
          onPress={() => openGiving(theme)}
        />
        <Rich color={theme.color.goldSoft}>
          {textOf(slots, 'paying-for-it.note', PAYING.note)}
        </Rich>
      </Band>

      <AboutSections />
      <MoreOfAbout current="future-plans" />
    </Bands>
  );
}
