/**
 * "Open the camera, pointed here" — one destination, handed from a gallery
 * page to the camera tab.
 *
 * ## Why this exists rather than a route parameter
 *
 * The camera is a *tab*, and a tab keeps its parameters. Pushing
 * `/?programEventId=…` would aim it correctly once and then go on aiming it
 * every time somebody returned to the tab for the rest of the session, because
 * the params are still on the route — which is precisely the failure
 * `useDestination` was written to avoid: a pill that says the same thing every
 * day until it files the Nativity liturgy under last month's camp. Clearing
 * them again means a second navigation as a side effect of arriving, which is
 * a worse thing than a module variable.
 *
 * So the request is a one-shot: written by the gallery, taken by the camera on
 * the way in, and gone. Taking it is what clears it, so there is no state to
 * reset and nothing that can be read twice.
 *
 * ## Why it expires
 *
 * Because a request that is never taken is otherwise taken *later*. Somebody
 * presses "Take photographs" on Day 3, the navigation is interrupted — a
 * notification, a call, a cold app kill mid-press — and an hour later they open
 * the camera at a completely different service to find it pointed at Day 3 with
 * nothing on screen to say why. A destination is a claim about the photograph
 * in somebody's hand and it goes stale as fast as that does.
 */
import type { Destination } from './destination';

/** How long a request is worth honouring. A navigation, not an errand. */
const GOOD_FOR_MS = 30_000;

let pending: { destination: Destination; at: number } | null = null;

/**
 * Ask the camera to open pointed at this level.
 *
 * Call it immediately before navigating to the camera, and nowhere else: this
 * is not a way to set a default, and the next screen to focus takes it
 * whichever screen that turns out to be.
 */
export function requestDestination(destination: Destination): void {
  pending = { destination, at: Date.now() };
}

/** Take the request, if there is a fresh one. Taking it clears it. */
export function takeRequestedDestination(): Destination | null {
  const request = pending;
  pending = null;

  if (!request) return null;
  return Date.now() - request.at <= GOOD_FOR_MS ? request.destination : null;
}
