import { Metrics } from '@/bookstore/admin/Metrics';
import { BookstoreAdminOnly } from '@/bookstore/admin/Guard';

export default function Screen() {
  return (
    <BookstoreAdminOnly>
      <Metrics />
    </BookstoreAdminOnly>
  );
}
