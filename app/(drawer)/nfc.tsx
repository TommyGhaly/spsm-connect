/**
 * /nfc — program the church's NFC stickers. The superadmin's, and unlisted.
 *
 * Reached from one row under Areas in the drawer's account card, which renders
 * for the superadmin only. As with Areas, that is a convenience and the guard is
 * the protection: a typed or restored route draws nothing for anybody else.
 */
import { SuperadminOnly } from '@/access/Guard';
import { NfcWriterScreen } from '@/nfc/NfcWriterScreen';

export default function Screen() {
  return (
    <SuperadminOnly>
      <NfcWriterScreen />
    </SuperadminOnly>
  );
}
