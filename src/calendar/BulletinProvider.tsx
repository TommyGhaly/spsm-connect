/**
 * The active bulletin, read for the whole app and re-read while it is open.
 *
 * It used to be state inside `CalendarScreen`, which was right while the
 * calendar was the only thing that wanted it. It is not any more: the
 * announcements bell is header chrome on every tab, so the notices have to be
 * available on Giving and Bookstore too — and five screens each firing their
 * own `/api/bulletin` would be five reads of another Firebase project through
 * the church's service account, for one document that changes weekly.
 *
 * ## Why the default is an empty bulletin rather than a thrown error
 *
 * `useSession` throws without its provider, because a screen that believes it
 * has a session and does not is a screen about to do the wrong thing. This is
 * the opposite case. The bulletin is an *enrichment* everywhere it is used —
 * `data.ts` says so in its own header, and means it: the schedule renders
 * without it and the bell simply has nothing to show. A missing provider is
 * therefore a weekday with no notices, not a fault.
 *
 * That matters for one caller in particular. `CalendarScreen` is rendered by
 * the App Clip, which has no router and so never mounts `(drawer)/_layout`; it
 * would be the thing this threw at. If a clip experience ever does want the
 * notices, it mounts this the way `ClipRoot` already mounts `SessionProvider`.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getBulletin, type BulletinRead } from './data';

/*
 * One frozen instance, not a fresh object per render. It is a `useMemo`
 * dependency in `CalendarScreen` — a new `{ occurrences: [] }` each time would
 * re-run the whole four-source merge on every render of a screen that has not
 * changed.
 */
const NO_BULLETIN: BulletinRead = Object.freeze({
  occurrences: [],
  notices: [],
  weekLabel: '',
  from: '',
  to: '',
});

/**
 * How often to re-ask while the app is in front — the website's `POLL_MS`.
 *
 * Staff make a different bulletin active in the announcements app, and the
 * website's homepage notices within a minute; an app left open on the calendar
 * should not keep showing last week's sheet until it is relaunched. The CDN in
 * front of `/api/bulletin` holds an answer for thirty seconds, so this is
 * mostly a read of a cached copy, not of the other Firebase project.
 */
const POLL_MS = 60_000;

const BulletinContext = createContext<BulletinRead>(NO_BULLETIN);

export function BulletinProvider({ children }: { children: ReactNode }) {
  const [bulletin, setBulletin] = useState<BulletinRead>(NO_BULLETIN);

  useEffect(() => {
    let live = true;
    /*
     * What was last put on screen, as JSON, so an unchanged answer — nearly
     * every poll — does not hand `CalendarScreen` a new object and re-run its
     * merge once a minute for nothing.
     */
    let shown = '';

    /*
     * `getBulletin` never rejects — it warns and returns an empty read — so
     * there is deliberately no catch here to write a second one.
     *
     * Like the website's `useActiveBulletin`, a failed or empty read after a
     * good one leaves the good one on screen: a sheet a few days old still says
     * when the Liturgy is, and a calendar that empties itself mid-visit does not.
     */
    const check = () => {
      void getBulletin().then((next) => {
        if (!live) return;
        if (next.from === '' && shown !== '') return;
        const json = JSON.stringify(next);
        if (json === shown) return;
        shown = json;
        setBulletin(next);
      });
    };

    check();

    // Only while the app is in front — a phone in a pocket should not spend the
    // night re-reading the parish's schedule.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, POLL_MS);

    // Coming back to the app is when the sheet is most likely to have changed,
    // so it is checked at once rather than at the end of the interval.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      live = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return <BulletinContext.Provider value={bulletin}>{children}</BulletinContext.Provider>;
}

/** The week's bulletin, or an empty one. Never null, and never throws. */
export function useBulletin(): BulletinRead {
  return useContext(BulletinContext);
}
