import { Orders } from '@/bookstore/admin/Orders';
import { BookstoreAdminOnly } from '@/bookstore/admin/Guard';

export default function Screen() {
  return (
    <BookstoreAdminOnly>
      <Orders />
    </BookstoreAdminOnly>
  );
}
