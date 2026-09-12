/**
 * Whether the camp is running right now.
 *
 * This exists to answer one question the navigation asks: does the register
 * belong in the tab bar today, or in the drawer with everything else? A servant
 * at the door in July should not have to find it; a servant in February should
 * not have a tab for it.
 *
 * ## Why the dates are read rather than a switch
 *
 * `config/camp` already holds `weekStarts` — the Monday each week begins on —
 * because the register needs to name its days. Nothing else has to be
 * maintained for this, and nothing can be left switched on by accident. A
 * "camp is running" toggle would be a second thing to remember, and the parish
 * would remember it in June and forget it in August.
 *
 * ## What counts as a camp week
 *
 * Monday to Friday of any configured week, inclusive, plus the weekend either
 * side of the season. `CAMP_WEEKDAYS` is the five weekdays and the camp does
 * not run at the weekend, but a register is opened on the Sunday before and
 * squared up on the Saturday after, so the tab appears a little before and
 * lingers a little after rather than blinking out mid-clear-up.
 *
 * Every unset date reads as "not running". `weekStarts` is empty for most of
 * the year, which is the ordinary state, not a fault — the same posture
 * `campDayDate` takes, and the reason it answers null rather than throwing.
 */
import { useEffect, useState } from 'react';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { CONFIG_DOC_CAMP, campDayKey, campDayDate, parseCampConfig } from '@spsm/shared';

/** How far either side of the season the register stays to hand, in days. */
const SHOULDER_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when `on` falls inside any configured week, give or take the shoulder.
 *
 * Exported separately from the hook so it is testable and so the App Clip — which
 * has no React tree to hang a hook on — can ask the same question.
 */
export function isCampWeek(weekStarts: readonly string[], weeks: number, on: Date): boolean {
  for (let week = 1; week <= weeks; week += 1) {
    const monday = campDayDate(weekStarts, campDayKey(week, 'mon'));
    const friday = campDayDate(weekStarts, campDayKey(week, 'fri'));
    if (!monday || !friday) continue;

    /*
     * Compared as instants at local midnight, which `campDayDate` already
     * returns — it builds with `new Date(y, m, d)` for exactly this reason, so
     * a date-only string does not land a day early west of Greenwich.
     */
    const from = monday.getTime() - SHOULDER_DAYS * DAY_MS;
    const to = friday.getTime() + (SHOULDER_DAYS + 1) * DAY_MS;
    if (on.getTime() >= from && on.getTime() < to) return true;
  }
  return false;
}

/**
 * Whether the camp is running, read once per launch.
 *
 * Not a listener. The answer changes twice a year and a subscription held open
 * on every phone for that is a poor trade; a tab that appears on the next cold
 * start is soon enough for something scheduled months ahead.
 *
 * Starts false, so the tab bar does not flicker an extra tab into existence on
 * every launch before the read lands.
 */
export function useCampWeek(): boolean {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const snapshot = await getDoc(doc(getFirestore(), CONFIG_DOC_CAMP));
        const config = parseCampConfig(snapshot.data());
        if (live) setRunning(isCampWeek(config.weekStarts, config.weeks, new Date()));
      } catch {
        /*
         * Silent, and false. `config/camp` is readable by anybody, so a failure
         * here is offline or a project without the document — neither of which
         * is a reason to shout, and both of which mean "no camp tab".
         */
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  return running;
}
