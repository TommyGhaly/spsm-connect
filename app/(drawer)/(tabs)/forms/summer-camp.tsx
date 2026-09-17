/**
 * `/forms/summer-camp` — the camp's servant sign-up.
 *
 * A static segment beside `[slug]`, matching the website's route. Expo Router
 * prefers the static one, so a form somebody names "summer-camp" in the builder
 * would be shadowed by this screen — which is the same thing that would happen
 * on the website, and the reason the camp's card is assembled in code rather
 * than stored as a form.
 */
import { ServantSignUp } from '@/camp/ServantSignUp';

export default function Screen() {
  return <ServantSignUp />;
}
