/**
 * The tab bar, mirroring the website's shape rather than inventing one.
 *
 * Home, Calendar and Photos are the three things the website's own navigation
 * puts first, and "More" holds the rest — the shop, the forms, giving, the
 * livestream, About, and the account. Four tabs rather than seven because a
 * phone's tab bar stops being readable at five, and because the three that are
 * here are the three somebody opens an app for.
 *
 * Photos is `events` on disk. That is deliberate: the route has to match the
 * website's URL (`/events/**`) for a universal link to land on the right screen,
 * and the *label* is what a parishioner reads. The website calls that page "Our
 * activities" for the same reason — the collection is called programs, the page
 * is called something a person would say.
 */
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabLayout() {
  const theme = useTheme();

  const icon = (name: IconName) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <Icon name={name} color={color} size={size} />;
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.inkFaint,
        tabBarStyle: {
          backgroundColor: theme.color.paperRaised,
          borderTopColor: theme.color.rule,
        },
        tabBarLabelStyle: { fontFamily: theme.fontFamily.ui },
        headerStyle: { backgroundColor: theme.color.deep },
        headerTintColor: theme.color.inkInverse,
        headerTitleStyle: {
          fontFamily: theme.fontFamily.ui,
          fontSize: theme.fontSize.subheading,
        },
        sceneStyle: { backgroundColor: theme.color.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('door') }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: icon('calendar') }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Photos',
          tabBarIcon: icon('photos'),
          // The tab holds a stack, and that stack titles itself from the level
          // it is showing. Two headers would be two titles.
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: icon('grip') }}
      />
    </Tabs>
  );
}
