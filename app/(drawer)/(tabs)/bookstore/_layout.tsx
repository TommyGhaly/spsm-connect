/**
 * The bookstore is a stack now, not a screen.
 *
 * The shop is still the whole of it for a shopper — editing happens in place on
 * the shelf, which is the arrangement the website settled on and the one Tommy
 * asked for there: *"I want the orders and metrics section to make the products
 * have editing functionality in place."* What could not stay in place is the
 * other two screens. The website hangs its orders queue in a drawer down the
 * right of the shop so that opening it does not move the shelf; a phone has no
 * right-hand side to hang anything off, and a full-width overlay over a
 * two-column shelf is a pushed screen that has to reinvent its own back button.
 *
 * So Orders and Figures are pushed, which costs nothing the drawer was buying —
 * the shelf is exactly where it was when you come back — and they land on the
 * same shape the forms admin already has.
 *
 * ## One header, drawn here
 *
 * The tab group draws a header of its own, so leaving it on would stack two
 * dark bars the moment anything is pushed. The tab hides its header (see
 * `(tabs)/_layout.tsx`) and this stack draws every one — which is what
 * `forms/_layout.tsx` does, for the same reason, and `src/navigation/header.ts`
 * is where the pairing is explained.
 */
import { Stack } from 'expo-router';

import { headerChromeStack, headerRootStack } from '@/navigation/header';
import { useTheme } from '@/theme/ThemeProvider';

export default function BookstoreLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        ...headerChromeStack(theme),
        contentStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/* The shop: the tab's own name, and the menu in the corner the tab
          header would have put it in. */}
      <Stack.Screen name="index" options={{ title: 'Bookstore', ...headerRootStack }} />

      {/* "Orders" rather than "Bookstore orders": it is also what the back
          button on nothing says, and the stack it sits in is already named. */}
      <Stack.Screen name="orders" options={{ title: 'Orders' }} />
      <Stack.Screen name="metrics" options={{ title: 'Figures' }} />
    </Stack>
  );
}
