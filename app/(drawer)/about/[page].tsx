/**
 * One of the five parts of About.
 *
 * A single route rather than five files, because the five share a slug space
 * with the website — `/about/who-we-are` opens the same page in a browser and
 * in this app — and one place that maps a slug to a screen is one place to
 * check that the mapping is complete. `SCREENS` is keyed by `AboutSlug`, so
 * adding a sixth entry to `ABOUT_PAGES` without adding a screen here does not
 * compile.
 *
 * The header title comes from the page rather than from the drawer's static
 * `About`, so that a reader four bands into Future Plans can still see which
 * of the five they are in.
 */
import { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Card, Screen } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { BeliefScreen } from '@/about/BeliefScreen';
import { FutureScreen } from '@/about/FutureScreen';
import { SaintsScreen } from '@/about/SaintsScreen';
import { TourScreen } from '@/about/TourScreen';
import { WhoScreen } from '@/about/WhoScreen';
import { AboutCopyProvider } from '@/about/overrides';
import { aboutPage, type AboutSlug } from '@/about/pages';
import { useTheme } from '@/theme/ThemeProvider';

const SCREENS: Record<AboutSlug, () => React.JSX.Element> = {
  'who-we-are': WhoScreen,
  'our-belief': BeliefScreen,
  'patron-saints': SaintsScreen,
  'welcome-newcomers': TourScreen,
  'future-plans': FutureScreen,
};

export default function AboutPart() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const theme = useTheme();

  const meta = aboutPage(page ?? '');

  /*
   * `setOptions` rather than a `<Drawer.Screen>` in the layout, because the
   * title depends on the parameter and the layout is rendered above the route
   * that knows it. Guarded on `meta`, so a stale slug leaves the drawer's own
   * "About" standing rather than clearing the header to nothing.
   */
  useEffect(() => {
    if (meta) navigation.setOptions({ title: meta.title });
  }, [navigation, meta]);

  if (!meta) {
    /*
     * A slug this build does not have. The likeliest cause is a link from a
     * newer website — these URLs are shared — so this says which page was
     * asked for and offers the index, rather than redirecting somewhere the
     * reader did not ask to be.
     */
    return (
      <Screen>
        <Card>
          <Label>Not in this app yet</Label>
          <Body color={theme.color.inkSoft}>
            There is no part of About called “{page}” in this version. It may be on the website.
          </Body>
          <Pressable
            onPress={() => router.replace('/about')}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Small color={theme.color.accent}>All of About</Small>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  /*
   * The overlay wraps the screen rather than being read inside it: one fetch
   * of `aboutOverrides/{slug}` feeds every band, caption and date on the page
   * through context, and the screen itself stays a layout. See
   * `about/overrides.tsx` — this is what makes an edit made on the website
   * appear here without a release.
   */
  const Part = SCREENS[meta.slug];
  return (
    <AboutCopyProvider slug={meta.slug}>
      <Part />
    </AboutCopyProvider>
  );
}
