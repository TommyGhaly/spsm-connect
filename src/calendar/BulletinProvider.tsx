/**
 * This week's bulletin, read once for the whole app.
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
});

const BulletinContext = createContext<BulletinRead>(NO_BULLETIN);

export function BulletinProvider({ children }: { children: ReactNode }) {
  const [bulletin, setBulletin] = useState<BulletinRead>(NO_BULLETIN);

  useEffect(() => {
    let live = true;
    // `getBulletin` never rejects — it warns and returns an empty read — so
    // there is deliberately no catch here to write a second one.
    void getBulletin().then((next) => {
      if (live) setBulletin(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return <BulletinContext.Provider value={bulletin}>{children}</BulletinContext.Provider>;
}

/** The week's bulletin, or an empty one. Never null, and never throws. */
export function useBulletin(): BulletinRead {
  return useContext(BulletinContext);
}
