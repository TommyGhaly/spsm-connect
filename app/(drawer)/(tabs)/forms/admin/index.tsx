/**
 * `/forms/admin` — now the Forms tab itself, with its manage mode on.
 *
 * The screen that used to live here drew a second list of the same forms, and
 * `ManagedForms` explains at length why that was the wrong shape. Managing the
 * list is a mode on the hub now, so there is nothing for this route to render.
 *
 * It is a redirect rather than a deleted file, because the address is one other
 * things still hold: the form builder's back button, anything the church has
 * bookmarked, and the `/forms/admin` link the website's own notes mention. A
 * dead route would answer those with the not-found screen.
 *
 * It does not turn the mode *on*. A redirect that flipped a switch would mean
 * arriving at the tab in a state the person did not ask for, and the one press
 * of "Manage forms" is cheaper than being surprised. The guard is gone with it
 * for the same reason — the hub draws its own controls only for the grant, and
 * a parishioner who followed this link should land on the forms, not on a
 * refusal.
 */
import { Redirect } from 'expo-router';

export default function Screen() {
  return <Redirect href="/forms" />;
}
