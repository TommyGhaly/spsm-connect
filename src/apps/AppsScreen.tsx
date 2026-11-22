/**
 * Our apps: which one you want, and which store to get it from.
 *
 * ---------------------------------------------------------------------------
 * The website's `/apps`, on a phone, and it exists here for the same reason it
 * exists there. "Download the app" was a thing said out loud and nowhere else:
 * Taksis has been on both stores for months, nothing linked either listing, and
 * somebody told to install it had to search a store for a word they had
 * only heard — and the App Store search for "taksis" is not a safe place to
 * send somebody.
 *
 * ## Why this screen is worth its row in the drawer when the reader is already
 * holding an app
 *
 * The two apps do different jobs and neither is this one. A servant needs
 * Taksis for a schedule that is not in here; a parent sets up a child's account
 * in it; somebody who wants to give on a standing schedule wants Tithe.ly's own
 * app rather than opening this one every month. The answer is genuinely "it
 * depends", which is a screen and not a link.
 *
 * ## Drawn as a plain native list
 *
 * Three grouped cards on the page, one per app, in the order the reader is
 * likely to want them, and nothing else: no gradient band, no ornament, no
 * stripe, no chips, no staggered entrance. The screen used to carry all of
 * those, and together they made it look like a generated landing page rather
 * than a screen in an app. What each app holds is one line of text under its
 * sentence, which is how the App Store itself says it.
 *
 * This app comes last, as "the one you are using now", and offers to pass it on
 * rather than to install it: `stores.ts` says why a badge here would confuse.
 *
 * Everything here is static: the list is a literal in `stores.ts`, there is no
 * network call, and the only things fetched are the three app icons. The store
 * badges are in the binary — `components/StoreBadges.tsx` says why the rule
 * about fetching the website's pictures does not cover them.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { siteUrl } from '@/about/media';
import { Icon } from '@/components/Icon';
import { StoreBadges } from '@/components/StoreBadges';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CHURCH_APPS, CONNECT_APP, type AppFeature, type ChurchApp } from './stores';

/** The screen, with an optional footer below the cards. */
export function AppsScreen({ footer }: { footer?: ReactNode } = {}) {
  const theme = useTheme();

  return (
    <Screen gap={theme.space.lg}>
      <View style={{ gap: theme.space.xs }}>
        <Heading>Three apps, one church</Heading>
        <Body color={theme.color.inkSoft}>Two to install, and the one you are holding now.</Body>
      </View>

      {CHURCH_APPS.map((app) => (
        <AppCard key={app.name} app={app} />
      ))}

      <ConnectCard />
      {footer}
    </Screen>
  );
}

/** "Schedules, attendance, children’s accounts and vehicles." */
function featureLine(features: readonly AppFeature[]): string {
  const words = features.map((feature, index) => (index === 0 ? feature.label : feature.label.toLowerCase()));
  const last = words[words.length - 1] ?? '';
  if (words.length < 2) return `${last}.`;
  // Tithe.ly's pair already carries its own conjunction: "Give once, or on a schedule."
  const join = last.startsWith('or ') ? ', ' : ' and ';
  return `${words.slice(0, -1).join(', ')}${join}${last}.`;
}

/** The icon beside the app's name and whose it is, as a store listing heads one. */
function AppTitle({ icon, name, by }: { icon: string; name: string; by: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'center' }}>
      <AppIcon path={icon} size={60} />
      <View style={{ flex: 1, gap: 2 }}>
        <Subheading>{name}</Subheading>
        <Small color={theme.color.inkFaint}>{by}</Small>
      </View>
    </View>
  );
}

/** One app to install: the icon and name, a sentence, what it holds, badges. */
function AppCard({ app }: { app: ChurchApp }) {
  const theme = useTheme();
  const router = useRouter();
  const more = app.more;

  return (
    <Card gap={theme.space.md}>
      {/* The publisher, only when it is somebody else: "Tithe.ly" tells
          somebody why the app they are about to install is not named after
          this church. The church's own says so instead. */}
      <AppTitle icon={app.icon} name={app.name} by={app.by ?? 'The church’s own app'} />

      <View style={{ gap: theme.space.xs }}>
        <Body>{app.what}</Body>
        <Small color={theme.color.inkSoft}>{featureLine(app.features)}</Small>
      </View>

      {/* The stores' own badges, as on the website — see `StoreBadges` for what
          may and may not be done to them. */}
      <StoreBadges ios={app.ios} android={app.android} appName={app.name} />

      {more ? (
        <Pressable
          onPress={() => router.push(more.href)}
          accessibilityRole="link"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.6 : 1,
            minHeight: 44,
          })}
        >
          <Body color={theme.color.accent}>{more.label}</Body>
          <Icon name="next" size={16} color={theme.color.inkFaint} />
        </Pressable>
      ) : null}
    </Card>
  );
}

/** This app: nothing to install, so it offers the share sheet instead. */
function ConnectCard() {
  const theme = useTheme();
  const url = Platform.OS === 'android' ? CONNECT_APP.android : CONNECT_APP.ios;

  const share = () => {
    void Share.share(
      Platform.OS === 'ios'
        ? { message: 'SPSM Connect, the church’s app', url }
        : { message: `SPSM Connect, the church’s app: ${url}` },
    );
  };

  return (
    <View style={{ gap: theme.space.sm }}>
      <Label>You are using it now</Label>
      <Card gap={theme.space.md}>
        <AppTitle icon={CONNECT_APP.icon} name="SPSM Connect" by="Free, from the church" />

        <View style={{ gap: theme.space.xs }}>
          <Body>
            The parish’s calendar, galleries, forms and bookstore in one place — for everyone, not only
            servants.
          </Body>
          <Small color={theme.color.inkSoft}>{featureLine(CONNECT_APP.features)}</Small>
        </View>

        <Button label="Share it with somebody" tone="quiet" onPress={share} />
      </Card>
    </View>
  );
}

/**
 * One app's icon, rounded at a quarter of its size as a home screen rounds
 * one, over sunken paper that holds the row open while the file arrives.
 *
 * Decorative, hence hidden rather than described: the app's name is beside it,
 * and a screen reader announcing both says "Taksis Taksis". The hairline keeps
 * Tithe.ly's pale edge from dissolving into the card.
 */
function AppIcon({ path, size }: { path: string; size: number }) {
  const theme = useTheme();
  const radius = size / 4;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
      }}
    >
      <Image
        source={siteUrl(path)}
        contentFit="cover"
        transition={200}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: theme.color.rule,
          borderWidth: 1,
          backgroundColor: theme.color.paperSunken,
        }}
      />
    </View>
  );
}
