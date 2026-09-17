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
 * ## Cards, stacked, rather than a grid of tiles
 *
 * Each card is an icon, a name, a sentence and two full-width buttons. Two of
 * those side by side on a phone are two columns of mostly air. Stacked, each
 * reads as a paragraph with a button in it, which is what it is.
 *
 * Everything here is static: the list is a literal in `stores.ts`, there is no
 * network call, and the only thing fetched is the two icons.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { siteUrl } from '@/about/media';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Subheading, Title } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CHURCH_APPS, type ChurchApp } from './stores';

/**
 * `footer` is for the App Clip, and it is the only thing on this screen that
 * differs between the two binaries.
 *
 * `stores.ts` deliberately lists the church's two *installable* apps and not
 * this one — its header says why: a card telling a reader about the app they
 * are already holding, and telling them there is nothing to install, is the one
 * entry that could only confuse them. **Inside an App Clip that is no longer
 * true.** The reader is holding a sample that will be gone in a few hours, they
 * came from a printed card that lists four things, and "the one you are using
 * now, and how to keep it" is the most useful row on the page.
 *
 * A slot rather than a flag, so that the exception lives in the clip's own code
 * — `src/clip/screens/Apps.tsx` — and this screen keeps knowing nothing about
 * App Clips. The full app passes nothing and is unchanged.
 */
export function AppsScreen({ footer }: { footer?: ReactNode } = {}) {
  const theme = useTheme();

  return (
    <Screen gap={theme.space.lg}>
      <View style={{ gap: theme.space.xs }}>
        <Label color={theme.color.accent}>On a phone</Label>
        <Title>Our apps</Title>
        <Lede color={theme.color.inkSoft}>
          Two to install: Taksis, which is the church’s own, and Tithe.ly, which the church uses for
          the offering. Both are on the App Store and on Google Play.
        </Lede>
      </View>

      <View style={{ gap: theme.space.md }}>
        {CHURCH_APPS.map((app) => (
          <AppCard key={app.name} app={app} />
        ))}
        {footer}
      </View>

      {/* Both stores are offered on both platforms, as on the website, and this
          says why rather than leaving an iPhone reader wondering what the second
          button is for: somebody holding an iPhone is quite often the person
          setting up a parent's Android. */}
      <Small color={theme.color.inkFaint}>
        Both stores are listed for each app, so you can send the right link to somebody on the other
        kind of phone.
      </Small>
    </Screen>
  );
}

/** One app: its icon, its name, what it is for, and where to get it. */
function AppCard({ app }: { app: ChurchApp }) {
  const theme = useTheme();
  const router = useRouter();
  // Pulled out of `app` so the null check below narrows inside the press
  // handler too — `app.more` is a property read and TypeScript widens it again
  // in the closure.
  const more = app.more;

  return (
    <Card gap={theme.space.md}>
      <View style={{ flexDirection: 'row', gap: theme.space.md, alignItems: 'center' }}>
        {/*
          Decorative, hence hidden rather than described: the app's name is on
          the line beside it, and a screen reader announcing both says "Taksis
          Taksis". The fixed 64pt square also holds the column open while the
          file arrives, so the names do not jump left as the icons land.
        */}
        <Image
          source={siteUrl(app.icon)}
          contentFit="cover"
          transition={200}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.paperSunken,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Subheading>{app.name}</Subheading>
          {/* The publisher, only when it is somebody else. Saying "by the
              church" about the church's own app is noise; saying "by Tithe.ly"
              tells somebody why the app they are about to install is not
              named after this church — which is the difference between finding
              it in a store search and giving up. */}
          {app.by ? <Small color={theme.color.inkFaint}>by {app.by}</Small> : null}
        </View>
      </View>

      <Body color={theme.color.inkSoft}>{app.what}</Body>

      <View style={{ gap: theme.space.sm }}>
        {/* `Linking` rather than the in-app browser, and rather than the stores'
            own badge artwork — both calls are made and explained at length on
            the Tithe.ly card in `giving/GivingScreen.tsx`. The short of it: a
            store address is handled by the store app itself, and a button that
            does not use the vendors' artwork cannot misuse it. */}
        <Button
          label="App Store"
          tone="quiet"
          onPress={() => void Linking.openURL(app.ios)}
        />
        <Button
          label="Google Play"
          tone="quiet"
          onPress={() => void Linking.openURL(app.android)}
        />
      </View>

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
    </Card>
  );
}
