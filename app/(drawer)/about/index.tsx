/**
 * About, as an index of its five parts.
 *
 * The drawer already lists the five, so this screen exists for the same reason
 * the website's `/about` does: the group needs a destination of its own that
 * says what About is, with room for the line under each part that a menu row
 * has no space for. It is also where somebody who arrives from a link — the
 * website's `/about` is a shared URL — lands.
 *
 * A numbered list, not a grid of tiles. The five are prose, and a card
 * carrying a name over an empty ground is furniture. The number down the left
 * is not an order a reader has to obey — any of the five stands alone — but
 * the five *are* in the order they are best read in, and an unnumbered list of
 * five equal rows says nothing about that.
 *
 * **The picture credits live here**, all four sets of them, in a drawer that
 * starts shut — the same arrangement the website's index has. See
 * `about/credits.ts` for why they cannot simply be dropped.
 */
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { ABOUT_PAGES } from '@/about/pages';
import { PICTURE_CREDITS, PICTURE_CREDIT_COUNT } from '@/about/credits';
import { CreditGroup, Fold } from '@/about/parts';
import { useTheme } from '@/theme/ThemeProvider';

export default function AboutIndex() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen gap={theme.space.lg}>
      <View style={{ gap: theme.space.xs }}>
        <Label color={theme.color.accent}>St. Philopater Mercurius & St. Mina</Label>
        <Title>About</Title>
        <Lede color={theme.color.inkSoft}>
          Five pages: who this church is and where the Church it belongs to comes from, what that
          Church confesses, the two saints whose names it carries, what happens in the Liturgy, and
          what is being built next.
        </Lede>
      </View>

      <View style={{ gap: theme.space.sm }}>
        {ABOUT_PAGES.map((page, at) => (
          <Pressable
            key={page.slug}
            onPress={() => router.push(`/about/${page.slug}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
              borderColor: theme.color.rule,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              padding: theme.space.md,
              minHeight: 44,
            })}
          >
            <Label color={theme.color.accent}>{String(at + 1).padStart(2, '0')}</Label>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{page.label}</Body>
              <Small color={theme.color.inkSoft}>{page.lede}</Small>
            </View>
            <Icon name="next" size={18} color={theme.color.inkFaint} />
          </Pressable>
        ))}
      </View>

      <Fold label="Picture credits" aside={`${PICTURE_CREDIT_COUNT} pictures, from Wikimedia Commons`}>
        <Small color={theme.color.inkSoft}>
          None of these is a photograph of this church. They are icons, manuscripts, museum objects
          and photographs held on Wikimedia Commons, and every one is public domain, CC0, CC BY or
          CC BY-SA. Each name links to the page the file is held on, where the full licence terms are.
        </Small>

        {PICTURE_CREDITS.map((group) => (
          <CreditGroup
            key={group.slug}
            label={group.label}
            note={group.note}
            items={group.items}
          />
        ))}
      </Fold>
    </Screen>
  );
}
