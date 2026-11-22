/**
 * /nfc — the church's NFC tags: their statistics, and programming new ones.
 *
 * Reached from the drawer's account card, which draws the row for the
 * superadmin and for anybody holding the `nfc` grant. As with Areas, that is a
 * convenience and the guard is the protection: `NfcScreen` decides which half
 * a reader sees, and `firestore.rules` decides what any read returns.
 */
import { NfcScreen } from '@/nfc/NfcScreen';

export default function Screen() {
  return <NfcScreen />;
}
