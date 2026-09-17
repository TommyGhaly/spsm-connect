/**
 * A verse, set the way the website sets one.
 *
 * `.give-hero__verse` over there is the display face, italic, at the lede size
 * and snug leading, behind a gold rule, with the citation under it in tracked
 * uppercase. This is that, in points.
 *
 * ## Why it builds its own `Text` rather than using `Lede`
 *
 * `Type.tsx` says there is no `style` escape hatch and that a genuinely new
 * size belongs in its table. This is not a new size — it is `lede`, from the
 * theme, at `snug`, through `lineHeightFor` like every other line in the app.
 * What it is not is the *body* face: a quotation set in the same serif as the
 * paragraph beside it is a paragraph, and the italic display face is what makes
 * it read as somebody else's words. Adding a `roles` entry for it would be
 * claiming the app has an eighth type size, which it does not.
 *
 * ## The citation's colour is not the rule's colour
 *
 * Gold is ornament — the theme's own comment on the token says "never body
 * text" — and it means it: `gold` on `paper` is about 2.7:1, which is a
 * citation nobody with imperfect sight can read. So the rule is gold on both
 * grounds and the citation is gold only on `deep`, where it is a light mark on
 * a dark ground and clears 3:1 comfortably. On paper it takes the accent, which
 * is what every section eyebrow in this app uses.
 */
import { Text, View } from 'react-native';

import { Label } from '@/components/Type';
import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import type { Scripture } from './verses';

export function Verse({
  verse,
  /** The band's ground, which decides what can be read on it. */
  on = 'paper',
}: {
  verse: Scripture;
  on?: 'paper' | 'deep';
}) {
  const theme = useTheme();
  const deep = on === 'deep';

  return (
    <View
      style={{
        borderLeftWidth: 2,
        borderLeftColor: theme.color.gold,
        paddingLeft: theme.space.md,
        gap: theme.space.xs,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fontFamily.display,
          fontStyle: 'italic',
          fontSize: theme.fontSize.lede,
          lineHeight: lineHeightFor(theme, 'lede', 'snug'),
          color: deep ? theme.color.goldSoft : theme.color.ink,
        }}
      >
        {/* The curly quotes are the component's, not the content's, so that
            `verses.ts` holds scripture and not typography. */}
        {`“${verse.text}”`}
      </Text>
      <Label color={deep ? theme.color.gold : theme.color.accent}>{verse.reference}</Label>
    </View>
  );
}
