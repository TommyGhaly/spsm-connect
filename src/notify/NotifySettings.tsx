/**
 * The one screen where somebody decides what this app may interrupt them for.
 *
 * ---------------------------------------------------------------------------
 * Two sections, and they are not variations on a theme — they are the two
 * mechanisms in @spsm/shared's schema/notifications.ts, and the screen is
 * arranged so a person never has to know that.
 *
 *   **Reminders** come first, because everybody has them. They are local
 *   notifications scheduled on this phone out of the church calendar, and the
 *   preferences never leave it.
 *
 *   **Admin notifications** come second and only appear for a servant who holds
 *   a grant. They are remote pushes, so turning one on registers this phone
 *   with the church's server. Every row is independent and any number can be on
 *   at once — somebody who looks after the bookstore and the forms ticks both
 *   and gets both.
 *
 * ## Why the permission is asked from here and nowhere else
 *
 * A notification permission prompt is one-shot on iOS: a refusal is permanent
 * until somebody goes to Settings. So it is asked at the moment a person turns
 * something on — when the question has an obvious answer — and never at launch.
 * See `askForNotifications`.
 *
 * ## Saving is immediate, and that is the point
 *
 * There is no Save button. Every switch writes and reconciles as it is tapped,
 * because this is a preferences screen rather than a form: nothing here is
 * invalid, nothing needs checking against anything else, and a Save button on a
 * list of switches is a thing people forget to press and then wonder why their
 * reminders never came. The trade-off is that a flaky network shows a problem
 * line under the section rather than on a submit — handled by `problem` below.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  ADMIN_NOTICE_SPECS,
  OCCURRENCE_KINDS,
  OCCURRENCE_KIND_LABELS,
  REMINDER_LEADS,
  defaultReminderPrefs,
  entitledAdminNotices,
  noAdminNotices,
  reminderLeadLabel,
  type AdminNotice,
  type AdminNoticePrefs,
  type CalendarReminderPrefs,
  type OccurrenceKind,
} from '@spsm/shared';

import { ApiError } from '@/api/client';
import { Check, Picker, Problem } from '@/components/Fields';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { syncReminderTask } from './backgroundReminders';
import { register } from './device';
import {
  askForNotifications,
  notifyPermission,
  openNotificationSettings,
  type NotifyPermission,
} from './permission';
import {
  loadNoticePrefs,
  loadReminderPrefs,
  saveNoticePrefs,
  saveReminderPrefs,
} from './prefs';
import { reconcile, type ReconcileResult } from './reminders';

export function NotifySettings() {
  const theme = useTheme();
  const { user, isPerson, grants, loading: sessionLoading } = useSession();

  const [permission, setPermission] = useState<NotifyPermission>('undetermined');
  const [reminders, setReminders] = useState<CalendarReminderPrefs>(defaultReminderPrefs);
  const [notices, setNotices] = useState<AdminNoticePrefs>(noAdminNotices);
  const [schedule, setSchedule] = useState<ReconcileResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /**
   * A softer line than `problem`: the choice saved, but this phone cannot
   * actually receive the notices.
   *
   * Separate because it is not a failure. The simulator can never hold a push
   * token — see `pushToken` — and telling somebody their preference "did not
   * save" when it did is worse than telling them nothing.
   */
  const [deviceNote, setDeviceNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /*
   * Guards an async save against the screen going away, and against two taps
   * racing. The same generation trick `SessionProvider` uses, and for the same
   * reason: the slower of two saves must not be the one that wins.
   *
   * **Two counters, not one.** They were one, and that was a bug: a reminder
   * toggle bumped the same counter a notice save was waiting on, so the notice
   * save's `finally` decided it was stale and never cleared the flag that
   * disabled the rows — leaving every admin switch dead until the screen was
   * reopened. The two halves of this screen are independent and their guards
   * must be too.
   */
  const reminderGeneration = useRef(0);
  const noticeGeneration = useRef(0);

  /**
   * The notices as they stand right now, for the async path to build on.
   *
   * A ref beside the state, because `toggleNotice` is async and must not build
   * its next map from a value captured when the callback was created. That is
   * the other half of the bug above: with a captured `notices`, ticking a
   * second row composed its change onto the map as it was *before the first
   * row*, so the first row silently switched itself back off. Reading the ref
   * means every tap composes onto the latest truth, however fast they come.
   */
  const noticesRef = useRef<AdminNoticePrefs>(noAdminNotices());

  /* ── First read ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;

    void (async () => {
      const [status, storedReminders, storedNotices] = await Promise.all([
        notifyPermission(),
        loadReminderPrefs(),
        loadNoticePrefs(),
      ]);
      if (!alive) return;

      setPermission(status);
      setReminders(storedReminders);
      setNotices(storedNotices);
      noticesRef.current = storedNotices;
      setLoading(false);

      /*
       * Reconcile on arrival, so the horizon shown below is what is actually
       * scheduled rather than what was scheduled whenever the app was last
       * opened. Cheap when nothing has changed, and it is the one moment we
       * know somebody is looking at the answer.
       */
      if (storedReminders.enabled) {
        const result = await reconcile(storedReminders);
        if (alive) setSchedule(result);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ── Reminders ───────────────────────────────────────────────────────────── */

  /**
   * Save, reschedule, and keep the background task in step — in that order.
   *
   * The order matters on the way *off*: the preferences have to be on disk
   * before `reconcile` reads them from the background task, and the task has to
   * be unregistered after the reminders are cancelled rather than before, or a
   * wake-up already in flight can reschedule what was just cleared.
   */
  const applyReminders = useCallback(async (next: CalendarReminderPrefs) => {
    const mine = ++reminderGeneration.current;
    setReminders(next);
    setProblem(null);

    await saveReminderPrefs(next);

    const result = await reconcile(next);
    if (reminderGeneration.current !== mine) return;

    setSchedule(next.enabled ? result : null);
    if (result.problem) setProblem(result.problem);

    await syncReminderTask(next.enabled);
  }, []);

  const toggleReminders = useCallback(
    async (wanted: boolean) => {
      if (!wanted) {
        await applyReminders({ ...reminders, enabled: false });
        return;
      }

      /*
       * The ask, and the only place in this app that makes it. A refusal is not
       * an error — the person answered the question — so the switch simply
       * stays off and the `denied` notice below explains the way back.
       */
      const status = await askForNotifications();
      setPermission(status);
      if (status !== 'granted') return;

      await applyReminders({ ...reminders, enabled: true });
    },
    [applyReminders, reminders],
  );

  const toggleKind = useCallback(
    (kind: OccurrenceKind, wanted: boolean) => {
      /*
       * Individual pins and mutes are deliberately *kept* when a kind is
       * switched off and on again. Somebody who silenced the 6am Liturgy has
       * said something specific, and it should still be true after they toggle
       * the Liturgies row twice.
       *
       * That is safe only because `withOccurrenceReminder` never records an
       * override that agrees with the kind — so there is no stale pin here to
       * outlive the subscription that made it redundant, which is the failure
       * this would otherwise have. See its note.
       */
      void applyReminders({
        ...reminders,
        kinds: { ...reminders.kinds, [kind]: wanted },
      });
    },
    [applyReminders, reminders],
  );

  /* ── Notices, for whichever areas this person looks after ─────────────────── */

  /**
   * What this person may subscribe to, derived from their grants.
   *
   * Through `entitledAdminNotices` and never re-derived here — the rule this
   * codebase keeps is that no screen works out a permission for itself. The
   * server intersects the request again anyway, so this only decides which rows
   * are drawn.
   */
  const entitled = isPerson
    ? entitledAdminNotices(grants.claims, grants.screenAdmin, grants.programAdmin)
    : [];

  /**
   * Turn one notice on or off.
   *
   * ---------------------------------------------------------------------------
   * **The choice is saved before anything is asked of the network**, and that
   * ordering is the fix for the worst behaviour this screen had.
   *
   * It used to register with the server first and only keep the preference if
   * that succeeded. On a device that cannot hold a push token — every iOS
   * simulator, and any phone that briefly cannot reach FCM — `register`
   * answers null, so *every* switch sprang back and no admin preference could
   * be set at all. The person's intent is not the server's to validate: it is a
   * local preference that this phone then tries to act on.
   *
   * So: write it down, then sync. A sync that fails leaves the choice standing
   * and says why, and `useNotifyLifecycle` retries on the next app start —
   * where `pushRegister` intersects it against the grants and echoes back the
   * truth, which is what keeps a locally-saved wish from becoming a
   * subscription somebody was not entitled to.
   *
   * Nothing is disabled while a sync is in flight. Each tap sends the *whole*
   * current map read from `noticesRef`, so three taps in a second are three
   * requests whose last answer is complete and correct — there is no state for
   * them to race over, and disabling the other rows only ever made the screen
   * feel broken.
   * ---------------------------------------------------------------------------
   */
  const toggleNotice = useCallback(async (notice: AdminNotice, wanted: boolean) => {
    const mine = ++noticeGeneration.current;

    // Composed onto the ref, never onto a captured value. See its note.
    const next: AdminNoticePrefs = { ...noticesRef.current, [notice]: wanted };
    noticesRef.current = next;
    setNotices(next);
    setProblem(null);

    // Written down first, whatever the network does next.
    await saveNoticePrefs(next);

    /*
     * Permission, and only when switching something on. A subscription with
     * notifications denied is a phone the church sends to that stays silent —
     * worse than not being subscribed, because nothing anywhere reports it.
     */
    if (wanted) {
      const status = await askForNotifications();
      if (noticeGeneration.current === mine) setPermission(status);
      if (status !== 'granted') {
        /*
         * Put this one row back — by name, not by restoring a whole captured
         * map, so a tap on another row that landed in the meantime survives.
         */
        const reverted: AdminNoticePrefs = { ...noticesRef.current, [notice]: false };
        noticesRef.current = reverted;
        if (noticeGeneration.current === mine) setNotices(reverted);
        await saveNoticePrefs(reverted);
        return;
      }
    }

    try {
      const result = await register(next);
      // A later tap has superseded this one; its answer is the current truth.
      if (noticeGeneration.current !== mine) return;

      if (!result) {
        /*
         * No token, or no session. The choice stands — it is saved — and this
         * says plainly that the phone cannot act on it. The simulator lives
         * here permanently.
         */
        setDeviceNote(
          'Saved. This device cannot receive notices, so they will start on a real phone.',
        );
        return;
      }

      // The server's intersection with the grants, which outranks the wish.
      noticesRef.current = result.notices;
      setNotices(result.notices);
      await saveNoticePrefs(result.notices);
      setDeviceNote(null);
    } catch (error) {
      if (noticeGeneration.current !== mine) return;
      /*
       * The choice is left standing rather than reverted. It is saved on this
       * phone and the next app start re-sends it; throwing it away because the
       * network blinked would lose a deliberate choice for no gain.
       */
      setProblem(
        error instanceof ApiError
          ? error.message
          : 'Saved, but the church could not be told just now. It will retry.',
      );
    }
  }, []);

  if (loading || sessionLoading) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Reading your settings…</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      {problem ? <Problem>{problem}</Problem> : null}

      {permission === 'denied' ? (
        <Card gap={theme.space.sm}>
          <Heading>Notifications are switched off</Heading>
          <Small color={theme.color.inkSoft}>
            This phone is not allowing notifications from the app, so nothing below can reach you.
            Turn them on in Settings and come back.
          </Small>
          <Button label="Open Settings" tone="quiet" onPress={openNotificationSettings} />
        </Card>
      ) : null}

      {/* ── Calendar reminders ───────────────────────────────────────────── */}
      <Card gap={theme.space.sm}>
        <Heading>Calendar reminders</Heading>
        <Small color={theme.color.inkSoft}>
          Set on this phone, from the church calendar. Nobody is told what you have chosen here.
        </Small>

        <Check
          label="Remind me about events"
          checked={reminders.enabled}
          onChange={(next) => void toggleReminders(next)}
          hint={
            permission === 'denied'
              ? 'Allow notifications in Settings first.'
              : 'Reminders are scheduled on this phone, so open the app now and then to keep them coming.'
          }
          disabled={permission === 'denied'}
        />

        {reminders.enabled ? (
          <View style={{ gap: theme.space.sm, marginTop: theme.space.xs }}>
            <View>
              <Label>WHICH EVENTS</Label>
              {OCCURRENCE_KINDS.map((kind) => (
                <Check
                  key={kind}
                  label={OCCURRENCE_KIND_LABELS[kind]}
                  checked={reminders.kinds[kind]}
                  onChange={(next) => toggleKind(kind, next)}
                />
              ))}
              <Micro color={theme.color.inkFaint}>
                You can also add or silence one event on its own, from the event itself.
              </Micro>
            </View>

            <Picker
              label="How long before"
              value={String(reminders.leadMinutes)}
              options={REMINDER_LEADS.map((minutes) => ({
                value: String(minutes),
                label: reminderLeadLabel(minutes),
              }))}
              onChange={(next) => void applyReminders({ ...reminders, leadMinutes: Number(next) })}
            />

            {/*
              * The honest statement of what local scheduling costs. Drawn from
              * what was actually scheduled rather than from the six-week
              * intent, so it tells the truth when the calendar could not be
              * read or the 64-notification ceiling truncated the list.
              */}
            {schedule ? (
              <Micro color={theme.color.inkFaint}>
                {schedule.scheduled === 0
                  ? 'Nothing to remind you about in the next few weeks.'
                  : `${schedule.scheduled} reminder${schedule.scheduled === 1 ? '' : 's'} set` +
                    (schedule.horizon ? `, up to ${dayLabel(schedule.horizon)}` : '') +
                    (schedule.truncated ? '. Open the app again to set more.' : '.')}
              </Micro>
            ) : null}
          </View>
        ) : null}
      </Card>

      {/* ── Notices, for servants only ───────────────────────────────────── */}
      {entitled.length > 0 ? (
        <Card gap={theme.space.sm}>
          <Heading>Admin notifications</Heading>
          <Small color={theme.color.inkSoft}>
            Tick as many as you like. These are sent by the church, so they reach you whether or not
            the app is open.
          </Small>

          {ADMIN_NOTICE_SPECS.filter((spec) => entitled.includes(spec.notice)).map((spec) => (
            <Check
              key={spec.notice}
              label={spec.label}
              hint={spec.hint}
              checked={notices[spec.notice]}
              onChange={(next) => void toggleNotice(spec.notice, next)}
              disabled={permission === 'denied'}
            />
          ))}

          {/*
            * Not a `Problem`: the choices above are saved, and this is a fact
            * about the hardware rather than a failure. A simulator shows this
            * permanently and everything on this screen still works.
            */}
          {deviceNote ? <Micro color={theme.color.inkFaint}>{deviceNote}</Micro> : null}
        </Card>
      ) : null}

      {/*
        * Signed out, with nothing to say about notices.
        *
        * Shown rather than omitted, because a servant who expects the second
        * section and sees one card has no way to tell whether the feature is
        * missing or they are simply not signed in.
        */}
      {!isPerson && user !== null ? (
        <Micro color={theme.color.inkFaint}>
          Sign in to be told about photographs, orders and forms in the areas you look after.
        </Micro>
      ) : null}
    </Screen>
  );
}

/** `2026-10-12` → `12 October`. No year: the horizon is always within weeks. */
function dayLabel(day: string): string {
  const [year = '', month = '', date = ''] = day.split('-');
  const at = new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at);
}
