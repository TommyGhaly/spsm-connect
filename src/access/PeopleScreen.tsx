/**
 * Who administers what — the directory half.
 *
 * The website draws this as two columns: the church's people down the left, the
 * allocation panel down the right, both on screen at once. A phone has room for
 * one, so the port is a list and a pushed screen — press a name, get their
 * areas, come back with the stack's own back button. The split is the same
 * split; only the axis changed.
 *
 * Which makes this screen's job narrower than the website's left column: it has
 * to say who has anything at all, so an administrator can find the person they
 * came for without opening six. That is what `tally` is under every name.
 *
 * ## There is no way to add anybody here
 *
 * A person appears in this list by signing in — `enforceTenantOnCreate` writes
 * their member document — and nothing in the app or on the site creates one.
 * So an administrator looking for somebody who is not here has to ask them to
 * open the app once, which is the sentence the empty state gives.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Field, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card, Screen } from '@/components/Surface';
import { Body, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { readDirectory, type AllocatableMember, type Directory } from './data';
import { tally } from './describe';

export function PeopleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setDirectory(await readDirectory());
      setError(null);
    } catch (cause) {
      console.error('[access] could not load the directory', cause);
      setError(
        cause instanceof Error ? cause.message : 'Could not read the church directory.',
      );
    }
  }, []);

  /*
   * On focus rather than on mount: a person's areas are a screen away, and
   * coming back from a save with the old tallies still under the names would
   * make the write look lost.
   */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shown = useMemo(() => {
    if (!directory) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return directory.members;
    return directory.members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle),
    );
  }, [directory, filter]);

  if (error) {
    return (
      <Screen>
        <Problem>{error}</Problem>
      </Screen>
    );
  }

  return (
    <Screen>
      <Body color={theme.color.inkSoft}>
        Give somebody one part of the church&rsquo;s app and website without giving them the
        rest. Changes take effect the next time they open it.
      </Body>

      {/*
        * Shown whatever the directory is doing, so the box does not appear
        * under the reader's thumb a beat after the screen does.
        */}
      <Field
        label="Find someone"
        value={filter}
        onChange={setFilter}
        placeholder="Name or email"
        autoCapitalize="none"
        autoComplete="off"
      />

      {directory === null ? (
        <Body color={theme.color.inkSoft}>Reading the church directory…</Body>
      ) : shown.length === 0 ? (
        <Body color={theme.color.inkSoft}>
          {directory.members.length === 0
            ? 'Nobody has signed in yet, so there is no one to give an area to. A person appears here the first time they sign in with their church Microsoft account.'
            : `No one matches “${filter.trim()}”.`}
        </Body>
      ) : (
        <Card gap={0}>
          {shown.map((member, index) => (
            <Person
              key={member.uid}
              member={member}
              last={index === shown.length - 1}
              onPress={() => router.push(`/access/${member.uid}` as Href)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

/**
 * One name, their address, and what they look after.
 *
 * A row in a single card with hairlines between, rather than a card each: this
 * is a menu of people and the grouped list is the shape a phone already draws
 * for one. `last` suppresses the hairline, which would otherwise sit
 * immediately above the card's own border and read as a doubled edge.
 */
function Person({
  member,
  last,
  onPress,
}: {
  member: AllocatableMember;
  last: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.color.rule,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${member.displayName}. ${tally(member)}.`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingVertical: theme.space.sm,
          backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
          // 44pt is Apple's minimum target and the reason this is not just
          // padding.
          minHeight: 44,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Small numberOfLines={1}>{member.displayName}</Small>
          <Micro color={theme.color.inkFaint} numberOfLines={1}>
            {member.email || 'no email on file'}
          </Micro>
          {/*
            * The saved state, not a draft: this is the answer to "has this
            * person got anything", which is what makes them worth opening.
            */}
          <Micro color={member.superadmin ? theme.color.accent : theme.color.inkSoft}>
            {tally(member)}
          </Micro>
        </View>
        <Icon name="next" color={theme.color.inkFaint} size={16} />
      </Pressable>
    </View>
  );
}
