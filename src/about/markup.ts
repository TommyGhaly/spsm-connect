/**
 * The church's markup, as one expression, in a module with nothing else in it.
 *
 * It lived in `Rich.tsx` and moved here the moment a second reader appeared.
 * `marks.ts` — the formatting buttons — has to agree with the renderer about
 * where a bold run ends, so it must read the same pattern rather than a copy;
 * but importing it from `Rich` pulled a React component, the theme provider and
 * AsyncStorage into a pure string function, which is a native runtime a unit
 * test does not have.
 *
 * So: the language in one file, its renderer in `Rich.tsx`, its keyboard in
 * `marks.ts`, and nothing importing more than it needs.
 */

/*
 * One expression, three alternatives, in the order they must be tried.
 *
 * `**` before `*`: JavaScript alternation is first-match rather than
 * longest-match, so a bold run tried second is read as an empty italic run
 * followed by a literal asterisk. The `[^*]` inside the italic form stops it
 * swallowing the `**` of a bold run that follows it in the same paragraph.
 *
 * `[^*]+` in both forms is also why the two marks cannot nest, which is a fact
 * `marks.ts` is built around rather than one it works against.
 *
 * `g`, and only ever used with `matchAll`, which clones the expression rather
 * than walking its `lastIndex` — so two readers cannot leave state in it for
 * each other.
 */
export const MARKUP = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
