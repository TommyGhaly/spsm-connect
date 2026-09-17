/**
 * A link the app claimed but cannot yet open.
 *
 * This is load-bearing rather than boilerplate, and the reason is the App Clip.
 *
 * The nine invocation URLs are real website addresses — /calendar, /giving,
 * /bookstore, /forms, /apps, /about/welcome-newcomers, /about/future-plans,
 * /events/**, /admin/camp/attendance. Claiming them in the association file is
 * what makes a tag offer the clip to somebody without the app. But the same
 * claim also means an **installed** app intercepts every one of those links,
 * including the ones whose screens land in phases 3 to 6.
 *
 * Without this, somebody who has the app taps a link to the church
 * calendar and gets expo-router's developer 404 — worse than not having claimed
 * the link at all, because Safari would have shown them the real page.
 *
 * So the fallback is not "not found". It is "not here yet, here it is on the
 * website", and it hands the exact path over. Delete the escape hatch when the
 * last of the nine has a native screen; keep the route.
 */
import * as WebBrowser from 'expo-web-browser';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label } from '@/components/Type';
import { apiUrl } from '@/api/client';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFound() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  /*
   * The same origin the app talks to, so a build pointed at a staging Hosting
   * site opens staging rather than production. `apiUrl` already owns that
   * decision; there is no second place that knows the origin.
   */
  const onTheWeb = apiUrl(pathname === '/' ? '/' : pathname);

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>Not in the app yet</Label>
        <Body color={theme.color.inkSoft}>
          This part of the church site has not been built into the app. It is on the website, and
          this will open it there.
        </Body>
        <Button label="Open on the website" onPress={() => void WebBrowser.openBrowserAsync(onTheWeb)} />
        <Button label="Go to the home screen" onPress={() => router.replace('/')} tone="quiet" />
      </Card>

      {/*
        * The path, shown deliberately. When a tag opens the wrong thing, the
        * first question is always which URL it actually carried, and a person
        * standing next to the tag is the only one who can answer it.
        */}
      <Label>{pathname}{Object.keys(params).length > 0 ? ` · ${JSON.stringify(params)}` : ''}</Label>
    </Screen>
  );
}
