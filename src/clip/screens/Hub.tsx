/**
 * What the clip shows when it was opened without an experience.
 *
 * One case reaches this: the App Clip card in Recents, which relaunches the
 * clip with no invocation URL at all. A tag always carries one.
 *
 * It is deliberately a menu of the same eight things rather than a "something
 * went wrong" — somebody who opened this had the clip on their phone a moment
 * ago and wanted one of these, and offering the list costs nothing this binary
 * was not already carrying.
 */
import { View } from 'react-native';

import { Card, Screen } from '@/components/Surface';
import { Body, Small, Subheading } from '@/components/Type';
import { PressableText } from '@/clip/PressableText';
import { EXPERIENCES, type ClipSlug } from '@/clip/experiences';
import { useTheme } from '@/theme/ThemeProvider';

export function Hub({ onOpen }: { onOpen: (slug: ClipSlug) => void }) {
  const theme = useTheme();

  return (
    <Screen>
      <Body color={theme.color.inkSoft}>
        Every one of these opens from a tag or a printed card at the church. Here
        they all are.
      </Body>

      {EXPERIENCES.map((entry) => (
        <Card key={entry.slug}>
          <Subheading>{entry.title}</Subheading>
          <Small color={theme.color.inkSoft}>{entry.card}</Small>
          <View style={{ alignItems: 'flex-start' }}>
            <PressableText
              label="Open"
              color={theme.color.accent}
              onPress={() => onOpen(entry.slug)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
