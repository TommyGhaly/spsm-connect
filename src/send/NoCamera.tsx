/**
 * The camera tab before the camera is allowed — the Photos clip's start
 * screen, drawn again in the app.
 *
 * ## Why it copies the clip
 *
 * The clip's `PhotosView.swift` already worked this screen out for somebody
 * who does not use apps much: the ministry, a heading, then the website's
 * dashed `.submit-drop` box with the camera in it, then where the photo is
 * going, then three short facts. Somebody who met the clip at the church and
 * installed the app should find the same screen in the same order, not a grey
 * card that says "The camera".
 *
 * ## Two situations, one box
 *
 * `canAskAgain` means the system will still show its prompt, so the box asks.
 * Once it is false the app cannot ask at all, and the box says where the
 * switch is and opens Settings — a box that silently does nothing is worse
 * than no box.
 */
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Screen } from '@/components/Surface';
import { Icon, type IconName } from '@/components/Icon';
import { Body, Heading, Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { DestinationSheet } from './DestinationBar';
import { destinationLabel } from './destination';
import type { DestinationState } from './useDestination';

const PHONE = Platform.OS === 'ios' ? 'iPhone' : 'phone';

export function NoCamera({
  canAskAgain,
  onAsk,
  destination,
}: {
  canAskAgain: boolean;
  onAsk: () => void;
  destination: DestinationState;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const scheme = useColorScheme();
  const program = destination.destination?.programName;

  return (
    <Screen>
      {/* The camera tab has no header — the viewfinder runs to the top edge —
          so this card would otherwise sit under the status bar. */}
      <View style={{ height: insets.top }} />
      {/* The app's bar is light for the red header; this is bare paper.
          Only while focused, so the other tabs get theirs back. */}
      {focused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      <Card gap={theme.space.md - 2}>
        {program ? <Label color={theme.color.accent}>{program}</Label> : null}
        <Heading>Share a photo with the church</Heading>
        <TakeBox canAskAgain={canAskAgain} onAsk={onAsk} />
        <DestinationRow destination={destination} />
        <Body color={theme.color.inkSoft}>
          {`Photographs from ${program ?? 'the church'} are welcome — the moments the people running it are too busy to catch.`}
        </Body>
        <GoodToKnow />
      </Card>
    </Screen>
  );
}

/**
 * The website's `.submit-drop`, for a camera instead of a file picker: a
 * tinted box with a dashed edge, a red camera ringed in gold, the call in
 * accent and a faint line under it. The whole box is the button; pressed, the
 * edge goes solid — the site's `is-over`.
 */
function TakeBox({ canAskAgain, onAsk }: { canAskAgain: boolean; onAsk: () => void }) {
  const theme = useTheme();

  const title = canAskAgain ? 'Take a photo' : 'Turn on the camera';
  const hint = canAskAgain
    ? `Your ${PHONE} will ask to use the camera. Tap Allow.`
    : `The camera is turned off for SPSM Connect. Tap here, then turn on Camera.`;

  return (
    <Pressable
      onPress={canAskAgain ? onAsk : () => void Linking.openSettings()}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      accessibilityHint={canAskAgain ? 'Opens the camera' : 'Opens Settings'}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.lg,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.md + 2,
        borderWidth: 1,
        borderStyle: pressed ? 'solid' : 'dashed',
        borderColor: theme.color.accent,
        backgroundColor: theme.color.accentSoft,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radius.full,
          borderWidth: 2,
          borderColor: theme.color.gold,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.space.xs,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.full,
            backgroundColor: theme.color.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="camera" size={26} color={theme.color.inkInverse} />
        </View>
      </View>
      <Heading color={theme.color.accentStrong} align="center">
        {title}
      </Heading>
      <Small color={theme.color.inkSoft} align="center">
        {hint}
      </Small>
    </Pressable>
  );
}

/**
 * "Going to: Summer Camp · Week 1 ›". The clip's gold-edged row — the whole
 * row is the control, and it opens the same sheet the viewfinder's pill does.
 */
function DestinationRow({ destination }: { destination: DestinationState }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const line = !destination.ready
    ? 'Finding out what is happening…'
    : destination.destination
      ? destinationLabel(destination.destination)
      : 'The church is not collecting photographs';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Going to ${line}`}
        accessibilityHint="Choose a different event for your photo"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm + 4,
          padding: theme.space.sm + 4,
          paddingLeft: theme.space.md,
          borderRadius: theme.radius.md + 2,
          overflow: 'hidden',
          backgroundColor: theme.color.paperSunken,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: theme.color.gold,
          }}
        />
        <Icon name="photos" size={18} color={theme.color.gold} />
        <View style={{ flex: 1, gap: 2 }}>
          <Label color={theme.color.gold}>Going to</Label>
          <Body>{line}</Body>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Small color={theme.color.accent}>Change</Small>
          <Icon name="next" size={14} color={theme.color.accent} />
        </View>
      </Pressable>

      <DestinationSheet
        open={open}
        onClose={() => setOpen(false)}
        current={destination.destination}
        fallback={destination.fallback}
        overridden={destination.overridden}
        onChoose={(next) => {
          destination.choose(next);
          setOpen(false);
        }}
        onRevert={() => {
          destination.revert();
          setOpen(false);
        }}
      />
    </>
  );
}

/**
 * Three plain facts, said before anyone has to wonder. The clip's, with the
 * first one true of the app: holding the shutter records.
 */
function GoodToKnow() {
  const theme = useTheme();
  const lines: [IconName, string][] = [
    ['camera', 'Tap for a photo, or hold for a short video.'],
    ['photos', 'You see it before it sends, and can take it again.'],
    ['check', 'Someone from the church looks at every photo before it goes in the gallery.'],
  ];

  return (
    <View style={{ gap: theme.space.sm + 2 }} accessible>
      {lines.map(([icon, line]) => (
        <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm + 2 }}>
          <View style={{ width: 22, alignItems: 'center', paddingTop: 1 }}>
            <Icon name={icon} size={18} color={theme.color.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Small color={theme.color.inkSoft}>{line}</Small>
          </View>
        </View>
      ))}
    </View>
  );
}
