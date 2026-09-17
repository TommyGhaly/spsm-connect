import { EmbedImport } from '@/forms/admin/EmbedImport';
import { FormsAdminOnly } from '@/forms/admin/Guard';

export default function Screen() {
  return (
    <FormsAdminOnly>
      <EmbedImport />
    </FormsAdminOnly>
  );
}
