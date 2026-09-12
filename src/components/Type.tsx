/**
 * Text, at the parish's sizes.
 *
 * Every one of these is three lines of style over `<Text>`, which looks like
 * ceremony until you write the fourth screen. RN needs `lineHeight` in absolute
 * points and `letterSpacing` in points, so *every* piece of styled text in this
 * app would otherwise carry the same two multiplications — and the first time
 * somebody writes `lineHeight: 24` instead of `lineHeightFor(theme, ...)` the
 * app has quietly stopped tracking the parish's own theme.
 *
 * The roles are the website's, from `ThemeTypeScale`: display, title, heading,
 * subheading, lede, body, small, micro. Nothing here invents a size, and there
 * is no `style` escape hatch for one — pass a colour if you need a different
 * colour, and add a role here if you genuinely need a different size.
 */
import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';
import { letterSpacingPoints } from '@spsm/shared';

import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Role = 'display' | 'title' | 'heading' | 'subheading' | 'lede' | 'body' | 'small' | 'micro';

/*
 * Which family and leading each role gets. Kept here rather than at each call
 * site so "the lede is set in the body face at relaxed leading" is one fact in
 * one place, the way the website's stylesheet has it.
 */
const ROLES = {
  display: { family: 'display', leading: 'tight' },
  title: { family: 'display', leading: 'tight' },
  heading: { family: 'display', leading: 'snug' },
  subheading: { family: 'ui', leading: 'snug' },
  lede: { family: 'body', leading: 'relaxed' },
  body: { family: 'body', leading: 'normal' },
  small: { family: 'ui', leading: 'normal' },
  micro: { family: 'ui', leading: 'normal' },
} as const satisfies Record<Role, { family: 'body' | 'ui' | 'display'; leading: 'tight' | 'snug' | 'normal' | 'relaxed' }>;

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
    const { family, leading } = ROLES[role];

    return (
      <Text
        {...rest}
        style={{
          color: color ?? theme.color.ink,
          fontFamily: theme.fontFamily[family],
          fontSize: theme.fontSize[role],
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
 * The uppercase label above a card or a section — "FROM @SPSM/SHARED",
 * "AWAITING APPROVAL".
 *
 * Its own component rather than a `micro` variant because it is the one place
 * in the app that opens letter-spacing, and uppercase micro text without the
 * `wide` tracking is a smudge. Callers should pass already-uppercase text;
 * `textTransform` is applied here so they cannot forget.
 */
export function Label({ children, color, align, ...rest }: TypeProps) {
  const theme = useTheme();

  return (
    <Text
      {...rest}
      style={{
        color: color ?? theme.color.inkFaint,
        fontFamily: theme.fontFamily.ui,
        fontSize: theme.fontSize.micro,
        lineHeight: lineHeightFor(theme, 'micro', 'normal'),
        letterSpacing: letterSpacingPoints(theme.letterSpacingEm.wide, theme.fontSize.micro),
        textTransform: 'uppercase',
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}
