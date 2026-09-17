/**
 * The bookstore tab.
 *
 * A wrapper, like every other route file in this app: the screen itself is in
 * `src/bookstore/` so that nothing about it depends on expo-router, and the
 * route is the one place that knows where it sits in the navigation.
 */
import { ShopScreen } from '@/bookstore/ShopScreen';

export default function Screen() {
  return <ShopScreen />;
}
