import { useLocalSearchParams } from 'expo-router';

import { FormBuilder } from '@/forms/admin/FormBuilder';
import { FormsAdminOnly } from '@/forms/admin/Guard';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <FormsAdminOnly>
      <FormBuilder id={String(id ?? '')} />
    </FormsAdminOnly>
  );
}
