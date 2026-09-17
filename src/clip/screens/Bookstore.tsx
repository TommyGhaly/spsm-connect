/**
 * `/c/bookstore` — the one experience that says "not here".
 *
 * ---------------------------------------------------------------------------
 * The reason is the budget, and it is worth being exact about, because "the
 * clip cannot sell books" sounds like a rule and is not one.
 *
 * Physical goods may not be sold through in-app purchase — Apple's own
 * guideline — so the only ways to take money for a book are Apple Pay or a card
 * sheet, and both mean Square's native SDK. That framework is in the clip
 * target's `excludedPackages` because **15 MB, uncompressed** is the whole
 * budget for a physical invocation, and every tag this parish owns is physical.
 *
 * The shelf itself would render here: `bookstore/data.ts` is Firestore and
 * `payments/square.ts` degrades honestly rather than crashing in a binary with
 * no SDK. A shop that can show a book and cannot sell it is a worse card than
 * an honest one — somebody would browse, choose, press Buy, and be told at the
 * last step to go and install something.
 *
 * So this card says the two true things and offers the two working routes: the
 * full app, which takes Apple Pay, and the church's own website, which takes a
 * card through Square's web checkout and needs nothing installed at all.
 *
 * **Revisit the day there is a measurement**, not before. If the clip ever fits
 * Square, this file is what it replaces.
 * ---------------------------------------------------------------------------
 */
import { View } from 'react-native';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small, Subheading } from '@/components/Type';
import { openSite, recommendApp } from '@/clip/handoff';
import { useTheme } from '@/theme/ThemeProvider';

export function Bookstore() {
  const theme = useTheme();

  return (
    <Screen>
      <Card>
        <Label>THE PARISH BOOKSTORE</Label>
        <Subheading>Icons, books and gifts from the church.</Subheading>
        <Body color={theme.color.inkSoft}>
          Buying happens in one of two places: SPSM Connect, which takes Apple
          Pay, or the church’s own website, which takes a card in a browser.
          Either way the order is collected at, or posted from, the church.
        </Body>

        <View style={{ gap: theme.space.sm, paddingTop: theme.space.sm }}>
          <Button label="Get SPSM Connect" onPress={recommendApp} />
          <Button
            label="Shop on the website"
            tone="quiet"
            onPress={() => openSite('/bookstore', theme)}
          />
        </View>

        <Small color={theme.color.inkFaint}>
          Nothing is charged here, and nothing typed here is a payment.
        </Small>
      </Card>
    </Screen>
  );
}
