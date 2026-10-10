/**
 * The strip of controls above the shelf, for whoever runs the shop.
 *
 * ---------------------------------------------------------------------------
 * Nothing here is drawn for a shopper, and that is most of the design.
 *
 * The bookstore tab is the same screen for a parishioner buying a book and for
 * the volunteer who stocks it, which is the whole point of editing in place —
 * *"a lot of the settings can be done in the space that the product already
 * takes up"*. The cost of that decision is this row: the only thing standing
 * between the two audiences, and so the only thing that has to be exactly
 * right about who sees what.
 *
 *   `canReview`  Orders and Figures. The bookstore grant, or the bookstore
 *                slice of finance.
 *   `canEdit`    The Edit switch, and everything it reveals. Bookstore only.
 *
 * A treasurer therefore gets two links and no switch. See `session.ts` for why
 * those are two questions rather than one.
 *
 * ## It is a row of links first and a mode switch second
 *
 * Orders is what somebody opens this tab for on a Sunday morning, so it is the
 * leftmost thing and it is one press from the shelf. Editing is the rarer job
 * and it changes what every card below does, so it is a switch that says which
 * state it is in rather than a button that silently flips one.
 * ---------------------------------------------------------------------------
 */
import { View } from 'react-native';

import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export function ShopEditingNote() {
  const theme = useTheme();

  return (
    <View
      style={{
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperSunken,
      }}
    >
      {/*
        What is left of `ShopAdminBar` once its buttons moved to the pill in the
        bottom-right corner — see `components/AdminFab`. The sentence stays on
        the page because it is guidance about the cards below it rather than a
        control, and because it is only true while somebody is editing: an
        action sheet is the wrong place for a paragraph nobody asked to read.

        Said once, here, rather than on every card: which controls wait for Save
        and which do not. The website's cards each carried a fragment of it and
        that read as eleven repetitions of a warning.
      */}
      <Micro color={theme.color.inkFaint}>
        Counts, categories, weights, sales tax and pictures wait for the Save bar. Adding a
        book, removing one, the categories themselves, and the shop’s shipping and tax
        settings happen straight away. Tap a book for its title, price, description,
        weight and pictures.
      </Micro>
    </View>
  );
}
