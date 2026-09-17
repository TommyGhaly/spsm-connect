/**
 * "Remind me about this one" — the per-occurrence half of the reminder model.
 *
 * ---------------------------------------------------------------------------
 * The settings screen offers standing subscriptions by kind, which is what most
 * people want and what keeps working as the calendar changes. This is the other
 * two axes, and it lives here because the only sensible place to ask about one
 * event is on that event:
 *
 *   a **pin**  for the retreat that is not a kind of anything and happens once
 *   a **mute** for the one 6am Liturgy inside a subscription to Liturgies
 *
 * Which of the two a tap produces is not this component's decision.
 * `withOccurrenceReminder` works it out from what the standing subscription
 * already says, and it deliberately records nothing when the tap agrees with
 * the kind — otherwise turning a kind off later would leave a pin behind and
 * one stubborn event would keep buzzing. See its note.
 *
 * ## Why this reads its own preferences instead of being handed them
 *
 * The event sheet knows nothing about notifications and should not have to.
 * Threading prefs, a setter and a reconcile through `CalendarScreen` →
 * `EventSheet` → here would put notification state in two components that have
 * no other reason to hold any, for a control that is one checkbox. So this
 * loads what it needs on mount and saves on change, which for a sheet that
 * opens over a single event is one AsyncStorage read.
 *
 * It renders **nothing at all** when reminders are switched off. A checkbox
 * offering to remind somebody about one event, inside an app whose reminders
 * are off, is a control that silently does nothing — and explaining that in a
 * hint here would be a second copy of the settings screen's own sentence.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useEffect, useState } from 'react';
import {
  kindOf,
  wantsReminder,
  withOccurrenceReminder,
  type CalendarOccurrence,
  type CalendarReminderPrefs,
} from '@spsm/shared';

import { Check } from '@/components/Fields';

import { loadReminderPrefs, saveReminderPrefs } from './prefs';
import { reconcile } from './reminders';

export function RemindAboutThis({ occurrence }: { occurrence: CalendarOccurrence }) {
  const [prefs, setPrefs] = useState<CalendarReminderPrefs | null>(null);

  useEffect(() => {
    let alive = true;
    void loadReminderPrefs().then((loaded) => {
      if (alive) setPrefs(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(
    async (wanted: boolean) => {
      if (!prefs) return;

      const next = withOccurrenceReminder(
        prefs,
        { id: occurrence.id, kind: kindOf(occurrence) },
        wanted,
      );

      // Optimistic: the box has to move under the thumb. Nothing here can be
      // refused — it is a write to this phone's own storage.
      setPrefs(next);
      await saveReminderPrefs(next);

      /*
       * Rescheduled from scratch rather than by adding one notification.
       * `reconcile` is a replace by design — see its header — and calling it is
       * what makes this checkbox and the settings screen incapable of
       * disagreeing about what is scheduled.
       */
      await reconcile(next);
    },
    [occurrence, prefs],
  );

  // Not loaded yet, or reminders are off entirely. See the header.
  if (!prefs || !prefs.enabled) return null;

  const on = wantsReminder(prefs, { id: occurrence.id, kind: kindOf(occurrence) });

  return (
    <Check
      label="Remind me about this"
      checked={on}
      onChange={(next) => void toggle(next)}
      /*
       * The hint names the standing subscription, because that is the thing a
       * person is overriding and the reason the box was already ticked when
       * they opened the sheet.
       */
      hint={
        on
          ? 'Untick to stay quiet about this one, even though you follow its kind.'
          : 'You are not following this kind of event. Tick to be reminded about this one.'
      }
    />
  );
}
