/**
 * `/c/give` — the offering.
 *
 * The full app's Giving screen, unforked: the verse, the card, and a button
 * that opens `give.tithe.ly` in `SFSafariViewController` over this clip.
 *
 * Two things worth stating plainly, because a payment inside an App Clip sounds
 * like it should be a problem and this one is not:
 *
 *   - **Nothing is charged by this binary.** The gift is made on Tithe.ly's own
 *     hosted form, in real Safari with the address visible. `giving/open.ts`
 *     carries the reasoning for that presentation, and it is the same in the app
 *     and the clip.
 *   - **A donation to a nonprofit is the case Apple names for collecting money
 *     outside in-app purchase.** No Square SDK is involved, so nothing here
 *     touches the framework this target excludes.
 */
import { GivingScreen } from '@/giving/GivingScreen';

export function Give() {
  return <GivingScreen />;
}
