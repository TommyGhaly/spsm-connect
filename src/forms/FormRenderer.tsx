/**
 * A form definition, filled in and sent.
 *
 * ---------------------------------------------------------------------------
 * Answers are kept for hidden fields, and dropped on the way out.
 *
 * State holds every answer the person has ever given, including for fields a
 * later change has hidden. `submissionAnswers` strips the hidden ones at the
 * boundary, so nothing hidden is validated, priced, or stored.
 *
 * Deleting an answer the moment its field disappears is worse in the case that
 * actually happens: somebody picks Sunday School, fills in the grade, wonders
 * whether they meant Choir, looks, and switches back. Under the delete rule
 * their grade is gone. Here it comes back.
 * ---------------------------------------------------------------------------
 *
 * ## Where the money is, and is not
 *
 * The total on screen is a preview. `computeTotalCents` runs here to draw it
 * and runs again inside `formSubmit` against the *stored* definition, and the
 * second is the one charged — there is deliberately nowhere in the request to
 * put an amount. That is the bookstore's safety property rebuilt for a
 * collection with no Square catalog behind it; both halves are the same
 * function from `@spsm/shared` so they cannot drift.
 *
 * The payment and the answers travel in one request. They have to: a form that
 * charged and then failed to save the submission would have taken somebody's
 * money for a registration the church has no record of.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  computeTotalCents,
  submissionAnswers,
  validateSubmissionFields,
  visibleFields,
  type FieldProblem,
  type FormAnswer,
  type FormAnswers,
  type FormDefinition,
} from '@spsm/shared';

import { Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Small } from '@/components/Type';
import { money } from '@/payments/money';
import {
  chargeWithCard,
  chargeWithWallet,
  paymentsAvailable,
  walletAvailable,
} from '@/payments/square';
import { useTheme } from '@/theme/ThemeProvider';

import { FieldInput } from './Fields';
import { submitForm, type SubmitResult } from './data';

type Stage =
  | { kind: 'filling' }
  | { kind: 'sending' }
  | { kind: 'done'; paid: boolean; total: number };

export function FormRenderer({
  form,
  initialAnswers,
}: {
  form: FormDefinition;
  /**
   * Answers the form opens with. Read once, on mount — a later change does not
   * reach back into a form somebody has started filling in.
   */
  initialAnswers?: FormAnswers;
}) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<FormAnswers>(() => ({ ...initialAnswers }));
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [stage, setStage] = useState<Stage>({ kind: 'filling' });

  /*
   * Whether to offer a wallet button beside the card one.
   *
   * Only asked on a form that charges, and that is not an optimisation. The
   * question initialises Square's SDK, and most church forms are free — a
   * contact form has no business loading a payments SDK, waking Apple Pay, or
   * (on a binary built without the pod) discovering that it is not there. The
   * answer is a property of the device rather than of the form, so once is
   * enough.
   */
  const [wallet, setWallet] = useState(false);
  useEffect(() => {
    if (!form.payment.enabled) return;

    let live = true;
    void walletAvailable().then((can) => {
      if (live) setWallet(can);
    });
    return () => {
      live = false;
    };
  }, [form.payment.enabled]);

  /** Message per field key, for the errors under each input. */
  const messages = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const problem of problems) {
      if (problem.key && !byKey.has(problem.key)) byKey.set(problem.key, problem.message);
    }
    return byKey;
  }, [problems]);

  const shown = useMemo(() => visibleFields(form.fields, answers), [form.fields, answers]);
  const total = useMemo(() => computeTotalCents(form, answers), [form, answers]);

  function set(key: string, value: FormAnswer) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
    // Clear this field's error the moment it is touched. Leaving it red while
    // somebody is actively fixing it is the form arguing with them.
    setProblems((previous) =>
      previous.some((problem) => problem.key === key)
        ? previous.filter((problem) => problem.key !== key)
        : previous,
    );
  }

  /**
   * Check one field when the person leaves it.
   *
   * On blur rather than on every keystroke: validating as somebody types tells
   * them their email is invalid when they have got as far as "m@", which is
   * true and useless. This only ever adds a problem for the field being left.
   */
  function checkOne(key: string) {
    const found = validateSubmissionFields(form, answers).filter((problem) => problem.key === key);
    setProblems((previous) => [...previous.filter((problem) => problem.key !== key), ...found]);
  }

  /** Everything the Function is sent, built once so the two paths cannot differ. */
  function payload(cardToken: string | null) {
    return {
      slug: form.slug,
      answers: submissionAnswers(form.fields, answers),
      cardToken,
      verificationToken: null,
    };
  }

  function report(result: SubmitResult) {
    if (!result.ok) {
      /*
       * The server's objections have no field keys — it answers with sentences,
       * because a key means nothing to a screen that may be out of date. They
       * go in the summary unattached, which is right: these are usually about
       * the submission as a whole rather than about one box.
       */
      setProblems(result.errors.map((message) => ({ key: null, message })));
      setStage({ kind: 'filling' });
      return;
    }
    setStage({ kind: 'done', paid: result.paymentId !== null, total: result.totalCents });
  }

  /** Validate. A free form goes straight off; a paid one waits for a sheet. */
  function check(): boolean {
    const found = validateSubmissionFields(form, answers);
    setProblems(found);
    return found.length === 0;
  }

  async function sendFree() {
    if (!check()) return;
    setStage({ kind: 'sending' });
    report(await submitForm(payload(null)));
  }

  /**
   * Pay, and submit inside the sheet.
   *
   * `chargeWithCard` and `chargeWithWallet` both run the request in Square's
   * own success callback, so a decline is shown on Square's sheet with the card
   * field still ready. A `null` back means the sheet was dismissed — an
   * ordinary outcome, and the form is left exactly as it was.
   */
  async function pay(how: 'wallet' | 'card') {
    if (!check()) return;
    setStage({ kind: 'sending' });

    const send = async (nonce: string): Promise<SubmitResult> => {
      const result = await submitForm(payload(nonce));
      /*
       * A refusal has to *throw* here, not resolve. These callbacks read a
       * thrown message as "the payment failed" and keep the sheet open with it
       * printed; returning quietly would close the sheet on a submission that
       * was never stored and never charged.
       */
      if (!result.ok) throw new Error(result.errors.join(' '));
      return result;
    };

    try {
      const result =
        how === 'wallet'
          ? await chargeWithWallet(
              (total / 100).toFixed(2),
              send,
              form.payment.label || form.title,
            )
          : await chargeWithCard(send);

      if (!result) {
        // Dismissed, or no wallet on this device after all. Back to the form
        // with nothing said: the person closed the sheet on purpose.
        setStage({ kind: 'filling' });
        return;
      }
      report(result);
    } catch (error) {
      setProblems([
        {
          key: null,
          message:
            error instanceof Error
              ? error.message
              : 'The payment could not be completed. Nothing has been charged.',
        },
      ]);
      setStage({ kind: 'filling' });
    }
  }

  if (stage.kind === 'done') {
    return (
      <Card gap={theme.space.sm}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Icon name="check" size={24} color={theme.color.accent} />
          <Heading>Submitted</Heading>
        </View>
        <Body color={theme.color.inkSoft}>{form.confirmationMessage}</Body>
        {stage.paid ? (
          <Body color={theme.color.inkSoft}>
            Your card has been charged {money(stage.total)}. Square will email you a receipt.
          </Body>
        ) : null}
      </Card>
    );
  }

  const sending = stage.kind === 'sending';

  return (
    <View style={{ gap: theme.space.md }}>
      {problems.length > 0 ? (
        <Problem>
          {/* One box, listing everything, above the fields — the same summary
              the website puts at the top of the form. Each field also carries
              its own message, so this is the overview rather than the only
              place the problem is stated. */}
          {problems.map((problem) => problem.message).join('\n')}
        </Problem>
      ) : null}

      {shown.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={answers[field.key]}
          error={messages.get(field.key) ?? null}
          onChange={(value) => set(field.key, value)}
          onBlur={() => checkOne(field.key)}
          formSlug={form.slug}
        />
      ))}

      {form.payment.enabled ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: theme.space.sm,
            borderTopColor: theme.color.rule,
            borderTopWidth: 1,
          }}
          // The number changing is the whole point of a priced option, so it is
          // announced rather than only redrawn.
          accessibilityLiveRegion="polite"
        >
          <Label>TOTAL</Label>
          <Heading>{money(total)}</Heading>
        </View>
      ) : null}

      {total > 0 ? (
        <View style={{ gap: theme.space.sm }}>
          {!paymentsAvailable() ? (
            <Problem>
              This copy of the app cannot take a payment. Please fill this form in on the
              church website instead.
            </Problem>
          ) : (
            <>
              {wallet ? (
                <Button
                  label={`Pay ${money(total)} and submit`}
                  onPress={() => void pay('wallet')}
                  busy={sending}
                />
              ) : null}
              <Button
                label={wallet ? 'Pay by card instead' : `Pay ${money(total)} and submit`}
                tone={wallet ? 'quiet' : 'primary'}
                onPress={() => void pay('card')}
                busy={sending && !wallet}
              />
            </>
          )}
          <Small color={theme.color.inkFaint}>
            Your answers are sent with the payment, in one step. If the card is declined,
            nothing is submitted and nothing is charged.
          </Small>
        </View>
      ) : (
        <>
          <Button label={sending ? 'Sending…' : 'Submit'} onPress={() => void sendFree()} busy={sending} />
          {form.payment.enabled ? (
            <Small color={theme.color.inkFaint}>Nothing to pay for the options chosen.</Small>
          ) : null}
        </>
      )}
    </View>
  );
}
