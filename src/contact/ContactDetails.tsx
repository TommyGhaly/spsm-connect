/**
 * Address, phone, email, office hours.
 *
 * The website's `features/parish/ContactDetails.tsx`, with one thing added that
 * a phone makes possible: every row that can be acted on is a control. The
 * website renders a `tel:` link because a laptop can sometimes place a call;
 * here the phone number *is* the phone, so the row is a 44pt target that dials
 * and the address is a target that opens the map app.
 *
 * Every field still degrades on its own. A church that has published a phone
 * number but not office hours shows the phone number, not a half-empty list with
 * a blank row — so each block is conditional rather than the whole section being
 * all-or-nothing.
 *
 * The icons are the website's, in the website's gold, and they are doing work
 * rather than decorating: this is four labels of small caps followed by four
 * short values, and what you actually do with a contact list is scan it for the
 * phone rather than read it top to bottom. Hidden from the screen reader,
 * because each sits immediately before the word it illustrates.
 */
import { Linking, Pressable, View } from 'react-native';
import { hasParishDetails, type ParishConfig } from '@spsm/shared';

import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/Surface';
import { Body, Label, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { dialUrl, googleMapsUrl, mailUrl, postalAddress } from './config';

export function ContactDetails({ church }: { church: ParishConfig }) {
  const theme = useTheme();

  if (!hasParishDetails(church)) {
    return (
      <Card>
        <Subheading>Contact details aren&apos;t published yet</Subheading>
        <Body color={theme.color.inkSoft}>
          The church&apos;s address and phone number haven&apos;t been added yet. They&apos;ll
          appear here once the office fills them in.
        </Body>
      </Card>
    );
  }

  const address = postalAddress(church.address);
  const region = [church.address.city, church.address.state].filter(Boolean).join(', ');

  return (
    <View style={{ gap: theme.space.md }}>
      {address !== '' && (
        <Row
          icon="pin"
          label="ADDRESS"
          onPress={() => void Linking.openURL(googleMapsUrl(church))}
          hint="Opens the map"
        >
          <Body>{church.address.line1}</Body>
          {church.address.line2 !== '' && <Body>{church.address.line2}</Body>}
          <Body>{[region, church.address.postalCode].filter(Boolean).join(' ')}</Body>
        </Row>
      )}

      {church.phone !== '' && (
        <Row
          icon="phone"
          label="PHONE"
          onPress={() => void Linking.openURL(dialUrl(church.phone))}
          hint="Calls the church office"
        >
          <Body color={theme.color.accent}>{church.phone}</Body>
        </Row>
      )}

      {church.email !== '' && (
        <Row
          icon="mail"
          label="EMAIL"
          onPress={() => void Linking.openURL(mailUrl(church.email))}
          hint="Opens a new message"
        >
          <Body color={theme.color.accent}>{church.email}</Body>
        </Row>
      )}

      {church.officeHours !== '' && (
        <Row icon="clock" label="OFFICE HOURS">
          <Body>{church.officeHours}</Body>
        </Row>
      )}
    </View>
  );
}

/**
 * One labelled fact, and a target if there is something to do with it.
 *
 * Kept local — nothing outside this list has the shape. Office hours are the one
 * row with no action, so `onPress` is optional rather than every row being a
 * button: a control that does nothing when pressed is worse than a line of text,
 * because it promises.
 */
function Row({
  icon,
  label,
  hint,
  onPress,
  children,
}: {
  icon: IconName;
  label: string;
  /** What pressing it does, for a screen reader. */
  hint?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  const body = (
    <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-start' }}>
      {/* A fixed column, so the four labels line up down the left however long
          the values are. Hidden: the word beside it says the same thing. */}
      <View style={{ width: 20, paddingTop: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={icon} size={18} color={theme.color.gold} />
      </View>
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Label>{label}</Label>
        {children}
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      // 44pt is Apple's minimum target, and these rows are two short lines.
      style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
