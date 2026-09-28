/** See `storeArtwork.ts`: on Android, Google Play's badge alone. */
import type { ImageSourcePropType } from 'react-native';

export const APPLE_BADGE: ImageSourcePropType | null = null;
export const PLAY_BADGE: ImageSourcePropType | null =
  require('../../assets/brand/google-play-badge.png') as ImageSourcePropType;
