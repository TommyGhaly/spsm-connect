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
 * The App Clip's separate JS.
 *
 * `react-native-app-clip` sets BUILDING_FOR_APP_CLIP while it builds the Clip
 * target, and this is the whole of the mechanism it relies on: with `.clip`
 * prepended to the source extensions, `import { RootShell } from
 * '@/shell/RootShell'` resolves `RootShell.clip.tsx` in the clip build and
 * `RootShell.tsx` in the app's. Same import, two files, one binary each.
 *
 * It matters because of the size limit, which is the constraint that governs
 * every decision about the clip: **15 MB uncompressed for a physical
 * invocation**, and every tag the parish owns is physical. (The 100 MB budget
 * iOS 17 added is for digital invocations only — a link tapped in Safari or
 * Messages — so it does not apply to anything screwed to a wall.) Excluding a
 * native module from the clip target is `excludedPackages` in app.config.ts;
 * this is how the JS that would have imported it goes too.
 */
if (process.env.BUILDING_FOR_APP_CLIP) {
  config.resolver.sourceExts = [
    ...config.resolver.sourceExts.map((extension) => `clip.${extension}`),
    ...config.resolver.sourceExts,
  ];
}

module.exports = config;
