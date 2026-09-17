/**
 * What happens when somebody taps a notification.
 *
 * ---------------------------------------------------------------------------
 * ## Two libraries, two listeners, and the reason they do not overlap
 *
 * A *remote* notification is delivered by APNs/FCM and its tap is reported by
 * @react-native-firebase/messaging. A *local* one is scheduled by
 * expo-notifications and its tap is reported by expo-notifications. Each
 * library sees only its own, which is exactly why this app gives each of them
 * one job — see the note in app.config.ts where both plugins are registered.
 * So there are two listeners here and they are not duplicates of each other.
 *
 * ## The one rule about where a tap may go
 *
 * A notification's payload is **data from outside the app**, so the route in it
 * is never navigated to directly. Server-sent pushes come from the parish's own
 * Functions, which is as trustworthy a source as this app has — but a push
 * payload is also the one input to this app that arrives without any of its own
 * code having asked for it, and `router.push` with an attacker-chosen string is
 * how a notification becomes a way to drive somebody's session.
 *
 * So `routeFor` maps the `notice` field through a **fixed table of destinations
 * defined in this file**, and the `route` the server sends is only ever used to
 * confirm which of those it meant. An unrecognised notice lands on the drawer's
 * notification settings, which is a dead end rather than a surprise.
 * ---------------------------------------------------------------------------
 */
import * as Notifications from 'expo-notifications';
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { isAdminNotice, type AdminNotice } from '@spsm/shared';
import type { Href } from 'expo-router';

/**
 * Where each notice goes, and the only routes a notification can reach.
 *
 * Deliberately app routes rather than the `/admin/*` paths the Functions send.
 * Those are the *website's* screens — `send.ts` fills them in because the
 * notification model is shared and a browser could use them — and this app has
 * its own map of the same places. Where the app has no equivalent screen yet,
 * the tap lands on the nearest thing it does have; a notification that opens
 * the wrong screen is bad, and one that opens nothing at all reads as broken.
 */
const DESTINATIONS: Record<AdminNotice, Href> = {
  // The review queue lives under the events tree, which is where a gallery is
  // administered in this app.
  uploads: '/events',
  /*
   * The queue itself, not the shop.
   *
   * This was `/bookstore` under the rule three lines up — the nearest thing the
   * app had. It now has the thing itself: a volunteer tapping "a new order came
   * in" lands on the list of orders to put aside, filtered to exactly those.
   */
  orders: '/bookstore/orders',
  forms: '/forms',
  camp: '/forms/summer-camp',
  parking: '/forms',
  /*
   * The orders queue, because the refund itself is on the order — the card
   * carries the reason somebody typed against it, which is the thing a notice
   * about a refund is actually asking you to look at.
   *
   * Not `/bookstore/metrics`, which is where the takings are: that screen has
   * the refunded total but not the transaction, and a treasurer reconciling a
   * figure needs the sale it reverses. It is one press away from here.
   */
  refunds: '/bookstore/orders',
};

/** Where a tap should land. Never the payload's own string. See the header. */
export function routeFor(data: Record<string, unknown> | undefined): Href {
  const notice = data?.['notice'];
  if (isAdminNotice(notice)) return DESTINATIONS[notice];

  /*
   * A calendar reminder, which carries a day rather than a notice. The day is
   * validated against a literal shape before it is put in a URL — it came off
   * a notification payload, and `YYYY-MM-DD` is cheap to prove.
   */
  const day = data?.['day'];
  if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return `/calendar?day=${day}` as Href;
  }

  // Unrecognised. The settings screen is a dead end rather than a surprise.
  return '/notifications';
}

/**
 * Install every tap listener, and answer the cold-start case.
 *
 * `go` is called with a route to navigate to. Returns one unsubscribe that
 * removes all of them.
 *
 * ## The cold start is the case that gets forgotten
 *
 * A tap on a notification while the app is **not running** does not fire a
 * listener — the app launches, and the notification is waiting to be asked
 * about. Both libraries have their own way of being asked and both are checked
 * below. Without that, tapping a notification from a cold start opens the app
 * on the home tab and looks like the tap did nothing.
 */
export function watchNotificationTaps(go: (route: Href) => void): () => void {
  const messaging = getMessaging();

  /* ── Remote, tapped while the app was backgrounded ───────────────────────── */
  const openedRemote = onNotificationOpenedApp(messaging, (message) => {
    go(routeFor(message?.data));
  });

  /* ── Remote, tapped from a cold start ────────────────────────────────────── */
  void getInitialNotification(messaging).then((message) => {
    if (message) go(routeFor(message.data));
  });

  /* ── Local, tapped in any state ──────────────────────────────────────────── */
  /*
   * One listener for both cases here, unlike the remote pair above:
   * expo-notifications queues the response that launched the app and delivers
   * it to the first listener that subscribes, so this covers the cold start
   * too. That is a documented difference between the two libraries and not an
   * omission.
   */
  const openedLocal = Notifications.addNotificationResponseReceivedListener((response) => {
    go(routeFor(response.notification.request.content.data as Record<string, unknown>));
  });

  /* ── Remote, arriving while the app is in the foreground ─────────────────── */
  /*
   * Subscribed to and deliberately *not* displayed.
   *
   * iOS does not show a push banner over the app that sent it, and neither
   * library does it for you — displaying one takes an explicit local
   * notification. This app does not: the person is already looking at it, and
   * the screen the notification is about is a tap away. A banner over the app
   * you are holding is the notification pattern everybody finds irritating.
   *
   * The listener exists because without one, RNFB logs a warning about an
   * unhandled foreground message on every delivery, and because this is where
   * anything that ought to refresh a visible screen would go.
   */
  const foreground = onMessage(messaging, async () => {
    /* Nothing to do. See above. */
  });

  return () => {
    openedRemote();
    openedLocal.remove();
    foreground();
  };
}

/**
 * How a notification behaves when it arrives with the app open.
 *
 * Set once, at module scope of the layout that imports this. Every flag is off:
 * no banner, no sound, no badge. See the foreground note above — this is the
 * same decision expressed to expo-notifications, and it covers the *local*
 * reminders, which iOS **will** present over their own app unless told not to.
 *
 * `shouldShowBanner` and `shouldShowList` replaced the single
 * `shouldShowAlert` flag; both are needed to keep a reminder out of Notification
 * Center as well as off the screen.
 */
export function quietInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
