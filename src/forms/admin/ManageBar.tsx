/**
 * The strip of controls above the forms, for whoever holds the `forms` grant.
 *
 * ---------------------------------------------------------------------------
 * The bookstore's `ShopAdminBar`, for the other tab that is two audiences on
 * one screen — and it is deliberately the same shape, because it is the same
 * situation. A parishioner opens Forms to fill one in; the office opens it to
 * say which ones exist and what order they come in. Editing in place is what
 * lets one screen be both, and this row is then the only thing standing between
 * the two audiences.
 *
 * ## It used to be a button that pushed a screen
 *
 * "Forms & submissions", at the foot of the hub, going to `/forms/admin` — a
 * second list, of the same forms, in a different shape, with none of the
 * photographs. Two lists of one thing is two places to look and two vocabularies
 * for one question, and the admin one could not answer "is this card any good"
 * because it did not draw the card.
 *
 * The website does not have that problem and never had it: there, this is a
 * drawer *over* `/forms`, so the page stays behind it. A phone has no room for a
 * page and a drawer over it at once, which is what the old note here concluded
 * a pushed screen from — but in-place editing is the other way to keep the page,
 * and it is the one the bookstore already uses.
 *
 * ## What stays a pushed screen, and why
 *
 * Submissions and Import. Neither is a fact *about the list*: submissions are
 * real people's answers, with their own filters and their own privacy, and an
 * import is a wizard that ends in a new form. Both are somewhere you go, do a
 * thing, and come back from — which is what a pushed screen is for. The builder
 * is the same, reached by pressing a form.
 * ---------------------------------------------------------------------------
 */
import { View } from 'react-native';

import { Button } from '@/components/Surface';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export function ManageBar({
  managing,
  onManaging,
  onSubmissions,
  onNewForm,
  onImport,
}: {
  managing: boolean;
  onManaging: (next: boolean) => void;
  onSubmissions: () => void;
  onNewForm: () => void;
  onImport: () => void;
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
        {/*
          Submissions is the leftmost thing and is one press from the hub in
          both modes, for the reason the shop puts Orders there: it is what
          somebody opens this tab for on a Monday morning, and it has nothing
          to do with managing the list.
        */}
        <View style={{ flex: 1 }}>
          <Button label="Submissions" tone="quiet" onPress={onSubmissions} />
        </View>
        <View style={{ flex: 1 }}>
          {/*
            A switch that says which state it is in, not a button that silently
            flips one — managing changes what every card below does.
          */}
          <Button
            label={managing ? 'Done' : 'Manage forms'}
            tone={managing ? 'primary' : 'quiet'}
            onPress={() => onManaging(!managing)}
          />
        </View>
      </View>

      {managing ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="New form" tone="quiet" onPress={onNewForm} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Import" tone="quiet" onPress={onImport} />
            </View>
          </View>

          {/*
            Said once, here, rather than on every card — the shop's note gives
            the reason: a fragment of this sentence on each of seven cards reads
            as seven repetitions of a warning.

            The thing worth saying is that nothing here waits for a Save. Every
            control on a card is one field on one document and is written as it
            is pressed, which is the opposite of the shop, where counts and
            categories queue up behind the Save bar. A volunteer who has used
            both should be told which one they are in.
          */}
          <Micro color={theme.color.inkFaint}>
            Every tick here saves as you press it. Drag a form by its handle to change the
            order on this page. Tap a form to edit its questions, title and picture.
          </Micro>
        </>
      ) : null}
    </View>
  );
}
