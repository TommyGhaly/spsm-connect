/**
 * Prices, and the one rule the shop's whole column depends on.
 *
 * `money` is four lines and is tested because it is the last thing between an
 * integer number of cents and a number somebody is about to be charged. The two
 * failures worth guarding are a factor of a hundred — `1500` drawn as "$1500.00"
 * rather than "$15.00" — and the cents being dropped on a whole dollar, which
 * its header explains turns a column of prices into a column of labels.
 */
import { money } from './money';

describe('money', () => {
  it('reads minor units, not dollars', () => {
    // The failure this guards is a factor of a hundred in the direction nobody
    // notices until a receipt arrives.
    expect(money(500)).toBe('$5.00');
    expect(money(1500)).toBe('$15.00');
    expect(money(825)).toBe('$8.25');
  });

  it('keeps the cents on a whole dollar', () => {
    // "$15" reads as a label where "$15.00" reads as a price.
    expect(money(1500)).toBe('$15.00');
    expect(money(100)).toBe('$1.00');
    expect(money(0)).toBe('$0.00');
  });

  it('never gives more than two decimal places', () => {
    // A price arriving as a non-integer is a bug upstream, but rounding it in
    // the display is better than drawing "$3.3333333".
    expect(money(333.333)).toBe('$3.33');
  });

  it('handles a price larger than anything in the shop', () => {
    expect(money(123456)).toBe('$1,234.56');
  });

  it('honours a currency other than dollars', () => {
    expect(money(1500, 'EUR')).toContain('15.00');
  });
});
