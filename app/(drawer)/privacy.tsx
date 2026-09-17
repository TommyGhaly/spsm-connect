/**
 * /privacy — the notice, in the drawer under Contact.
 *
 * A one-line screen like the About routes: the drawer owns the header and the
 * title, and everything the reader sees is `src/privacy`. See
 * `src/privacy/notice.ts` for why the words are code and not content.
 */
import { PrivacyScreen } from '@/privacy/PrivacyScreen';

export default function Screen() {
  return <PrivacyScreen />;
}
