/**
 * Give Gradle enough heap to run R8.
 *
 * ---------------------------------------------------------------------------
 * ## The failure this exists to prevent
 *
 * Turning on `enableMinifyInReleaseBuilds` in app.config.ts — which is what
 * answers Play's "Obfuscation (3%)" warning — makes `:app:bundleRelease` die
 * partway through, on a 64 GB machine, like this:
 *
 *     The Daemon will expire immediately since the JVM garbage collector is
 *     thrashing. The currently configured max heap space is '2 GiB' and the
 *     configured max metaspace is '512 MiB'.
 *
 *     FAILURE: Build failed with an exception.
 *     * What went wrong:
 *     Gradle build daemon has been stopped: since the JVM garbage collector is
 *     thrashing
 *
 * `-Xmx2048m` is the React Native template's value and it was fine for years,
 * because without minification nothing in the build ever needed much. R8 is
 * different in kind: it loads the entire merged class hierarchy — React Native,
 * every Expo module, Firebase, Google Play services, all five Square AARs — and
 * holds the whole reference graph in memory to decide what is reachable. That
 * does not fit in 2 GB for an app this size.
 *
 * The failure is worth recognising because it does not name R8. The daemon dies
 * of GC thrashing several tasks later, during native library work, and reads
 * like a flaky build or a machine under load — so the honest first instinct is
 * to re-run it, which fails again in a different place.
 *
 * ## Why a plugin
 *
 * Same reason as plugins/withReleaseSigning.js, and the same reason
 * `enableMinifyInReleaseBuilds` is set in app.config.ts rather than in the
 * generated Gradle: `/android` is gitignored and rebuilt by
 * `npx expo prebuild --clean`. An edit to android/gradle.properties by hand is
 * correct until the next prebuild and then silently gone — and what it takes
 * with it is the release build, on whichever machine is cutting the release.
 *
 * `expo-build-properties` has no option for this. It covers minSdkVersion,
 * minification, proguard rules and a dozen other things, but the JVM the build
 * itself runs in is not among them, so it takes a plugin.
 *
 * ## The value
 *
 * 4 GB of heap and 1 GB of metaspace: twice and twice what the template gives,
 * which clears R8 with room to spare, and small enough to be safe on an EAS
 * Build worker rather than only on a developer's laptop. EAS reads this same
 * checked-in configuration, so a number that only fits a 64 GB Mac would turn
 * a local success into a remote OOM — the JVM would happily reserve more than
 * the container has and be killed for it.
 * ---------------------------------------------------------------------------
 */
const { withGradleProperties } = require('@expo/config-plugins');

const KEY = 'org.gradle.jvmargs';
const VALUE = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

/** Kept adjacent to the value so the generated file explains itself too. */
const NOTE =
  'Raised from the template\'s -Xmx2048m by plugins/withR8Heap.js: R8 needs it. See that file.';

module.exports = function withR8Heap(config) {
  return withGradleProperties(config, (mod) => {
    const properties = mod.modResults;
    const existing = properties.find((item) => item.type === 'property' && item.key === KEY);

    if (!existing) {
      throw new Error(
        `withR8Heap could not find \`${KEY}\` in android/gradle.properties. The template has ` +
          'changed; check what heap the build gets before trusting this plugin.',
      );
    }

    /*
     * Idempotent for the value, and for the comment separately — prebuild may
     * run this over a gradle.properties that already has both, and appending a
     * second copy of the note every time would slowly fill the file.
     */
    existing.value = VALUE;

    const hasNote = properties.some((item) => item.type === 'comment' && item.value === NOTE);
    if (!hasNote) {
      properties.splice(properties.indexOf(existing), 0, { type: 'comment', value: NOTE });
    }

    return mod;
  });
};
