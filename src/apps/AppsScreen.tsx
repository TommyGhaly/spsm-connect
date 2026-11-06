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
 * ## Drawn the way the App Clip draws it
 *
 * `ios-appclip/SPSMConnectClip/AppsView.swift` is the model, and the two should
 * stay recognisably the same screen:
 *
 * - **A deep band first, holding all three icons.** The icon is what somebody
 *   will look for in a store and on a home screen — the shape is learned here,
 *   not the name. Each icon scrolls to its own card.
 * - **A card per app to install,** with a stripe down the leading edge in the
 *   app's tone, an eyebrow saying whose it is, the sentence, and a row of chips
 *   that say what it holds in a word apiece — glanced at rather than read.
 * - **This app last, drawn dark,** as "the one you are using now". Where the
 *   clip offers to install it, this offers to pass it on: there is nothing to
 *   install, and `stores.ts` says why a badge here would only confuse.
 *
 * Cards arrive in turn, rising as they fade in; under Reduce Motion they are
 * simply there (Reanimated's layout animations follow the system setting).
 *
 * Everything here is static: the list is a literal in `stores.ts`, there is no
 * network call, and the only things fetched are the three app icons. The store
 * badges are in the binary — `components/StoreBadges.tsx` says why the rule
 * about fetching the website's pictures does not cover them.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { siteUrl } from '@/about/media';
import { Icon } from '@/components/Icon';
import { StoreBadges } from '@/components/StoreBadges';
import { Screen, useScroller } from '@/components/Surface';
import { Body, Heading, Label, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CHURCH_APPS, CONNECT_APP, type AppFeature, type ChurchApp } from './stores';

/** How each card arrives: in turn, a few points below where it lands. */
function rise(index: number) {
  return FadeInDown.delay(80 * index).duration(450);
}

/**
 * `footer` is a slot kept for anything that wants to add a row under the
 * cards. The App Clip used to pass one; it is native now and draws its own
 * screen, but the slot costs nothing and keeps this screen knowing nothing
 * about clips.
 */
export function AppsScreen({ footer }: { footer?: ReactNode } = {}) {
  const theme = useTheme();

  return (
    <Screen gap={theme.space.md}>
      <AppsContent />
      {footer}
    </Screen>
  );
}

/**
 * Everything inside the page, as its own component because `useScroller` is
 * provided *by* `Screen` and can only be read beneath it. The fragment keeps
 * each card a direct child of the scroll content, so a card's layout `y` is
 * its offset there and the hero's icons can scroll straight to it.
 */
function AppsContent() {
  const theme = useTheme();
  const scroller = useScroller();
  /** Where each card starts in the scroll content, by app name. */
  const tops = useRef<Record<string, number>>({});

  const jump = (name: string) => {
    const y = tops.current[name];
    if (y === undefined) return;
    scroller?.ref.current?.scrollTo({ y: Math.max(0, y - theme.space.gutter), animated: true });
  };

  return (
    <>
      <Animated.View entering={rise(0)}>
        <AppsHero onJump={jump} />
      </Animated.View>

      {CHURCH_APPS.map((app, index) => (
        <Animated.View
          key={app.name}
          entering={rise(index + 1)}
          onLayout={(event) => {
            tops.current[app.name] = event.nativeEvent.layout.y;
          }}
        >
          <AppCard app={app} />
        </Animated.View>
      ))}

      <Animated.View
        entering={rise(CHURCH_APPS.length + 1)}
        onLayout={(event) => {
          tops.current[CONNECT_APP.name] = event.nativeEvent.layout.y;
        }}
      >
        <ConnectCard />
      </Animated.View>
    </>
  );
}

/**
 * The band the screen opens on: the three icons side by side over the
 * church's deep red, each one a button down to its card.
 */
function AppsHero({ onJump }: { onJump: (name: string) => void }) {
  const theme = useTheme();
  const icons = [
    ...CHURCH_APPS.map((app) => ({ name: app.name, icon: app.icon })),
    { name: CONNECT_APP.name, icon: CONNECT_APP.icon },
  ];

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        padding: theme.space.md + 2,
        gap: theme.space.md - 2,
        backgroundColor: theme.color.deep,
        experimental_backgroundImage: `linear-gradient(135deg, ${theme.color.deep}, ${theme.color.accentStrong})`,
      }}
    >
      {/* A gold ring, half off the corner: the one ornament on the screen, and
          it is the colour of the eyebrow it sits above. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          top: -60,
          right: -50,
          width: 140,
          height: 140,
          borderRadius: theme.radius.full,
          borderWidth: 1.5,
          borderColor: theme.color.gold,
          opacity: 0.35,
        }}
      />

      <View style={{ gap: theme.space.xs + 2 }}>
        <Label color={theme.color.gold}>On your phone</Label>
        <Heading color={theme.color.inkInverse}>Three apps, one church</Heading>
        <Body color={theme.color.goldSoft}>
          Two to install, and the one you are holding now.
        </Body>
      </View>

      <View style={{ flexDirection: 'row', paddingTop: theme.space.xs }}>
        {icons.map((item) => (
          <Pressable
            key={item.name}
            onPress={() => onJump(item.name)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityHint="Shows where to get it"
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: theme.space.sm,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <AppIcon path={item.icon} size={60} />
            <Small color={theme.color.inkInverse} align="center" numberOfLines={2}>
              {item.name}
            </Small>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** One app to install: the stripe, the icon and name, a sentence, chips, badges. */
function AppCard({ app }: { app: ChurchApp }) {
  const theme = useTheme();
  const router = useRouter();
  // Pulled out of `app` so the null check below narrows inside the press
  // handler too — `app.more` is a property read and TypeScript widens it again
  // in the closure.
  const more = app.more;
  const tone = theme.color[app.tone];
  const soft = app.tone === 'gold' ? theme.color.goldSoft : theme.color.azureSoft;
  /*
   * The eyebrow is `accent` on the church's own app rather than the stripe's
   * gold: gold is about 2.9:1 on paper, which is a stripe and not small type —
   * the rule `ContactScreen`'s `Head` keeps. Azure reads, so Tithe.ly's keeps
   * its own colour.
   */
  const eyebrow = app.tone === 'gold' ? theme.color.accent : tone;

  return (
    <View
      style={{
        backgroundColor: theme.color.paperRaised,
        borderColor: theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        padding: theme.space.md,
        paddingLeft: theme.space.md + theme.space.xs,
        gap: theme.space.md - 4,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }}
      />

      <View style={{ flexDirection: 'row', gap: theme.space.md - 2, alignItems: 'center' }}>
        <AppIcon path={app.icon} size={64} />
        <View style={{ flex: 1, gap: 3 }}>
          {/* The publisher, only when it is somebody else: "by Tithe.ly" tells
              somebody why the app they are about to install is not named after
              this church. The church's own says so instead. */}
          <Label color={eyebrow}>{app.by ? `By ${app.by}` : 'The church’s own'}</Label>
          <Subheading>{app.name}</Subheading>
        </View>
      </View>

      <Body color={theme.color.inkSoft}>{app.what}</Body>

      <View
        accessible
        accessibilityLabel={app.features.map((feature) => feature.label).join(', ')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
      >
        {app.features.map((feature) => (
          <FeatureChip key={feature.label} feature={feature} tone={tone} soft={soft} />
        ))}
      </View>

      {/* A hairline, because the badges are artwork and not this card's type:
          without it the black pills sit directly under the chips and read as
          more of them rather than as the thing to tap. */}
      <View style={{ height: 1, backgroundColor: theme.color.rule }} />

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
            gap: theme.space.xs,
            opacity: pressed ? 0.6 : 1,
            minHeight: 44,
          })}
        >
          <Small color={theme.color.accent}>{more.label}</Small>
          <Icon name="next" size={16} color={theme.color.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FeatureChip({ feature, tone, soft }: { feature: AppFeature; tone: string; soft: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: theme.radius.full,
        backgroundColor: soft,
      }}
    >
      <Icon name={feature.icon} size={14} color={tone} />
      <Small color={theme.color.ink}>{feature.label}</Small>
    </View>
  );
}

/**
 * This app, drawn dark: the one the reader is holding. What it holds, and a
 * way to pass it on — the share sheet with this platform's store link, which
 * is the useful thing to do with an app you already have.
 */
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
    <View
      style={{
        backgroundColor: theme.color.deep,
        borderRadius: theme.radius.lg,
        padding: theme.space.md + 2,
        gap: theme.space.md - 2,
      }}
    >
      <View style={{ flexDirection: 'row', gap: theme.space.md - 2, alignItems: 'center' }}>
        <AppIcon path={CONNECT_APP.icon} size={64} />
        <View style={{ flex: 1, gap: theme.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LiveDot />
            <Label color={theme.color.gold}>You are using it now</Label>
          </View>
          <Heading color={theme.color.inkInverse}>SPSM Connect</Heading>
        </View>
      </View>

      <Body color={theme.color.goldSoft}>
        The parish’s calendar, galleries, forms and bookstore in one place — for everyone, not only
        servants.
      </Body>

      <View
        accessible
        accessibilityLabel={CONNECT_APP.features.map((feature) => feature.label).join(', ')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}
      >
        {CONNECT_APP.features.map((feature) => (
          <View
            key={feature.label}
            style={{
              // Two to a row: half the width, less half the gap.
              width: '48%',
              flexGrow: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.sm,
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.accentStrong,
            }}
          >
            <Icon name={feature.icon} size={18} color={theme.color.gold} />
            <Small color={theme.color.inkInverse} numberOfLines={1}>
              {feature.label}
            </Small>
          </View>
        ))}
      </View>

      <Pressable
        onPress={share}
        accessibilityRole="button"
        accessibilityHint="Opens the share sheet with the app’s store link"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
          minHeight: 44,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.color.gold,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Small color={theme.color.gold}>
          Share it with somebody
        </Small>
        <Icon name="arrow" size={16} color={theme.color.gold} />
      </Pressable>

      <Small color={theme.color.goldSoft}>
        Free, and from the church’s own developer account.
      </Small>
    </View>
  );
}

/** A small gold dot that breathes: "this one is running". Still, under Reduce Motion. */
function LiveDot() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 7, height: 7 }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: theme.radius.full,
            backgroundColor: theme.color.gold,
            opacity: 0.4,
          },
          halo,
        ]}
      />
      <View style={{ flex: 1, borderRadius: theme.radius.full, backgroundColor: theme.color.gold }} />
    </View>
  );
}

/**
 * One app's icon, rounded at a quarter of its size as a home screen rounds
 * one, over sunken paper that holds the row open while the file arrives.
 *
 * Decorative, hence hidden rather than described: the app's name is beside it,
 * and a screen reader announcing both says "Taksis Taksis". The hairline keeps
 * Tithe.ly's pale edge from dissolving into the card. The shadow is cast *by*
 * the icon on a wrapper, so the artwork itself is untouched.
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
        shadowColor: theme.color.ink,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
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
