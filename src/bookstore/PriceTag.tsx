/**
 * A price as the shop shows it — the website's `PriceTag`.
 *
 * Crossed out beside the clearance price when the item is on clearance, and for
 * clothing whose sizes cost different amounts, the range — or the one size's
 * price once a size is chosen.
 *
 * Text spans rather than a block, so it sits inside whichever type role the
 * caller wraps it in (`<Body><PriceTag … /></Body>`) and takes that size and
 * face; only the strike and the sale colour are its own.
 */
import { Text } from 'react-native';
import { clearanceOf } from '@spsm/shared';

import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import type { ShopProduct } from './data';

function spanOf(product: ShopProduct, size: string | null) {
  const chosen = size ? product.sizes?.find((one) => one.label === size) : undefined;
  const extras = chosen
    ? [chosen.extraCents]
    : product.sizes?.length
      ? product.sizes.map((one) => one.extraCents)
      : [0];
  const low = Math.min(...extras);
  const high = Math.max(...extras);
  return (base: number) =>
    low === high
      ? money(base + low, product.currency)
      : `${money(base + low, product.currency)}–${money(base + high, product.currency)}`;
}

/** The same price in words, for a card's or a row's accessibility label. */
export function priceWords(product: ShopProduct, size: string | null = null): string {
  const span = spanOf(product, size);
  const sale = clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount });
  return sale ? `was ${span(sale.wasCents)}, now ${span(sale.nowCents)}` : span(product.amount);
}

export function PriceTag({
  product,
  size = null,
}: {
  product: ShopProduct;
  size?: string | null;
}) {
  const theme = useTheme();
  const span = spanOf(product, size);
  const sale = clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount });

  if (!sale) return <>{span(product.amount)}</>;
  return (
    <>
      <Text style={{ textDecorationLine: 'line-through', color: theme.color.inkFaint }}>
        {span(sale.wasCents)}
      </Text>{' '}
      <Text style={{ color: theme.color.accent }}>{span(sale.nowCents)}</Text>
    </>
  );
}
