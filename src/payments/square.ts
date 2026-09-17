/**
 * Square, on a phone.
 *
 * The website collects a card with Square's Web Payments SDK in an iframe and
 * posts the resulting one-time token to `/api/square/checkout`. This is the
 * same arrangement with a different collector: the In-App Payments SDK puts
 * Square's own native card sheet on screen, hands back a nonce, and the nonce
 * goes to the same Cloud Function, which prices the basket from the catalog and
 * charges it. Nothing here ever sees a card number, and there is deliberately
 * nowhere in the request to put a price.
 *
 * So the Function needed no change to serve the app. `source_id` is the only
 * thing it takes, and a nonce is a nonce whether a browser or a phone minted
 * it — see functions/src/checkout.ts in the Website repo, whose header explains
 * why the amount is not in the request.
 *
 * The ids come from app.config.ts rather than `process.env` directly, because
 * there are two sets of them and exactly one must reach the binary. The long
 * note there is the one to read before changing anything about environments.
 */
import Constants from 'expo-constants';
import type { CardDetails } from 'react-native-square-in-app-payments';
import { Platform } from 'react-native';

import { apiPost } from '@/api/client';

/**
 * The SDK, required on first use rather than imported at the top of this file.
 *
 * ---------------------------------------------------------------------------
 * This was a static import, and it took the forms screen down with it.
 *
 * `react-native-square-in-app-payments` calls
 * `TurboModuleRegistry.getEnforcing('SQIPCore')` while the module is being
 * evaluated. `getEnforcing` throws when the native module is absent, so on a
 * binary without the pod — an older simulator build, or any target that does
 * not ship Square — the throw happened at *import* time. Everything that
 * imported this file transitively went with it: `FormRenderer` imports it to
 * offer Apple Pay on a paid form, so opening **any** form, free or not, was an
 * uncaught error and a red screen.
 *
 * That contradicted the sentence this file already carried about
 * `checkoutAvailable`: "a build made without the Square ids is a perfectly good
 * build of everything else". It was not, because the import ran first.
 *
 * So the module is fetched inside a `try` on first use and remembered. `null`
 * means this binary has no Square in it, which is an ordinary answer — the
 * screens then say checkout is unavailable, and every other part of a form
 * keeps working.
 * ---------------------------------------------------------------------------
 */
type SquareSdk = typeof import('react-native-square-in-app-payments');

let sdk: SquareSdk | null | undefined;

function squareSdk(): SquareSdk | null {
  if (sdk === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      sdk = require('react-native-square-in-app-payments') as SquareSdk;
    } catch (error) {
      console.warn('[square] the In-App Payments SDK is not in this binary.', error);
      sdk = null;
    }
  }
  return sdk;
}

interface SquareConfig {
  environment: 'sandbox' | 'production';
  applicationId: string;
  locationId: string;
  applePayMerchantId: string;
}

const configured = (Constants.expoConfig?.extra?.square ?? {}) as Partial<SquareConfig>;

export const square: SquareConfig = {
  environment: configured.environment === 'production' ? 'production' : 'sandbox',
  applicationId: configured.applicationId ?? '',
  locationId: configured.locationId ?? '',
  applePayMerchantId: configured.applePayMerchantId ?? '',
};

/**
 * Whether this build can take a payment at all.
 *
 * False is an ordinary state, not a bug: a build made without the Square ids
 * is a perfectly good build of everything else. The shop screen reads this and
 * says checkout is unavailable, rather than showing a Buy button that throws.
 */
export const checkoutAvailable = Boolean(square.applicationId && square.locationId);

/**
 * Whether this device can actually be asked for money right now.
 *
 * Both halves of it: the ids have to be configured *and* the SDK has to be in
 * the binary. A screen renders its "checkout is unavailable" sentence from
 * this, synchronously, so it is a plain function rather than a promise — the
 * `require` behind it is cached after the first call.
 */
export function paymentsAvailable(): boolean {
  return checkoutAvailable && squareSdk() !== null;
}

/**
 * Initialise the SDK once per process.
 *
 * Held as a promise rather than a boolean so that two screens mounting at the
 * same moment await the same initialisation instead of racing to perform it
 * twice. Safe to call from anywhere, including before the ids are known to be
 * present — it resolves to a no-op when checkout is switched off.
 */
let initialising: Promise<void> | null = null;

export function initSquare(): Promise<void> {
  if (!initialising) initialising = start();
  return initialising;
}

async function start(): Promise<void> {
  const sdk = squareSdk();
  if (!checkoutAvailable || !sdk) return;

  const { SQIPApplePay, SQIPCore, SQIPGooglePay, GooglePayEnvironment } = sdk;

  await SQIPCore.setSquareApplicationId(square.applicationId);

  /*
   * The wallets, each of which is allowed to fail without taking checkout with
   * it. A device with no Apple Pay configured, or a Play Services install too
   * old for the Wallet API, must still be able to type a card in — so a wallet
   * that will not initialise becomes a hidden button, not an unusable screen.
   */
  if (Platform.OS === 'ios' && square.applePayMerchantId) {
    try {
      await SQIPApplePay.initializeApplePay(square.applePayMerchantId);
    } catch (error) {
      console.warn('[square] Apple Pay did not initialise; card entry is unaffected.', error);
    }
  }

  if (Platform.OS === 'android') {
    try {
      await SQIPGooglePay.initializeGooglePay(
        square.locationId,
        /*
         * The environment pair that must match the ids. Google Pay's test
         * environment returns a nonce Square's sandbox will spend and its
         * production API will refuse, so pairing this with the wrong ids gives
         * the invalid-source-id error that reads like a declined card.
         */
        square.environment === 'production'
          ? GooglePayEnvironment.EnvironmentProduction
          : GooglePayEnvironment.EnvironmentTest,
      );
    } catch (error) {
      console.warn('[square] Google Pay did not initialise; card entry is unaffected.', error);
    }
  }
}

/** Whether this device can offer a wallet button next to the card one. */
export async function walletAvailable(): Promise<boolean> {
  await initSquare();
  const sdk = squareSdk();
  if (!checkoutAvailable || !sdk) return false;

  const { SQIPApplePay, SQIPGooglePay } = sdk;

  try {
    if (Platform.OS === 'ios') {
      return square.applePayMerchantId ? await SQIPApplePay.canUseApplePay() : false;
    }
    return await SQIPGooglePay.canUseGooglePay();
  } catch {
    // A wallet that cannot answer the question is a wallet we do not offer.
    return false;
  }
}

/**
 * Everything the checkout Function needs except the payment token.
 *
 * Mirrors the body `squareCheckout` reads. `cart` carries slugs and quantities
 * and no prices — the Function looks each slug up in the catalog and charges
 * what Square says, so a basket edited on the device cannot change the total.
 */
export interface CheckoutDetails {
  cart: { slug: string; quantity: number }[];
  email: string;
  firstName: string;
  lastName: string;
  fulfillment: 'ship' | 'collect';
  address?: Record<string, string>;
  /**
   * Stable for the whole attempt, and that is the point.
   *
   * Square treats a repeated idempotency key as the same payment, so a buyer
   * whose first card is declined and who immediately tries another must reuse
   * this value — a fresh key on the retry is a second payment, and the way that
   * fails is by charging twice. Generate it once when the basket opens
   * checkout, hold it across every attempt, and discard it only when an attempt
   * succeeds. Each attempt needs a *new nonce* and the *same key*.
   */
  idempotencyKey: string;
}

export interface CheckoutResult {
  ok: true;
  orderId: string;
  status: string;
  total: number;
}

function charge(nonce: string, details: CheckoutDetails): Promise<CheckoutResult> {
  return apiPost<CheckoutResult>('/api/square/checkout', {
    sourceId: nonce,
    cart: details.cart,
    email: details.email,
    firstName: details.firstName,
    lastName: details.lastName,
    fulfillment: details.fulfillment,
    address: details.address,
    idempotencyKey: details.idempotencyKey,
  });
}

/* -------------------------------------------------------------------------- */
/* Collecting a payment: a nonce, and whatever the caller does with it          */
/* -------------------------------------------------------------------------- */

/**
 * Square's native card sheet, and the request that follows it.
 *
 * Resolves to whatever `settle` returned when the money moves, or to `null`
 * when the buyer closes the sheet — cancelling is an ordinary outcome and not
 * an error.
 *
 * `settle` runs *inside* the SDK's success callback, and that is the whole
 * shape of this function. A declined card keeps the buyer in Square's own sheet
 * with the reason printed on it and the field ready to be corrected; resolving
 * first and reporting the decline on our own screen would make them start again.
 *
 * It is generic because two different requests spend a nonce. The bookstore
 * posts a basket to `/api/square/checkout`; a paid form posts its *answers* to
 * `/api/forms/submit`, which prices them from the stored definition and charges
 * and stores in one go — a form that took the money and then failed to save the
 * submission would have charged somebody for a registration the church has no
 * record of.
 */
export async function chargeWithCard<T>(
  settle: (nonce: string) => Promise<T>,
): Promise<T | null> {
  await initSquare();
  const sdk = squareSdk();
  // Nothing to open. The caller reads `null` as "the sheet was dismissed",
  // which is the right thing to do with a card sheet that cannot exist.
  if (!sdk) return null;

  const { SQIPCardEntry } = sdk;

  return new Promise<T | null>((resolve) => {
    let settled: T | null = null;

    SQIPCardEntry.startCardEntryFlow(
      false, // No postal code: the caller takes the address it needs separately.
      async (cardDetails: CardDetails) => {
        if (!cardDetails.nonce) {
          return { success: false, errorMessage: 'That card could not be read. Please try again.' };
        }
        try {
          settled = await settle(cardDetails.nonce);
          return { success: true, onCardEntryComplete: () => resolve(settled) };
        } catch (error) {
          /*
           * The Function's own words. Every refusal in this codebase answers
           * with copy written to be shown, and ApiError carries it through —
           * "A valid email address is needed for the receipt" is more use
           * inside the card sheet than "402".
           */
          const message =
            error instanceof Error ? error.message : 'The payment could not be completed.';
          return { success: false, errorMessage: message };
        }
      },
      () => resolve(null),
    );
  });
}

/**
 * Apple Pay or Google Pay, whichever this platform is.
 *
 * `price` is a display total and nothing more — the wallet sheet has to show a
 * number before the charge exists. What is actually charged is decided by the
 * server: Square prices the bookstore basket from its own catalog, and
 * `formSubmit` prices a form from the stored definition. Quote this from what
 * the person was just looking at, because they must never authorise one number
 * and be charged another.
 *
 * Answers `null` when this device has no wallet, so a caller can fall back to
 * the card sheet rather than showing a button that does nothing.
 */
export async function chargeWithWallet<T>(
  price: string,
  settle: (nonce: string) => Promise<T>,
  summaryLabel = 'St. Philopater & St. Mina',
): Promise<T | null> {
  await initSquare();
  if (!(await walletAvailable())) return null;

  const sdk = squareSdk();
  if (!sdk) return null;

  const { ApplePayNonceSuccessState, GooglePayPriceStatus, SQIPApplePay, SQIPGooglePay } = sdk;

  if (Platform.OS === 'ios') {
    return new Promise<T | null>((resolve, reject) => {
      let settled: T | null = null;

      void SQIPApplePay.requestApplePayNonce(
        {
          price,
          summaryLabel,
          countryCode: 'US',
          currencyCode: 'USD',
        },
        async (cardDetails: CardDetails) => {
          if (!cardDetails.nonce) {
            return {
              state: ApplePayNonceSuccessState.Failure,
              errorMessage: 'Apple Pay returned no token.',
            };
          }
          try {
            settled = await settle(cardDetails.nonce);
            return { state: ApplePayNonceSuccessState.Succeeded };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'The payment could not be completed.';
            return { state: ApplePayNonceSuccessState.Failure, errorMessage: message };
          }
        },
        (error) => reject(new Error(error.message)),
        // Fires once the sheet is gone, whatever happened in it.
        () => resolve(settled),
      );
    });
  }

  return new Promise<T | null>((resolve, reject) => {
    void SQIPGooglePay.requestGooglePayNonce(
      { price, currencyCode: 'USD', priceStatus: GooglePayPriceStatus.TotalPriceStatusFinal },
      (cardDetails: CardDetails) => {
        if (!cardDetails.nonce) {
          reject(new Error('Google Pay returned no token.'));
          return;
        }
        /*
         * Unlike the card sheet and Apple Pay, Google Pay's success callback
         * takes no result — its sheet is already closed by the time we are
         * called, so a decline has nowhere to be shown but our own screen.
         */
        settle(cardDetails.nonce).then(resolve, reject);
      },
      (error) => reject(new Error(error.message)),
      () => resolve(null),
    );
  });
}

/* -------------------------------------------------------------------------- */
/* The bookstore's two, in terms of the two above                              */
/* -------------------------------------------------------------------------- */

/** Square's card sheet, charging a basket through `/api/square/checkout`. */
export function payWithCard(details: CheckoutDetails): Promise<CheckoutResult | null> {
  return chargeWithCard((nonce) => charge(nonce, details));
}

/** The same basket, through whichever wallet this platform has. */
export function payWithWallet(
  details: CheckoutDetails,
  price: string,
): Promise<CheckoutResult | null> {
  return chargeWithWallet(price, (nonce) => charge(nonce, details));
}
