/**
 * Giving, which is a door rather than a page.
 *
 * Tithe.ly's hosted form is Tithe.ly's, and it opens in a browser rather than
 * inside this app. That is the whole content of this screen and it is a
 * deliberate refusal: a donation form embedded in a native screen is a payment
 * page whose address bar nobody can see, which is the one thing a person about
 * to type a card number should be able to check.
 *
 * Carried over verbatim from `more.tsx`, which is where this lived before
 * giving became a tab of its own. The reasoning did not change when the
 * navigation did.
 */
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/*
 * The parish's Tithe.ly form, copied from the website's features/giving/config.ts
 * where the reasoning for it being committed rather than configured is written
 * out. It is not a credential — it is the identifier Tithe.ly prints in its own
 * embed snippet, and it ships in the website's HTML already.
 *
 * If the parish's giving page ever moves, it moves in both places. That is a
 * genuine duplication and the alternative — putting it in `@spsm/shared` — is
 * the better answer the day a third thing needs it.
 */
const GIVING_URL = 'https://give.tithe.ly/?formId=44f1af1b-7edf-4005-af05-0c7a7f7249ac';

export function GivingScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>Giving</Label>
        <Body color={theme.color.inkSoft}>
          The parish&rsquo;s giving form opens in your browser, so you can see the address you are
          typing your card into.
        </Body>
        <Button label="Give" onPress={() => void WebBrowser.openBrowserAsync(GIVING_URL)} />
      </Card>
    </Screen>
  );
}
