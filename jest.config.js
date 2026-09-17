/**
 * Unit tests, on jest-expo.
 *
 * ---------------------------------------------------------------------------
 * A file rather than a `jest` key in package.json, because two of the four
 * settings below have to *extend* the preset rather than replace it, and JSON
 * cannot read what it is overriding. Jest replaces a key wholesale when the
 * project config declares it — so writing `moduleNameMapper` in package.json
 * would silently drop jest-expo's own mappings, the first of which is
 * `react-native/setup-env` and without which nothing runs at all.
 *
 * ## What is tested here, and what is not
 *
 * Modules that can run without a native runtime: the crash reporter, the upload
 * failure vocabulary, money. Not screens — a React Native component test needs
 * a renderer and a pile of native mocks, and buys less than `npm run
 * screenshots`, which drives the real app on a real simulator and produces
 * something a person can look at.
 * ---------------------------------------------------------------------------
 */
const preset = require('jest-expo/jest-preset');

module.exports = {
  ...preset,

  moduleNameMapper: {
    ...preset.moduleNameMapper,
    /*
     * `@spsm/shared` ships ESM — its package.json says `"type": "module"` — and
     * jest runs CJS, so babel transforms it on the way in and adds its own
     * helper imports. Those helpers are then resolved relative to the file
     * being transformed, which lives in ../Website, which has no
     * `@babel/runtime` of its own:
     *
     *   Cannot find module '@babel/runtime/helpers/interopRequireDefault'
     *   from '../Website/packages/shared/dist/config.js'
     *
     * This points them at the copy react-native already installs here. It is
     * the mapping, rather than an install in the other repo, because the other
     * repo does not need one — nothing there runs under jest.
     */
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },

  /*
   * Each worktree under .claude/ carries a whole copy of this project,
   * package.json included, and jest's haste map refuses two modules with the
   * same name:
   *
   *   jest-haste-map: Haste module naming collision: spsm-connect
   *
   * ios/ and android/ are here for the same reason — they are generated, and
   * Pods vendors more JavaScript than the app contains.
   */
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/ios/', '<rootDir>/android/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/', '<rootDir>/ios/', '<rootDir>/android/'],

  /*
   * Off, and this is an environment fact rather than a preference: watchman
   * cannot create its state directory on every machine this runs on, and when
   * it cannot, it does not degrade — it throws an unhandled 'error' event and
   * takes the whole run down before a single test is collected. Jest's own
   * crawler is slower and always works.
   */
  watchman: false,
};
