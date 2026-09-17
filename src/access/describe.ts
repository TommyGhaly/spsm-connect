/**
 * Saying what somebody administers, in English.
 *
 * The four functions the website's `AccessScreen` keeps at the bottom of
 * itself, lifted into a file of their own because here they are read by two
 * screens rather than one: the directory needs the one-line tally under a name,
 * and the person's screen needs the chips, the orphan note and the sentence
 * describing an unsaved change.
 *
 * None of them decides anything. They are descriptions of maps that
 * `firestore.rules` is the authority on, and a wrong sentence here is a wrong
 * sentence and not a permission.
 */
import { SCREEN_AREAS, UNOFFERED_LABELS, UNOFFERED_SCREENS, FINANCE_SOURCE_ROWS } from './areas';
import type { Allocation, AllocatableMember } from './data';

/**
 * Everything they hold, as a list of short labels.
 *
 * Ministries are counted rather than named. A servant with one ministry is the
 * common case and "1 ministry" is enough to say so; a chip per ministry would
 * be the longest thing on the screen for the person who runs six.
 */
export function heldChips(member: AllocatableMember): string[] {
  const chips = SCREEN_AREAS.filter((area) => member.screenAdmin[area.key]).map(
    (area) => area.label,
  );
  const ministries = member.programAdmin.programs.length;
  if (ministries > 0) {
    chips.push(`${ministries} ministr${ministries === 1 ? 'y' : 'ies'}`);
  }
  return chips;
}

/**
 * The flags they hold that this screen does not offer a control for.
 *
 * Empty for anybody allocated from here, because those flags can only be set
 * from the Firebase console. It is drawn when it is not empty, because
 * `saveAllocation` writes the whole map back — so this screen preserves those
 * grants and would otherwise never mention them, which is the one thing worse
 * than not offering them.
 */
export function unofferedHeld(member: AllocatableMember): string[] {
  return UNOFFERED_SCREENS.filter((screen) => member.screenAdmin[screen]).map(
    (screen) => UNOFFERED_LABELS[screen] ?? screen,
  );
}

/**
 * One line under a name in the directory.
 *
 * A count rather than a list: the directory is a list of people and the
 * question it answers is "who has anything at all", which is what makes the
 * person worth opening.
 */
export function tally(member: AllocatableMember): string {
  if (member.superadmin) return 'superadmin — every area';

  const areas = SCREEN_AREAS.filter((area) => member.screenAdmin[area.key]).length;
  const ministries = member.programAdmin.programs.length;
  if (areas === 0 && ministries === 0) {
    const orphans = unofferedHeld(member).length;
    if (orphans > 0) return `${orphans} area${orphans === 1 ? '' : 's'}, not shown here`;
    return 'nothing yet';
  }

  const parts: string[] = [];
  if (areas > 0) parts.push(`${areas} area${areas === 1 ? '' : 's'}`);
  if (ministries > 0) parts.push(`${ministries} ministr${ministries === 1 ? 'y' : 'ies'}`);
  return parts.join(' · ');
}

/**
 * What pressing Save would do, as a sentence.
 *
 * This is why the explicit Save on this screen is worth the exception it is —
 * everything else in this app saves as you type. The save bar sits at the foot
 * of a screen taller than the phone, so at the moment of pressing Save the
 * boxes that were ticked are usually scrolled out of sight, and "not saved yet"
 * confirms only that *something* is pending. Naming it means you are told what
 * you are about to do to somebody while the button is under your thumb.
 */
export function pendingChange(
  saved: Allocation,
  draft: Allocation,
  campProgramId: string,
): string {
  const added: string[] = [];
  const removed: string[] = [];

  for (const area of SCREEN_AREAS) {
    if (draft.screenAdmin[area.key] === saved.screenAdmin[area.key]) continue;
    (draft.screenAdmin[area.key] ? added : removed).push(area.label);
  }

  const was = new Set(saved.programAdmin.programs);
  const now = new Set(draft.programAdmin.programs);
  const gained = [...now].filter((id) => !was.has(id));
  const lost = [...was].filter((id) => !now.has(id));

  /*
   * The camp's ministry is named rather than counted, and named as its
   * *gatherings* — "the summer camp" is the Summer camp area, which is the
   * registrations, and a status line that used the same words for both would be
   * reporting the one change this screen most needs to keep distinct.
   */
  for (const [ids, into] of [
    [gained, added],
    [lost, removed],
  ] as const) {
    const ministries = ids.filter((id) => id !== campProgramId).length;
    if (ids.includes(campProgramId)) into.push('the camp’s gatherings and photographs');
    if (ministries > 0) into.push(`${ministries} ministr${ministries === 1 ? 'y' : 'ies'}`);
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`Adding ${sentence(added)}`);
  // Capitalised only when it leads. "removing Bookstore. Not saved yet." reads
  // as a fragment of a sentence whose first half had gone missing.
  if (removed.length > 0) {
    parts.push(`${added.length > 0 ? 'removing' : 'Removing'} ${sentence(removed)}`);
  }

  const financeChanged = FINANCE_SOURCE_ROWS.some(
    (source) => draft.financeScopes[source.key] !== saved.financeScopes[source.key],
  );
  if (financeChanged) {
    const kept = FINANCE_SOURCE_ROWS.filter((source) => draft.financeScopes[source.key]);
    parts.push(
      kept.length === FINANCE_SOURCE_ROWS.length
        ? 'Finance opened to all of it'
        : kept.length === 0
          ? 'Finance showing nothing'
          : `Finance narrowed to ${sentence(kept.map((source) => lower(source.label)))}`,
    );
  }

  // The fallback is not dead code: a draft also counts as dirty for an
  // event-level grant, which this screen shows and does not edit.
  if (parts.length === 0) return 'Not saved yet.';

  const grants = parts.filter((part) => !part.startsWith('Finance'));
  const finance = parts.filter((part) => part.startsWith('Finance'));
  return [grants.join(', '), ...finance, 'Not saved yet']
    .filter((part) => part !== '')
    .map((part) => `${part}.`)
    .join(' ');
}

/** The first name, for a sentence addressed about somebody. */
export function firstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName;
}

/** "The bookstore" mid-sentence, where the label's capital would read as a name. */
function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function sentence(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
