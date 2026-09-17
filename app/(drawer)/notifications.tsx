/**
 * /notifications — what this app may interrupt you for.
 *
 * A one-line screen like the About routes: the drawer owns the header and the
 * title, and everything the reader sees is `src/notify/NotifySettings`.
 *
 * In the drawer rather than the tab bar deliberately. It is a settings screen —
 * visited twice and then never again — and the five tabs are the places people
 * go repeatedly. It is also where a notification with nothing better to offer
 * lands; see `routeFor` in src/notify/handle.ts.
 */
import { NotifySettings } from '@/notify/NotifySettings';

export default function Screen() {
  return <NotifySettings />;
}
