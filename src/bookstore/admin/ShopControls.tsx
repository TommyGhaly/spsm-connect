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

import { Button } from '@/components/Surface';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export function ShopAdminBar({
  canEdit,
  editing,
  onEditing,
  onOrders,
  onMetrics,
  onAddBook,
  onCategories,
}: {
  canEdit: boolean;
  editing: boolean;
  onEditing: (next: boolean) => void;
  onOrders: () => void;
  onMetrics: () => void;
  onAddBook: () => void;
  onCategories: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: theme.space.sm,
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperSunken,
      }}
    >
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Orders" tone="quiet" onPress={onOrders} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Figures" tone="quiet" onPress={onMetrics} />
        </View>
        {canEdit ? (
          <View style={{ flex: 1 }}>
            <Button
              label={editing ? 'Done' : 'Edit shop'}
              tone={editing ? 'primary' : 'quiet'}
              onPress={() => onEditing(!editing)}
            />
          </View>
        ) : null}
      </View>

      {editing ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Add a book" tone="quiet" onPress={onAddBook} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Categories" tone="quiet" onPress={onCategories} />
            </View>
          </View>

          {/*
            Said once, here, rather than on every card: which controls wait for
            Save and which do not. The website's cards each carried a fragment
            of this sentence and it read as eleven repetitions of a warning.
          */}
          <Micro color={theme.color.inkFaint}>
            Counts, categories and pictures wait for the Save bar. Adding a book, removing
            one, and the categories themselves happen straight away. Tap a book for its
            title, price, description and pictures.
          </Micro>
        </>
      ) : null}
    </View>
  );
}
