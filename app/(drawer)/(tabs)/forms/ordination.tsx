/**
 * `/forms/ordination` — the nomination for ordination.
 *
 * A static segment beside `[slug]`, matching the website's route, for the
 * reason `summer-camp.tsx` gives: it is not a `FormDefinition`, and the static
 * route wins over a stored form of the same slug on both.
 */
import { NominationScreen } from '@/ordination/NominationScreen';

export default function Screen() {
  return <NominationScreen />;
}
