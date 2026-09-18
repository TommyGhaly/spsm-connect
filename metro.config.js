// Metro, taught to follow @spsm/shared out of the project root.
//
// The app depends on `file:../Website/packages/shared`, which npm installs as a
// symlink. Metro does not watch or resolve through a symlink that points outside
// the project by default, so without `watchFolders` every import from
// @spsm/shared fails to resolve — and a rebuild of shared is never picked up.
//
// This is the one environmental assumption the app makes: the Website repo is
// checked out beside it, at ../Website. See README.md.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../Website/packages/shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

// @spsm/shared is ESM-only: `"type": "module"`, an `exports` map, and no CJS
// fallback. Metro needs package-exports support turned on to read that map.
config.resolver.unstable_enablePackageExports = true;

// Its emitted imports carry explicit `.js` extensions (tsc `moduleResolution:
// NodeNext`), so keep the default extension handling and let node_modules
// resolution fall back to the app's own tree for anything shared does not bring
// — it has no runtime dependencies of its own, so this is only belt and braces.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

/*
 * There is no App Clip resolution here any more.
 *
 * The clip used to be React Native, and this file carried the seam that gave it
 * its own JS: `.clip` prepended to the source extensions, plus two package
 * aliases. All of it is gone because the clip is gone from Metro's world — it
 * is native SwiftUI now, in `ios-appclip/`, and bundles no JavaScript at all.
 *
 * The reason is the size limit that block used to describe: 15 MB uncompressed
 * for a physical invocation, and every tag the church owns is physical. The
 * React Native clip measured 61 MB, of which React.framework and Hermes alone
 * were 16.5 MB — over the budget before any of this church's code. No amount of
 * resolution trickery reaches 15 MB from there. See plugins/withNativeClip.js.
 */

module.exports = config;
