/**
 * One person's areas.
 *
 * Guarded in its own right rather than trusting the directory to be the only
 * way in: this is a route, and a route can be typed, deep-linked or restored
 * from a cold start. The guard is cheap and the alternative is a screen of
 * permission errors.
 */
import { SuperadminOnly } from '@/access/Guard';
import { PersonScreen } from '@/access/PersonScreen';

export default function Screen() {
  return (
    <SuperadminOnly>
      <PersonScreen />
    </SuperadminOnly>
  );
}
