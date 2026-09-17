/**
 * Who administers what. The superadmin's, and unlisted — see `_layout.tsx`.
 */
import { SuperadminOnly } from '@/access/Guard';
import { PeopleScreen } from '@/access/PeopleScreen';

export default function Screen() {
  return (
    <SuperadminOnly>
      <PeopleScreen />
    </SuperadminOnly>
  );
}
