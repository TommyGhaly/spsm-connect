/**
 * `/admin/camp/groups` — the arrangement, read only.
 *
 * The website's URL. Arranging the board happens there; this answers "which
 * crew is this child in, and who is leading it" for somebody standing in the
 * hall. See `GroupsBoard` for why that split is the right one.
 */
import { GroupsBoard } from '@/camp/admin/GroupsBoard';

export default function Screen() {
  return <GroupsBoard />;
}
