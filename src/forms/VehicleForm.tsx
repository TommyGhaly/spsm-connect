/**
 * The parking registration, which is native to look at and posts to Taksis.
 *
 * A component rather than a field list because it needs two things the builder
 * has no vocabulary for: a repeating driver list, and a fixed colour set the
 * parking system matches on. It still goes through `submitForm` like every
 * other form — `formSubmit` sees `pushesToTaksis` on the stored definition and
 * forwards it to the other Firebase project, which is a thing no client of any
 * kind can do.
 *
 * The `drivers` answer is a JSON string, exactly as the website sends it. That
 * is not a shortcut: `FormAnswer` is a union a rule can check, a repeating
 * record is not one of its shapes, and the Function parses this field by name.
 * Change it here and it must change there in the same commit.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  MAX_DRIVERS,
  TAKSIS_COLORS,
  validateVehicleRegistration,
  type TaksisDriver,
  type VehicleRegistrationInput,
} from '@spsm/shared';

import { Check, Field, Pair, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { submitForm } from './data';

const EMPTY_DRIVER: TaksisDriver = { name: '', phone: '', has_taksis: false };

const EMPTY: VehicleRegistrationInput = {
  plate: '',
  make: '',
  model: '',
  color: '',
  drivers: [{ ...EMPTY_DRIVER }],
};

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed'; errors: string[] };

export function VehicleForm({ slug, confirmation }: { slug: string; confirmation: string }) {
  const theme = useTheme();
  const [input, setInput] = useState<VehicleRegistrationInput>(EMPTY);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function set<K extends keyof VehicleRegistrationInput>(
    key: K,
    value: VehicleRegistrationInput[K],
  ) {
    setInput((previous) => ({ ...previous, [key]: value }));
  }

  function setDriver(index: number, patch: Partial<TaksisDriver>) {
    setInput((previous) => ({
      ...previous,
      drivers: previous.drivers.map((driver, position) =>
        position === index ? { ...driver, ...patch } : driver,
      ),
    }));
  }

  async function send() {
    const found = validateVehicleRegistration(input);
    if (found.length > 0) {
      setStatus({ kind: 'failed', errors: found });
      return;
    }

    setStatus({ kind: 'sending' });
    const result = await submitForm({
      slug,
      answers: {
        plate: input.plate,
        make: input.make,
        model: input.model,
        color: input.color,
        drivers: JSON.stringify(input.drivers),
      },
      cardToken: null,
      verificationToken: null,
    });
    setStatus(result.ok ? { kind: 'sent' } : { kind: 'failed', errors: result.errors });
  }

  if (status.kind === 'sent') {
    return (
      <Card gap={theme.space.sm}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Icon name="check" size={24} color={theme.color.accent} />
          <Heading>Registration submitted</Heading>
        </View>
        <Body color={theme.color.inkSoft}>{confirmation}</Body>
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.space.md }}>
      {status.kind === 'failed' ? <Problem>{status.errors.join('\n')}</Problem> : null}

      <Label>THE VEHICLE</Label>

      <Field
        label="License plate"
        required
        value={input.plate}
        onChange={(value) => set('plate', value)}
        placeholder="e.g. 1ABC23"
        // The plate is not prose and the parking system matches on it, so the
        // keyboard is left uppercase and autocorrect off rather than helpfully
        // turning "1ABC23" into a word.
        autoCapitalize="characters"
        hint="Whatever is on the plate. The state is not needed."
      />

      <Pair>
        <Field
          label="Make"
          value={input.make}
          onChange={(value) => set('make', value)}
          placeholder="e.g. Toyota"
        />
        <Field
          label="Model"
          value={input.model}
          onChange={(value) => set('model', value)}
          placeholder="e.g. Camry"
        />
      </Pair>

      {/*
        Swatches rather than a dropdown of colour names. The set is fixed by
        Taksis and a colour is recognised faster than it is read — which is the
        whole job of this field on a phone in a car park.
      */}
      <View style={{ gap: theme.space.xs }}>
        <Label>COLOR</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
          {TAKSIS_COLORS.map((colour) => {
            const on = input.color === colour.value;
            return (
              <Pressable
                key={colour.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={colour.label}
                onPress={() => set('color', on ? '' : colour.value)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.xs,
                  minHeight: 44,
                  paddingHorizontal: theme.space.sm,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: on ? theme.color.accent : theme.color.rule,
                  backgroundColor:
                    on || pressed ? theme.color.accentSoft : theme.color.paper,
                })}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: Math.min(theme.radius.full, 9),
                    backgroundColor: colour.hex,
                    borderWidth: 1,
                    borderColor: theme.color.rule,
                  }}
                />
                <Small color={theme.color.ink}>{colour.label}</Small>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Label>DRIVERS</Label>

      {input.drivers.map((driver, index) => (
        <Card key={index} gap={theme.space.sm}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Label>{`DRIVER ${index + 1}`}</Label>
            </View>
            {index > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove driver ${index + 1}`}
                hitSlop={theme.space.sm}
                onPress={() =>
                  setInput((previous) => ({
                    ...previous,
                    drivers: previous.drivers.filter((_, position) => position !== index),
                  }))
                }
              >
                <Small color={theme.color.accent}>Remove</Small>
              </Pressable>
            ) : null}
          </View>

          <Field
            label="Full name"
            required={index === 0}
            value={driver.name}
            onChange={(value) => setDriver(index, { name: value })}
            placeholder="First and last name"
            autoComplete={index === 0 ? 'name' : 'off'}
          />
          <Field
            label="Phone"
            required={index === 0}
            value={driver.phone}
            onChange={(value) => setDriver(index, { phone: value })}
            placeholder="(508) 555-0134"
            keyboard="phone-pad"
            autoComplete={index === 0 ? 'tel' : 'off'}
          />
          <Check
            label="This driver has the Taksis app installed (optional)"
            checked={driver.has_taksis}
            onChange={(next) => setDriver(index, { has_taksis: next })}
          />
        </Card>
      ))}

      {input.drivers.length < MAX_DRIVERS ? (
        <Button
          label="Add another driver"
          tone="quiet"
          onPress={() =>
            setInput((previous) => ({
              ...previous,
              drivers: [...previous.drivers, { ...EMPTY_DRIVER }],
            }))
          }
        />
      ) : null}

      <Button
        label={status.kind === 'sending' ? 'Submitting…' : 'Submit registration'}
        onPress={() => void send()}
        busy={status.kind === 'sending'}
      />
    </View>
  );
}
