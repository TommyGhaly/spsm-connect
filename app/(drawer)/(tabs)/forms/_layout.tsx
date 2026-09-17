/**
 * Forms are a stack, not a screen.
 *
 * The hub lists them and a form is pushed on top of it, which is the same shape
 * the galleries have and for the same reason: going *into* a form is pushing,
 * and the way back out is the stack's own back button and the edge-swipe.
 *
 * Unlike the galleries this stack lives inside the tab group, so the bar stays
 * visible the whole way down — a form is one level deep, not four, and somebody
 * who opens the wrong one should be able to leave with a press rather than a
 * gesture.
 *
 * ## One header, drawn here
 *
 * The tab group draws a header of its own — menu on the left, announcements on
 * the right — and leaving it on would stack two dark bars on top of each other
 * the moment a form is pushed: "Forms" above "Contact the church office". So
 * the tab hides its header (see `(tabs)/_layout.tsx`) and this stack draws
 * every one, which is the arrangement the galleries already use.
 *
 * What that costs is the two corner controls, and they are put back rather than
 * lost: `headerChrome` gives every screen in the stack the bell, and
 * `headerRoot` gives the hub the menu — where a pushed screen has a back button
 * instead, because it is the way out that screen actually needs.
 *
 * That pair is now the header the whole app draws, and this stack is where the
 * shape was settled. See `src/navigation/header.ts`.
 */
import { Stack } from 'expo-router';

import { headerChromeStack, headerRootStack } from '@/navigation/header';
import { useTheme } from '@/theme/ThemeProvider';

export default function FormsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        ...headerChromeStack(theme),
        contentStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/* The hub: the tab's own name, and the menu in the corner the tab
          header would have put it in. */}
      <Stack.Screen name="index" options={{ title: 'Forms', ...headerRootStack }} />

      {/*
        "Form" is a placeholder: the real title is not known until the
        definition has been read, so `FormScreen` sets it then. It is also what
        the back button on a pushed screen says, which is why the hub above has
        a title at all despite drawing its own.
      */}
      <Stack.Screen name="[slug]" options={{ title: 'Form' }} />

      <Stack.Screen name="summer-camp" options={{ title: 'Serve at summer camp' }} />

      {/*
        A redirect to the hub, not a screen — managing the forms is a mode on
        the hub now rather than a list of its own. It keeps a title because the
        bar is drawn for the instant before the redirect lands, and "Church
        forms" is a truer flicker than the filename would be.
      */}
      <Stack.Screen name="admin/index" options={{ title: 'Church forms' }} />
      <Stack.Screen name="admin/[id]" options={{ title: 'Edit form' }} />
      <Stack.Screen name="admin/submissions" options={{ title: 'Submissions' }} />
      <Stack.Screen name="admin/import" options={{ title: 'Import a form' }} />
    </Stack>
  );
}
