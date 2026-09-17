/**
 * The review queue, optionally narrowed to one form.
 *
 * `?formId=` rather than a path segment: the screen can show every form at
 * once, and "all of them" is the state it opens in from the list's own button.
 */
import { useLocalSearchParams } from 'expo-router';

import { FormsAdminOnly } from '@/forms/admin/Guard';
import { Submissions } from '@/forms/admin/Submissions';

export default function Screen() {
  const { formId } = useLocalSearchParams<{ formId?: string }>();

  return (
    <FormsAdminOnly>
      <Submissions formId={formId ? String(formId) : null} />
    </FormsAdminOnly>
  );
}
