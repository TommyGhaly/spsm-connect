/**
 * /privacy — the notice in `notice.ts`, laid out in bands.
 *
 * Bands rather than `components/Surface`'s `Screen`, for the reason the About
 * screens use them: a document this long in one column of paper is an
 * undifferentiated scroll, and a ground that changes every section is what makes
 * thirteen sections read as thirteen things. The grounds alternate off a counter
 * rather than being written down per section, so a section added or dropped
 * cannot land two of the same ground against each other.
 *
 * **No band id is passed to anything here, and no slot is read.** Every other
 * long screen in this app takes its words from `aboutOverrides` so that staff
 * can correct them from the website without a release — see
 * `src/about/overrides.tsx`. This one must not: the accuracy of this notice
 * depends on the code beside it, and a sentence a volunteer can rewrite is a
 * sentence that can be made untrue by somebody who has not read the upload
 * pipeline. `notice.ts`'s header carries the full argument.
 *
 * Closing on `paper` or `sunken` and never on `deep` matters for one sentence in
 * particular: the last band holds the only link on the screen, and `Rich` sets a
 * link in the accent colour, which is not a contrast that has been checked
 * against the deep ground. Only the opening band is deep, and it has no link in
 * it.
 */
import { View } from 'react-native';

import { Label, Small, Title } from '@/components/Type';
import { Rich } from '@/about/Rich';
import { Band, Bands, Head, Prose, inkOn, type Ground } from '@/about/parts';
import { useTheme } from '@/theme/ThemeProvider';

import { OPENING, SECTIONS, type Point } from './notice';

/**
 * A labelled list — a term in the accent colour, and what it means under it.
 *
 * Not `Spine` from `about/parts`, which draws the same shape: its rows are
 * *dated moments* carrying the website's own slot ids, and passing "Bookstore
 * counts" as a `when` would mean calling a heading a date and then looking up an
 * override that cannot exist. The shape is four lines; the meaning is not worth
 * bending to save them.
 */
function Points({ points, ground }: { points: readonly Point[]; ground: Ground }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {points.map((point) => (
        <View
          key={point.term}
          style={{
            borderLeftWidth: 2,
            borderLeftColor: theme.color.gold,
            paddingLeft: theme.space.md,
            gap: 2,
          }}
        >
          <Label color={theme.color.accent}>{point.term}</Label>
          <Rich color={inkOn(ground, theme)}>{point.detail}</Rich>
        </View>
      ))}
    </View>
  );
}

export function PrivacyScreen() {
  const theme = useTheme();

  /*
   * The alternation, as a counter the map reads rather than a function of the
   * index — so that the opening band's ground is not part of the sequence and
   * the first section always lands on `paper`.
   */
  let ground = 0;
  const next = (): Ground => (ground++ % 2 === 0 ? 'paper' : 'sunken');

  return (
    <Bands>
      {/*
        The opening band, built here rather than with `Hero`: that component
        takes a band id and reads three slots off it, and there is no privacy
        slot in the website's manifest — nor should there be. The `note` sits
        above the prose because the date this notice last changed is the first
        thing somebody checking whether it changed is looking for.
      */}
      <Band ground="deep" gap={theme.space.sm}>
        <Label color={theme.color.gold}>{OPENING.eyebrow}</Label>
        <Title color={theme.color.inkInverse}>{OPENING.title}</Title>
        <Small color={theme.color.goldSoft}>{OPENING.note}</Small>
        <View style={{ gap: theme.space.md, paddingTop: theme.space.xs }}>
          {OPENING.body.map((paragraph) => (
            <Rich key={paragraph} color={theme.color.goldSoft}>
              {paragraph}
            </Rich>
          ))}
        </View>
      </Band>

      {SECTIONS.map((section) => {
        const on = next();

        return (
          <Band key={section.title} ground={on}>
            <Head eyebrow={section.eyebrow} title={section.title} ground={on} />
            <Prose>{section.body}</Prose>
            {section.points ? <Points points={section.points} ground={on} /> : null}
          </Band>
        );
      })}
    </Bands>
  );
}
