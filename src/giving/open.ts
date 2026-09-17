/**
 * The give action: Tithe.ly's own hosted form, opened over this screen.
 *
 * ---------------------------------------------------------------------------
 * ## What the website does, and what the native equivalent of it is
 *
 * On the web the Give button does not send anybody to another page — it opens
 * Tithe.ly's form in a `<dialog>` over the giving page, full screen on a phone,
 * with "Open in a new tab instead" kept one press away. Tommy asked for that:
 * *"if there is a way to donate to tithely natively without opening an outside
 * website lets do that."*
 *
 * This is the same thing on a phone. `openBrowserAsync` is
 * `SFSafariViewController` on iOS and a Chrome Custom Tab on Android: it slides
 * up over the app, the app stays underneath it, and dismissing it puts the
 * reader back on this screen rather than in a browser they now have to leave.
 * The presentation below is the church's own colours, so it reads as part of
 * the app and not as a handoff.
 *
 * ## Why it is not a `WebView`, which would look even more native
 *
 * `react-native-webview` is already a dependency and the form would render in
 * it. Three reasons it is the wrong tool for *this* page, in order of weight:
 *
 *   1. **The wallets stop working.** `WKWebView` does not support Apple Pay on
 *      the web, so a form embedded here loses Apple Pay and Google Pay — which
 *      is very likely the reason Tithe.ly's own `give.js` refuses to frame
 *      itself on Safari, Chrome, or any phone-width window. Making a donation
 *      harder is the opposite of the errand. `SFSafariViewController` is real
 *      Safari and the wallets work in it.
 *   2. **Nobody can see the address.** A card number typed into a rectangle the
 *      app drew is a payment page with no address bar, and this screen's first
 *      version said so and refused to embed for that reason. That refusal was
 *      right about the risk and wrong about the remedy: the remedy is a browser
 *      that shows `give.tithe.ly` at the top, not a link out of the app.
 *   3. It is the mechanism Apple names for a nonprofit collecting donations
 *      outside in-app purchase, which this is.
 *
 * The card number is never ours either way. It is typed into `give.tithe.ly`,
 * and Tithe.ly processes, receipts and schedules the gift.
 *
 * ## Still to be done before the church is told about this screen
 *
 * A real gift, completed here, on an iPhone and on an Android phone. The
 * website's note says the same thing about its overlay and it is not a
 * formality: this form is the church's live one, a payment that fails inside a
 * browser we opened fails silently from our side, and we never see it.
 * ---------------------------------------------------------------------------
 */
import * as WebBrowser from 'expo-web-browser';

import type { ResolvedTheme } from '@/theme/tokens';

import { givingUrl } from './config';

/**
 * Open the church's giving form.
 *
 * Takes the theme rather than reading it, because this is not a hook and the
 * two screens that give (this one and Future Plans' construction fund) should
 * not each be making their own decision about how the form is presented.
 */
export function openGiving(theme: ResolvedTheme): void {
  void WebBrowser.openBrowserAsync(givingUrl(), {
    /*
     * Full screen, which is what the website's own overlay becomes below 32rem
     * and for the reason its stylesheet gives: "a donation form is a column of
     * inputs with a keyboard under it", and a sheet that leaves a strip of the
     * app showing spends height the form needs. It is also what iOS presents by
     * default, so nothing here is fighting the platform.
     */
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    // "Done" rather than "Cancel": leaving a completed gift is not a cancel.
    dismissButtonStyle: 'done',
    controlsColor: theme.color.accent,
    toolbarColor: theme.color.paperRaised,
    secondaryToolbarColor: theme.color.paperSunken,
    /*
     * The one option here that is not decoration. Bar collapsing hides the
     * toolbar — and with it the address — as the page scrolls, and the address
     * is the whole argument for opening a browser rather than embedding a
     * frame. Off, on both platforms.
     */
    enableBarCollapsing: false,
    showTitle: true,
    // Android: keep the tab on top of this app rather than starting a task of
    // its own, so the back gesture comes home to the giving screen.
    createTask: false,
  }).catch(() => {
    /*
     * Swallowed, and this is the one place in the app where that is right.
     * `openBrowserAsync` rejects when a browser is already open — which on this
     * screen means a second press while the form is presenting — and there is
     * no state worth showing anybody about it. Nothing else here can
     * fail: the URL is a constant.
     */
  });
}
