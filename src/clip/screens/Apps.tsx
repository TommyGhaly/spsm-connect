/**
 * `/c/apps` — the parish's apps, and where to get them.
 *
 * The full app's Apps screen, unforked, plus **one card the full app does not
 * have: this one.** `stores.ts` lists the church's two installable apps and
 * deliberately not SPSM Connect, because a card in the app telling you about
 * the app you are holding is noise. In a clip it is the opposite: the reader is
 * holding a sample that iOS will delete in a few hours, and the card that says
 * so — and offers to keep it — is the most useful row on the page. The seam is
 * `AppsScreen`'s `footer` slot, which exists for exactly this.
 *
 * The circularity of the experience itself is real and is argued in
 * `experiences.ts`: an App Clip *is* an App Store card. It stays because the
 * printed card this opens from lists four things, only one of which is this
 * app, and a Smart App Banner cannot introduce Taksis.
 *
 * `AppsScreen` also pushes `/about/future-plans` from one of its cards. In the
 * clip that lands on the Plans experience rather than a browser, through the
 * router shim — see `src/clip/navigate.ts`.
 */
import { View } from 'react-native';

import { AppsScreen } from '@/apps/AppsScreen';
import { Button, Card } from '@/components/Surface';
import { Body, Label, Small, Subheading } from '@/components/Type';
import { recommendApp } from '@/clip/handoff';
import { useTheme } from '@/theme/ThemeProvider';

export function Apps() {
  return <AppsScreen footer={<ThisApp />} />;
}

/**
 * The app the reader is currently sampling.
 *
 * **No icon**, matching the website's own rule for this card: it has no store
 * listing to take an icon from, and an invented mark for an unreleased app is
 * the one thing on this page that could mislead somebody. The app's bundled
 * `icon.png` would be a third option and is not worth its kilobytes against a
 * 15 MB budget for a picture of the thing already on screen.
 *
 * The button is Apple's App Clip overlay rather than a store link, because
 * there is no App Store id yet — the overlay needs none, since the system
 * already knows which app this clip belongs to. See `handoff.ts`.
 */
function ThisApp() {
  const theme = useTheme();

  return (
    <Card gap={theme.space.md}>
      <View style={{ gap: 2 }}>
        <Label color={theme.color.accent}>YOU ARE USING IT NOW</Label>
        <Subheading>SPSM Connect</Subheading>
      </View>

      <Body color={theme.color.inkSoft}>
        The church’s own app, for everyone rather than for servants: the
        calendar, the galleries, parish forms, the bookstore and the offering.
        What you are holding is a sample of it — iPhone removes it again on its
        own after a while, and nothing you have done here is kept.
      </Body>

      <Button label="Get SPSM Connect" onPress={recommendApp} />

      <Small color={theme.color.inkFaint}>
        Free, and from the church’s own developer account.
      </Small>
    </Card>
  );
}
