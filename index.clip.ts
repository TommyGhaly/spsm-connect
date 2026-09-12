/**
 * The App Clip's entry point. Resolved instead of index.ts when Metro is
 * bundling with BUILDING_FOR_APP_CLIP set — see metro.config.js.
 *
 * Nothing here imports expo-router, which is the entire reason this file
 * exists.
 */
import { registerRootComponent } from 'expo';

import { ClipRoot } from '@/clip/ClipRoot';

registerRootComponent(ClipRoot);
