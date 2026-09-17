/**
 * `/admin/camp` — the camp's front page.
 *
 * The website's URL, kept exactly: the three camp screens are linked to each
 * other by the shell's own nav and to the website by whatever somebody copied
 * out of a laptop's address bar.
 *
 * Not in the tab bar. The register earns a tab during the camp because it is
 * used all day at a door; this is read once a season, from the drawer or from
 * the nav on the register itself. See `(tabs)/_layout.tsx`.
 */
import { CampHome } from '@/camp/admin/CampHome';

export default function Screen() {
  return <CampHome />;
}
