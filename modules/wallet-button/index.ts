/**
 * The platform's own wallet button: Apple Pay's `PKPaymentButton` on iOS,
 * Google Pay's `PayButton` on Android. See ios/WalletButtonModule.swift for
 * why the app may not draw its own.
 *
 * `null` on a binary built before this module existed — an older dev client —
 * so the caller can fall back to a plain button instead of a red screen.
 */
import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

/**
 * Which words the mark carries. `buy` is "Buy with Apple Pay" / "Buy with
 * G Pay"; `plain` is the mark alone, for a fee that is not a purchase.
 */
export type WalletButtonKind = 'buy' | 'checkout' | 'continue' | 'plain';

export interface NativeWalletButtonProps extends ViewProps {
  kind?: WalletButtonKind;
  cornerRadius?: number;
  /**
   * Not `onPress`: React Native already registers `topPress` as a bubbling
   * event, and a view declaring it as a direct one is an invariant violation
   * the moment the view first renders.
   */
  onWalletPress?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
}

export const NativeWalletButton: ComponentType<NativeWalletButtonProps> | null =
  requireOptionalNativeModule('WalletButton')
    ? requireNativeView<NativeWalletButtonProps>('WalletButton')
    : null;
