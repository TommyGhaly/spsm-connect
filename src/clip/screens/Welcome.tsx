/**
 * `/c/welcome` — the liturgy, for somebody who has not been before.
 *
 * The full app's own `/about/welcome-newcomers` screen, unforked. It is the
 * right thing to put behind a tag by the door precisely because it was written
 * for a stranger standing in the narthex: what is happening, what the Coptic
 * words mean, and what nobody minds if you do not do.
 *
 * `AboutCopyProvider` is not optional decoration — it is the one fetch that
 * lets the church edit this page from the website without a release, and the
 * screen below reads every band through it. Its absence is not an error: the
 * words ship inside the binary and an override is an improvement on them.
 */
import { TourScreen } from '@/about/TourScreen';
import { AboutCopyProvider } from '@/about/overrides';

export function Welcome() {
  return (
    <AboutCopyProvider slug="welcome-newcomers">
      <TourScreen />
    </AboutCopyProvider>
  );
}
