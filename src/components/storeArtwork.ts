/**
 * Which store badge this build carries: on iOS, the App Store's alone.
 *
 * App Review rejected 1.0 (8) under Guideline 2.3.10 for showing Google Play in
 * the binary, and each platform now shows only its own store. The `require`s
 * live in this file and in `storeArtwork.android.ts`, which Metro picks between
 * by platform, so the other store's PNG is not bundled at all rather than
 * merely hidden. `StoreBadges` treats `null` as "no badge for this store here"
 * and drops that store's link with it.
 */
import type { ImageSourcePropType } from 'react-native';

export const APPLE_BADGE: ImageSourcePropType | null =
  require('../../assets/brand/app-store-badge.png') as ImageSourcePropType;
export const PLAY_BADGE: ImageSourcePropType | null = null;
