/**
 * /about/patron-saints — the two the church is named for.
 *
 * The website alternates grounds down this page and computes the alternation
 * rather than writing it down; the same is done here, for the same reason. A
 * hardcoded ground is a trap for whoever adds the band that is conditional.
 *
 * The diptych at the top is the one piece of layout worth keeping from the
 * web: "which one is which" is the first question this page has to answer, and
 * two named icons side by side answer it faster than a paragraph. On a phone
 * they are two plates one under the other, which is what the website's own
 * grid collapses to at this width.
 */
import { View } from 'react-native';

import { Label, Subheading } from '@/components/Type';
import {
  AboutSections,
  Band,
  Bands,
  Head,
  MoreOfAbout,
  Plate,
  Prose,
  Rows,
  Strip,
  Subhead,
  type Ground,
} from './parts';
import {
  DIPTYCH,
  ICONS,
  MERCURIUS,
  MERCURIUS_FEASTS,
  MINA,
  MINA_FEASTS,
  OPENING,
  SAINT_PICTURES,
  saint,
  type Feast,
} from './saints';
import { textOf, useAboutSlots } from './overrides';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The days the Church keeps for one of them.
 *
 * Both calendars in one row, with the Coptic date first — it is the one the
 * Synaxarium is read on. The line about leap years is printed once, under the
 * pair, rather than hedging every row.
 */
function Feasts({
  feasts,
  prefix,
  ground,
}: {
  feasts: readonly Feast[];
  /** `mercurius-heading.feast`, and so on — the website's own row ids. */
  prefix: string;
  ground: Ground;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label color={theme.color.accent}>
        {textOf(slots, `${prefix}-label`, 'The Church keeps')}
      </Label>
      <Rows
        ground={ground}
        rows={feasts.map((feast, at) => ({
          left: feast.coptic,
          leftSlot: `${prefix}-${at}-coptic`,
          right: feast.gregorian,
          rightSlot: `${prefix}-${at}-gregorian`,
          note: feast.what,
          noteSlot: `${prefix}-${at}-what`,
        }))}
      />
    </View>
  );
}

export function SaintsScreen() {
  const theme = useTheme();
  let ground = 0;
  const band = (): Ground => (ground++ % 2 === 0 ? 'paper' : 'sunken');

  const first = band();
  const second = band();
  const third = band();
  const fourth = band();

  return (
    <Bands>
      <Band ground={first}>
        <Head
          band="both-heading"
          eyebrow={OPENING.eyebrow}
          title={OPENING.title}
          ground={first}
        />
        <Prose slot="both-heading.body">{OPENING.body}</Prose>

        {/*
          The diptych. On the website these two sit side by side at desk width
          and stack on a phone, which is what they do here — but the *names*
          over the captions are the point of it and are not layout: "which one
          is which" is the first question this page has to answer.
        */}
        {(['mercurius-icon', 'mina-mosaic'] as const).map((name) => (
          <View key={name} style={{ gap: theme.space.xs }}>
            <Plate
              source={saint(name)}
              meta={SAINT_PICTURES[name]}
              captionSlot={`both-heading.cap-${name}`}
              ground={first}
            />
            <View style={{ gap: 2 }}>
              <Subheading>{DIPTYCH[name].name}</Subheading>
              <Label color={theme.color.accent}>{DIPTYCH[name].also}</Label>
            </View>
          </View>
        ))}
      </Band>

      <Band ground={second}>
        <Head
          band="mercurius-heading"
          eyebrow={MERCURIUS.eyebrow}
          title={MERCURIUS.title}
          note={MERCURIUS.note}
          ground={second}
        />
        <Prose slot="mercurius-heading.body">{MERCURIUS.body}</Prose>

        {/*
          The website has these two as `h3`s inside the same editable body, so
          neither the subheading nor what follows it carries a slot of its own.
        */}
        <Subhead>{MERCURIUS.julian.title}</Subhead>
        <Prose>{MERCURIUS.julian.body}</Prose>

        <Subhead>{MERCURIUS.now.title}</Subhead>
        <Prose>{MERCURIUS.now.body}</Prose>

        <Plate
          source={saint('mercurius-church-cairo')}
          meta={SAINT_PICTURES['mercurius-church-cairo']}
          captionSlot="mercurius-heading.cap-mercurius-church-cairo"
          ground={second}
        />

        <Feasts feasts={MERCURIUS_FEASTS} prefix="mercurius-heading.feast" ground={second} />
      </Band>

      <Band ground={third}>
        <Head
          band="mina-heading"
          eyebrow={MINA.eyebrow}
          title={MINA.title}
          note={MINA.note}
          ground={third}
        />
        <Prose slot="mina-heading.body">{MINA.body}</Prose>

        <Subhead>{MINA.camel.title}</Subhead>
        <Prose>{MINA.camel.body}</Prose>

        <Subhead>{MINA.now.title}</Subhead>
        <Prose>{MINA.now.body}</Prose>

        <Plate
          source={saint('mina-basilica')}
          meta={SAINT_PICTURES['mina-basilica']}
          captionSlot="mina-heading.cap-mina-basilica"
          ground={third}
        />

        <Feasts feasts={MINA_FEASTS} prefix="mina-heading.feast" ground={third} />
      </Band>

      <Band ground={fourth}>
        <Head
          band="icons-heading"
          eyebrow={ICONS.eyebrow}
          title={ICONS.title}
          note={ICONS.note}
          ground={fourth}
        />
        <Prose slot="icons-heading.body">{ICONS.body}</Prose>

        {/*
          A strip, not three full plates: these three are evidence for the two
          paragraphs above them, and a full-width picture of a museum object
          would be the biggest thing on the page for the smallest reason.
        */}
        <Strip
          items={[
            {
              source: saint('mercurius-triptych'),
              meta: SAINT_PICTURES['mercurius-triptych'],
              captionSlot: 'icons-heading.cap-mercurius-triptych',
            },
            {
              source: saint('mina-plaque'),
              meta: SAINT_PICTURES['mina-plaque'],
              captionSlot: 'icons-heading.cap-mina-plaque',
            },
            {
              source: saint('mina-ampulla'),
              meta: SAINT_PICTURES['mina-ampulla'],
              captionSlot: 'icons-heading.cap-mina-ampulla',
            },
          ]}
        />
      </Band>

      <AboutSections />
      <MoreOfAbout current="patron-saints" />
    </Bands>
  );
}
