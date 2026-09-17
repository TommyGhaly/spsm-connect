/**
 * `/admin/camp/attendance` — the register.
 *
 * The URL is the website's and is load-bearing twice over: it is App Clip
 * experience #9, so a tag pointing at it has to land here, and it is what a
 * link copied off a laptop opens. See `(tabs)/_layout.tsx` for why this is the
 * one camp screen that becomes a tab, and only during the camp.
 */
import { Register } from '@/camp/admin/Register';

export default function Screen() {
  return <Register />;
}
