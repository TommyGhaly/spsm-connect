import { Unbuilt } from '@/components/Unbuilt';

/**
 * Phase 3. `GET /api/calendar` already answers with everything this needs, and
 * `calendarView.ts` in @spsm/shared does the merging of Breeze occurrences,
 * bulletin events, one-off events and schedule entries — so what is left here
 * is the week and month layout, not the logic.
 */
export default function CalendarTab() {
  return <Unbuilt what="The parish calendar" />;
}
