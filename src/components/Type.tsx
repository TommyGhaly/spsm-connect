/**
 * Text, at the church's sizes.
 *
 * Every one of these is three lines of style over `<Text>`, which looks like
 * ceremony until you write the fourth screen. RN needs `lineHeight` in absolute
 * points and `letterSpacing` in points, so *every* piece of styled text in this
 * app would otherwise carry the same two multiplications — and the first time
 * somebody writes `lineHeight: 24` instead of `lineHeightFor(theme, ...)` the
 * app has quietly stopped tracking the church's own theme.
 *
 * The roles are the website's, from `ThemeTypeScale`: display, title, heading,
 * subheading, lede, body, small, micro. Nothing here invents a size, and there
 * is no `style` escape hatch for one — pass a colour if you need a different
 * colour, and add a role here if you genuinely need a different size.
 */
import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Role = 'display' | 'title' | 'heading' | 'subheading' | 'lede' | 'body' | 'small' | 'micro';

/*
 * Which family and leading each role gets. Kept here rather than at each call
 * site so "the lede is set in the body face at relaxed leading" is one fact in
 * one place, the way the website's stylesheet has it.
 */
const ROLES = {
  display: { family: 'display', leading: 'tight', weight: '700' },
  title: { family: 'display', leading: 'tight', weight: '700' },
  heading: { family: 'display', leading: 'snug', weight: '600' },
  subheading: { family: 'ui', leading: 'snug', weight: '600' },
  lede: { family: 'body', leading: 'normal', weight: '400' },
  body: { family: 'body', leading: 'normal', weight: '400' },
  small: { family: 'ui', leading: 'normal', weight: '400' },
  /*
   * `tight`, alone among the small roles, because the only thing set at this
   * size is a counter — one or two characters that will never wrap. Leading is
   * the gap between lines, and 1.5 of it around a single line is half a line of
   * dead space inside whatever the counter is drawn in: it made the
   * announcements badge 25pt across on a 44pt bell.
   *
   * This does not touch `Label`, which is the other thing set in `micro` and is
   * genuinely prose. It computes its own leading below rather than going
   * through this table.
   */
  micro: { family: 'ui', leading: 'tight', weight: '400' },
} as const satisfies Record<
  Role,
  {
    family: 'body' | 'ui' | 'display';
    leading: 'tight' | 'snug' | 'normal' | 'relaxed';
    /*
     * The system sans carries hierarchy by weight, not by face. The serif this
     * app used to set its headings in was distinct at regular weight; San
     * Francisco and Roboto at regular weight make a heading look like large
     * body text, so the heading roles are set semibold and bold the way the
     * platforms' own large titles and section titles are.
     */
    weight: '400' | '600' | '700';
  }
>;

export interface TypeProps extends Omit<TextProps, 'style'> {
  children: ReactNode;
  /** A theme colour. Defaults to `ink`, which is what body text is. */
  color?: string;
  /** Centre a heading over a card. Layout, not type. */
  align?: 'left' | 'center' | 'right';
}

function make(role: Role) {
  return function Styled({ children, color, align, ...rest }: TypeProps) {
    const theme = useTheme();
    const { family, leading, weight } = ROLES[role];

    return (
      <Text
        {...rest}
        style={{
          color: color ?? theme.color.ink,
          fontFamily: theme.fontFamily[family],
          fontSize: theme.fontSize[role],
          fontWeight: weight,
          lineHeight: lineHeightFor(theme, role, leading),
          textAlign: align,
        }}
      >
        {children}
      </Text>
    );
  };
}

export const Display = make('display');
export const Title = make('title');
export const Heading = make('heading');
export const Subheading = make('subheading');
export const Lede = make('lede');
export const Body = make('body');
export const Small = make('small');

/**
 * The smallest size in the scale, in its own case.
 *
 * `Label` is the other consumer of `micro` and shouts — uppercase, tracked out.
 * This is the same size read normally, for the one or two characters that have
 * to fit inside something drawn rather than laid out: the count on the
 * announcements bell. Anything with a sentence in it wants `Small`.
 */
export const Micro = make('micro');

/**
 * The short header above a card or a section — "Awaiting approval", "Drivers".
 *
 * Set the way iOS and Android set their own section headers: the small size,
 * semibold, in the muted ink, in sentence case. It used to be uppercase and
 * tracked out, which is the eyebrow every generated landing page puts over
 * every block; in a native app it read as a template rather than as the phone.
 * Callers pass sentence-case text and it is drawn as given.
 */
export function Label({ children, color, align, ...rest }: TypeProps) {
  const theme = useTheme();

  return (
    <Text
      {...rest}
      style={{
        color: color ?? theme.color.inkSoft,
        fontFamily: theme.fontFamily.ui,
        fontSize: theme.fontSize.small,
        fontWeight: '600',
        lineHeight: lineHeightFor(theme, 'small', 'snug'),
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}
