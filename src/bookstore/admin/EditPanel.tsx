/**
 * The shop editor's frame, its tabs, and the one way it saves.
 *
 * ---------------------------------------------------------------------------
 * The website's `components/EditTabs` and `components/SaveFooter`, and the
 * column they sit in, for a phone.
 *
 * Every editor on the website now saves the same way: changes are held, a
 * footer says "Unsaved changes — Discard / Save changes", and leaving with
 * changes held is refused with a line saying so. Tommy chose it over autosave
 * and over per-field buttons after clothing sizes were ticked and never saved
 * because the bookstore had two ways of saving at once. One button, in the same
 * place with the same words, is the fix for that whole class of mistake — so
 * the words here are the website's, exactly.
 *
 * The column becomes a sheet over the shelf, as tall as the screen allows and
 * no taller, because a phone has no side to put a column on. A fixed height
 * rather than `Sheet`'s fit-to-content, so that changing tab does not make the
 * sheet jump, and so the footer can be pinned to its foot.
 * ---------------------------------------------------------------------------
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Close, MAX_SHEET_WIDTH, useKeyboardInset } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The sheet itself: a header with the way back and the way out, and whatever
 * view is open below it — tabs, a scrolling body, a footer.
 */
export function EditorFrame({
  kind,
  title,
  onBack,
  backLabel,
  onClose,
  notice,
  children,
}: {
  /** "Item", "Shop" — so the sheet changing contents does not read as a fault. */
  kind: string;
  title: string;
  /** Up one level — "All items". Absent at the top. */
  onBack?: () => void;
  backLabel?: string;
  /** Done. Refusing is the caller's: it decides whether there is unsaved work. */
  onClose: () => void;
  /** A refusal, or a line saying why leaving was refused. */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardInset();

  return (
    <Modal visible onRequestClose={onClose} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.color.deep,
            opacity: 0.45,
          }}
        />

        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: theme.space.gutter,
            paddingBottom: keyboard,
          }}
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel={title}
            style={{
              width: '100%',
              maxWidth: MAX_SHEET_WIDTH,
              height: Math.max(240, (height - keyboard) * 0.88),
              backgroundColor: theme.color.paperRaised,
              borderColor: theme.color.rule,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                paddingHorizontal: theme.space.md,
                paddingTop: theme.space.md,
                paddingBottom: theme.space.sm,
                gap: theme.space.xs,
              }}
            >
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  hitSlop={theme.space.xs}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}
                >
                  <Icon name="prev" color={theme.color.accent} size={14} />
                  <Small color={theme.color.accent}>{backLabel ?? 'Back'}</Small>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                <View style={{ flex: 1, gap: theme.space.xs }}>
                  <Label>{kind}</Label>
                  <Heading numberOfLines={2}>{title}</Heading>
                </View>
                <Close onPress={onClose} what="the editor" />
              </View>
              {notice}
            </View>

            <View style={{ flex: 1 }}>{children}</View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The scrolling part of a view, between its tabs and its footer. */
export function PanelBody({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.space.md, gap: theme.space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** One block of a panel, under its small uppercase heading. */
export function PanelBlock({ label, children }: { label?: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      {label ? <Label>{label}</Label> : null}
      {children}
    </View>
  );
}

export interface EditTab<T extends string> {
  id: T;
  label: string;
  /** Holding unsaved changes: drawn as a dot. */
  dirty?: boolean;
}

/** A row of tabs, each with a dot while it holds unsaved changes. */
export function EditTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly EditTab<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.color.rule,
        paddingHorizontal: theme.space.sm,
      }}
    >
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.dirty ? `${tab.label}, unsaved changes` : tab.label}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 44,
              paddingHorizontal: theme.space.xs,
              borderBottomWidth: 2,
              borderBottomColor: on ? theme.color.accent : 'transparent',
              backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
            })}
          >
            <Small color={on ? theme.color.ink : theme.color.inkSoft} numberOfLines={1}>
              {tab.label}
            </Small>
            {tab.dirty ? (
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.accent }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * "Unsaved changes — Discard / Save changes". Always drawn, so where to save is
 * never a question: "All changes saved" when there is nothing to do. `problem`
 * names whatever blocks the save in words ("Type a sale price below $15.00"),
 * never just a disabled button.
 */
export function SaveFooter({
  dirty,
  saving,
  problem = null,
  error = null,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  /** Why Save cannot be pressed yet, or null. */
  problem?: string | null;
  /** The last save failed, and why. */
  error?: string | null;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const state = saving
    ? 'Saving…'
    : error
      ? error
      : !dirty
        ? 'All changes saved'
        : (problem ?? 'Unsaved changes');

  return (
    <View
      style={{
        gap: theme.space.sm,
        padding: theme.space.sm,
        borderTopWidth: 1,
        borderTopColor: error || dirty ? theme.color.accent : theme.color.rule,
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <Micro
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        color={error ? theme.color.accentStrong : dirty ? theme.color.accent : theme.color.inkFaint}
      >
        {state}
      </Micro>
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Discard" tone="quiet" onPress={onDiscard} disabled={!dirty || saving} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Save changes"
            onPress={onSave}
            disabled={!dirty || saving || Boolean(problem)}
            busy={saving}
          />
        </View>
      </View>
    </View>
  );
}
