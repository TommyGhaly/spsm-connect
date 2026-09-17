/**
 * Integer minor units to "$8.00".
 *
 * The website's `features/bookstore/money.ts`, verbatim in behaviour, and the
 * note there is the one that matters: cents always, including on whole
 * dollars. A column where some prices carry cents and some do not stops being a
 * column, and "$15" reads as a label where "$15.00" reads as a price.
 *
 * `Intl.NumberFormat` is available on Hermes — React Native ships the ICU
 * variant — so this is the same call the browser makes rather than a hand-rolled
 * `toFixed(2)` with a dollar sign glued to the front.
 */
export function money(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
