/**
 * Apple Pay or Google Pay, drawn by the platform.
 *
 * ---------------------------------------------------------------------------
 * This was `<Button label="Pay with wallet">`, and App Review could not find
 * the Apple Pay (Guideline 2.1, build 12): the binary links PassKit, and
 * nothing on screen said Apple Pay. Apple's rules are also that only its own
 * button may start an Apple Pay payment, and Google's say the same of Google
 * Pay. So the wallet is now offered by its own mark, from
 * modules/wallet-button, and the app's type is kept for the card.
 * ---------------------------------------------------------------------------
 *
 * `busy` and `disabled` are the app's, not the platform's — neither native
 * button has them — so they are a dimmed, untouchable button with a spinner
 * over it, the same look `Button` gives itself.
 */
import { ActivityIndicator, Platform, View } from 'react-native';

import { NativeWalletButton, type WalletButtonKind } from '../../modules/wallet-button';
import { Button } from '@/components/Surface';
import { useTheme } from '@/theme/ThemeProvider';

/** The wallet's own name, for the fallback and for anything that has to say it. */
export const walletName = Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay';

export function WalletButton({
  kind = 'buy',
  onPress,
  disabled = false,
  busy = false,
}: {
  kind?: WalletButtonKind;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const inert = disabled || busy;

  // A dev client built before the module existed. Still names the wallet.
  if (!NativeWalletButton) {
    return (
      <Button label={`Pay with ${walletName}`} onPress={onPress} disabled={disabled} busy={busy} />
    );
  }

  return (
    <View
      pointerEvents={inert ? 'none' : 'auto'}
      accessibilityState={{ disabled: inert, busy }}
      style={{ opacity: inert ? 0.5 : 1 }}
    >
      <NativeWalletButton
        kind={kind}
        cornerRadius={theme.radius.sm}
        onWalletPress={onPress}
        /*
         * 48 is Google Pay's own height for PayButton, and inside Apple's range
         * for PKPaymentButton (30–64pt); either way it clears the 44pt target
         * `Button` is held to.
         */
        style={{ height: 48, alignSelf: 'stretch' }}
      />
      {busy ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={theme.color.inkInverse} />
        </View>
      ) : null}
    </View>
  );
}
