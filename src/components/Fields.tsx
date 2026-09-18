/**
 * The bits of chrome every dialog and every form in this app is built from.
 *
 * ---------------------------------------------------------------------------
 * Why a centred modal here, when the announcements tray argues against one.
 *
 * `AnnouncementsTray` hangs its panel off the bell and says why: a centred
 * modal "is a different promise — it is the app stopping to ask something".
 * That is exactly what both of these are. Opening an entry is a request to be
 * told everything about it, and adding one is a form; neither came out of a
 * corner, and neither is transient. The two shapes disagreeing is the point.
 * ---------------------------------------------------------------------------
 *
 * This lived in `src/calendar/` while the calendar was the only thing in the
 * app with a text input in it, under a note that said to move it up "when the
 * forms screen needs them". The forms screen needs them: every question
 * somebody answers and every box the builder edits is one of these, so the
 * guess about the second caller has been replaced by the second caller.
 *
 * What that adds over the calendar's three: `Check` for a box that is ticked,
 * `Choice` for one-of/any-of with prices beside the options, and `Picker` for
 * the thing a `<select>` is on the web — a button that opens a sheet, because a
 * phone has no dropdown and a wheel picker cannot be read before it is opened.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { Label, Micro, Small } from '@/components/Type';
import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/** Wide enough for a form on a tablet, and no wider than reading comfortably. */
const MAX_SHEET_WIDTH = 520;

/**
 * How much of the window the keyboard is covering, in points.
 *
 * A `KeyboardAvoidingView` with `behavior="padding"` was doing this, and for a
 * *centred* dialog it does the wrong thing. Padding under a box that is
 * centred in the screen does not shrink the box, it moves it: the card rose by
 * the whole height of the keyboard, so the checkout — the one sheet tall
 * enough for it to matter — went up past the top of the screen and took its
 * own heading with it.
 *
 * The card should not move. What should change is how much room it is allowed,
 * so that it stays centred in whatever the keyboard has left. That needs the
 * number, hence this.
 *
 * Measured against the *window* and not the screen, which is what keeps
 * Android honest: with `adjustResize` the window has already shrunk by the
 * time this fires, so the subtraction comes out at nought there and the same
 * keyboard is not counted twice.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const covered = (event: KeyboardEvent) => {
      setInset(Math.max(0, Dimensions.get('window').height - event.endCoordinates.screenY));
    };
    const gone = () => setInset(0);

    // iOS fires `will*` in step with the animation, so the sheet resizes with
    // the keyboard rather than after it. Android only has `did*`.
    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillChangeFrame', covered),
            Keyboard.addListener('keyboardWillHide', gone),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', covered),
            Keyboard.addListener('keyboardDidHide', gone),
          ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return inset;
}

/**
 * A dialog: a scrim, a card, and a way out of it.
 *
 * `onRequestClose` is what gives Android's back gesture the same effect as the
 * close button, which is the native equivalent of the website relying on
 * `<dialog>`'s own Escape handling. There is no equivalent on iOS, which is why
 * the scrim is pressable as well — that is the gesture an iPhone user tries.
 */
export function Sheet({
  open,
  onClose,
  label,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Announced when the dialog takes focus. The entry's title, usually. */
  label: string;
  /**
   * The title row — and with it the ✕ — pinned above the scroller instead of
   * scrolled along with everything else.
   *
   * Every sheet in the app already opened with the same row, and putting it
   * inside the scroller meant the way out scrolled away: on a long one, the
   * basket and the checkout especially, leaving took a scroll back to the top
   * first. A dismissal that has to be hunted for is not a dismissal. The scrim
   * and Android's back gesture were always there, but neither is discoverable,
   * and neither is what somebody reaches for.
   *
   * Optional only so a sheet with nothing to pin does not have to pass one.
   */
  header?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardInset();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  /*
   * The ceiling is on the scroller, not on the card, and that is not a
   * stylistic choice — it was a bug.
   *
   * With `maxHeight` on the card and a `ScrollView` inside it, the card has no
   * height of its own to give and the scroller has none to take, so the two
   * negotiate one about sixteen points short of the content: every sheet
   * opened clipped, with its last line scrolled just out of sight and nothing
   * to say so. A `ScrollView` with a `maxHeight` sizes to its content until it
   * reaches it, which is exactly what a dialog wants — as tall as what is in
   * it, never taller than the screen it is centred in.
   *
   * Which is also why the pinned header is subtracted by hand rather than left
   * to Yoga: the ceiling belongs to the scroller, so the card's real height is
   * the ceiling *plus* the header, and a header that was not taken off the top
   * would push that much of the sheet off the screen.
   *
   * The floor is for the landscape phone with a keyboard up, where 85% of what
   * is left is barely a line. Something short and scrollable beats a sliver.
   */
  const ceiling = Math.max(80, (height - keyboard) * 0.85 - headerHeight);

  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/*
          The scrim, as its own layer behind the card rather than as the card's
          parent. A press that lands on a *parent* is a press that lands on
          every gap inside the card as well — the padding between two fields
          would dismiss a half-typed form.
        */}
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
            accessibilityLabel={label}
            style={{
              width: '100%',
              maxWidth: MAX_SHEET_WIDTH,
              backgroundColor: theme.color.paperRaised,
              borderColor: theme.color.rule,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
            }}
          >
            {header ? (
              <View
                onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
                style={{
                  paddingHorizontal: theme.space.md,
                  paddingTop: theme.space.md,
                  paddingBottom: theme.space.sm,
                  backgroundColor: theme.color.paperRaised,
                  /*
                    Drawn only once there is something underneath it to
                    separate. A rule under the title of a sheet that fits on
                    the screen is a line across a card for no reason; a rule
                    over content sliding beneath it is the whole reason.
                  */
                  borderBottomWidth: 1,
                  borderBottomColor: scrolled ? theme.color.rule : 'transparent',
                }}
              >
                {header}
              </View>
            ) : null}

            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1, maxHeight: ceiling }}
              contentContainerStyle={{
                padding: theme.space.md,
                paddingTop: header ? theme.space.sm : theme.space.md,
                gap: theme.space.md,
              }}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 1)}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The dismissal in the corner of a dialog, where every phone puts one. */
export function Close({ onPress, what }: { onPress: () => void; what: string }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Close ${what}`}
      hitSlop={theme.space.sm}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Small color={theme.color.inkFaint}>✕</Small>
    </Pressable>
  );
}

/**
 * One labelled input.
 *
 * `Label` above rather than a placeholder standing in for one: a placeholder
 * disappears the moment somebody types, which leaves a half-filled form whose
 * fields are unnamed. The placeholders here are examples instead, as on the
 * website.
 */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  lines = 1,
  keyboard = 'default',
  invalid = false,
  hint,
  error,
  required = false,
  onBlur,
  autoCapitalize,
  autoComplete,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** More than one turns it into a textarea. */
  lines?: number;
  keyboard?:
    | 'default'
    | 'numbers-and-punctuation'
    | 'numeric'
    | 'email-address'
    | 'phone-pad'
    | 'url';
  invalid?: boolean;
  hint?: string;
  /**
   * The problem with this answer, under the box it is about.
   *
   * A sentence rather than a boolean, for the reason the website's `FieldInput`
   * gives at length: a red border is not an error message. It is invisible to a
   * screen reader, it says nothing about what is wrong, and on a long form it
   * means holding a summary in your head while you scroll.
   */
  error?: string | null;
  required?: boolean;
  onBlur?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'name' | 'email' | 'tel' | 'off';
  /**
   * Shown, and not editable.
   *
   * For a value the screen has to display because it matters and must not
   * change here — a built-in form's address, which the car park tags point at.
   * Greyed rather than hidden: "you cannot edit this" is a different and more
   * useful thing to say than pretending the field does not exist.
   */
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const multiline = lines > 1;
  const wrong = invalid || (error ?? null) !== null;

  return (
    <View style={{ gap: theme.space.xs, flex: 1 }}>
      <Label>{required ? `${label.toUpperCase()} *` : label.toUpperCase()}</Label>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!readOnly}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.color.inkFaint}
        multiline={multiline}
        keyboardType={keyboard}
        autoCapitalize={autoCapitalize ?? (keyboard === 'default' ? 'sentences' : 'none')}
        autoCorrect={keyboard === 'default'}
        autoComplete={autoComplete}
        accessibilityLabel={label}
        /*
         * Announced together, in reading order, because `aria-describedby`'s
         * job has to be done by hand here: RN has one hint slot per view, so
         * the hint and the error are joined rather than one replacing the
         * other. Dropping the hint the moment something is wrong loses the
         * sentence that explains the format — which is usually the fix.
         */
        accessibilityHint={[hint, error].filter(Boolean).join(' ') || undefined}
        style={{
          color: theme.color.ink,
          fontFamily: theme.fontFamily.body,
          fontSize: theme.fontSize.body,
          lineHeight: lineHeightFor(theme, 'body'),
          backgroundColor: readOnly ? theme.color.paperSunken : theme.color.paper,
          borderColor: wrong ? theme.color.accent : theme.color.rule,
          borderWidth: 1,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.sm,
          minHeight: multiline ? 44 * lines : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint ? <Micro color={theme.color.inkFaint}>{hint}</Micro> : null}
      {error ? <Micro color={theme.color.accentStrong}>{error}</Micro> : null}
    </View>
  );
}

/** Two fields side by side, as the website's `__pair` does it. */
export function Pair({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', gap: theme.space.sm }}>{children}</View>;
}

/** A problem with the form, or with what the database said about it. */
export function Problem({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={{
        borderColor: theme.color.accent,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
        padding: theme.space.sm,
        backgroundColor: theme.color.accentSoft,
      }}
    >
      <Small color={theme.color.accentStrong}>{children}</Small>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* The three controls a form needs that a dialog never did                     */
/* -------------------------------------------------------------------------- */

/**
 * A box that is ticked, and the sentence that is ticking it.
 *
 * The whole row is the target, not a 20pt square at the start of it. That is
 * most of the difference between a consent field being answerable on a phone
 * and not, and it is what the website's `.field--check` buys by wrapping the
 * input in its label.
 */
export function Check({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.sm,
        paddingVertical: theme.space.xs,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        borderRadius: theme.radius.sm,
        minHeight: 44,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 2,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: checked ? theme.color.accent : theme.color.rule,
          backgroundColor: checked ? theme.color.accent : theme.color.paper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={14} color={theme.color.inkInverse} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Small color={theme.color.ink}>{label}</Small>
        {hint ? <Micro color={theme.color.inkFaint}>{hint}</Micro> : null}
      </View>
    </Pressable>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** Shown on the right of the row — "$40.00". Empty for an unpriced option. */
  note?: string;
}

/**
 * One of many, or any of many, with every option on screen.
 *
 * A list of rows rather than a wheel or a dropdown: a form asking which week
 * somebody can serve is a question whose options are the answer, and a control
 * that hides them until it is opened makes the reader work to find out what
 * they are being offered. `Picker` below is for the case where that trade goes
 * the other way — a long list where only the chosen value matters.
 */
export function Choice({
  label,
  options,
  chosen,
  onChange,
  multiple = false,
  hint,
  error,
  required = false,
  labelHidden = false,
}: {
  label: string;
  options: readonly ChoiceOption[];
  /** The values currently on. One entry for a single choice, any number for many. */
  chosen: readonly string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /**
   * Keep the name for a screen reader and take it off the screen.
   *
   * For `Picker`'s sheet, which has already put the question in its own header
   * — printing it twice, three lines apart, reads as a rendering mistake. The
   * group keeps its accessible name either way, because a list of options with
   * no question attached is exactly what it must not become.
   */
  labelHidden?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ gap: theme.space.xs }}
    >
      {labelHidden ? null : (
        <Label>{required ? `${label.toUpperCase()} *` : label.toUpperCase()}</Label>
      )}

      <View style={{ gap: theme.space.xs }}>
        {options.map((option) => {
          const on = chosen.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={option.note ? `${option.label}, ${option.note}` : option.label}
              onPress={() => {
                if (!multiple) {
                  onChange([option.value]);
                  return;
                }
                onChange(
                  on ? chosen.filter((entry) => entry !== option.value) : [...chosen, option.value],
                );
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                minHeight: 44,
                paddingHorizontal: theme.space.sm,
                paddingVertical: theme.space.xs,
                borderWidth: 1,
                borderColor: on ? theme.color.accent : theme.color.rule,
                backgroundColor: on
                  ? theme.color.accentSoft
                  : pressed
                    ? theme.color.accentSoft
                    : theme.color.paper,
                borderRadius: theme.radius.sm,
              })}
            >
              {/* Round for one-of, square for any-of — the shape is the only
                  thing telling somebody whether picking a second will replace
                  the first, and it is the one every phone has already taught. */}
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: multiple ? theme.radius.sm : Math.min(theme.radius.full, 10),
                  borderWidth: 1,
                  borderColor: on ? theme.color.accent : theme.color.rule,
                  backgroundColor: on ? theme.color.accent : theme.color.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Icon name="check" size={12} color={theme.color.inkInverse} /> : null}
              </View>

              <Small color={theme.color.ink}>{option.label}</Small>
              <View style={{ flex: 1 }} />
              {option.note ? <Micro color={theme.color.inkSoft}>{option.note}</Micro> : null}
            </Pressable>
          );
        })}
      </View>

      {hint ? <Micro color={theme.color.inkFaint}>{hint}</Micro> : null}
      {error ? <Micro color={theme.color.accentStrong}>{error}</Micro> : null}
    </View>
  );
}

/**
 * What a `<select>` is on the web: a button showing the current value, and a
 * sheet of the options when it is pressed.
 *
 * Deliberately not a wheel. `@react-native-picker/picker` is a dependency this
 * app does not have, its iOS form is a drum that shows three options at a time,
 * and neither platform's version can be read at all until it is opened. A sheet
 * is the same number of taps and shows the whole list.
 *
 * An empty `value` renders the placeholder, which is the "Choose…" first option
 * the website keeps even on a required field — so that a form asking "which
 * service?" cannot arrive claiming everybody wanted the first one.
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  hint,
  error,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly ChoiceOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? null;

  return (
    <View style={{ gap: theme.space.xs, flex: 1 }}>
      <Label>{required ? `${label.toUpperCase()} *` : label.toUpperCase()}</Label>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label ?? placeholder }}
        accessibilityState={{ disabled }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          minHeight: 44,
          paddingHorizontal: theme.space.sm,
          borderWidth: 1,
          borderColor: (error ?? null) !== null ? theme.color.accent : theme.color.rule,
          borderRadius: theme.radius.sm,
          backgroundColor: pressed ? theme.color.accentSoft : theme.color.paper,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <Small color={current ? theme.color.ink : theme.color.inkFaint}>
          {current?.label ?? placeholder}
        </Small>
        <View style={{ flex: 1 }} />
        {current?.note ? <Micro color={theme.color.inkSoft}>{current.note}</Micro> : null}
        <Icon name="chevron" size={16} color={theme.color.inkFaint} />
      </Pressable>

      {hint ? <Micro color={theme.color.inkFaint}>{hint}</Micro> : null}
      {error ? <Micro color={theme.color.accentStrong}>{error}</Micro> : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        header={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Label>{label.toUpperCase()}</Label>
            </View>
            <Close onPress={() => setOpen(false)} what={label} />
          </View>
        }
      >
        <Choice
          label={label}
          labelHidden
          options={options}
          chosen={value ? [value] : []}
          onChange={(next) => {
            onChange(next[0] ?? '');
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}
