/**
 * Editing the shop: one sheet, with its items, its categories and its settings.
 *
 * ---------------------------------------------------------------------------
 * The website's editing column (`ShopInspector` in `EditControls.tsx`), for a
 * phone. Edit opens on Items / Categories / Settings. Items is a searchable list
 * — price, sale, stock or sizes — with Add a product at the top; an item opens
 * from it, or from "Edit this item" in the item's own sheet on the shelf, with
 * "All items" to go back. The item is Details / Price & stock / Shipping, and
 * Settings is delivery and sales tax, each with the one Save footer.
 *
 * This replaced a Manage menu of five sheets (Add a book, Categories, Shipping
 * & tax, and the book's own sheet with a settings block under the shopper's
 * half), a stock stepper on every card, and a Save bar along the foot of the
 * shelf. Tommy, about the website: keep it simple — tabs first, plain forms.
 *
 * Leaving with changes held is refused, with a line saying so: an item's Back
 * and Done while the item has unsaved changes, and the Settings tab while it
 * has. Nothing is lost by pressing the wrong thing.
 * ---------------------------------------------------------------------------
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { clearanceOf, type BookstoreConfig } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Problem } from '@/components/Fields';
import { Body, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from '../Cover';
import { matches, type ShopProduct } from '../data';
import { AddProduct } from './AddProduct';
import { CategoryEditor } from './CategoryEditor';
import { EditTabs, EditorFrame, PanelBody } from './EditPanel';
import { ProductSettings } from './ProductSettings';
import { ShopSettings } from './ShopSettings';
import { usePendingEdits } from './pendingEdits';

type ShopTab = 'items' | 'categories' | 'settings';
type EditorView = { kind: 'shop' } | { kind: 'item'; slug: string } | { kind: 'add' };

export function ShopEditor({
  products,
  settings,
  start,
  refused,
  onDismissRefusal,
  onClose,
}: {
  products: ShopProduct[];
  settings: BookstoreConfig;
  /** Open on this item rather than on the list. */
  start: string | null;
  /** What the last Save came back with, if it came back badly. */
  refused: string | null;
  onDismissRefusal: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { edits } = usePendingEdits();
  const [view, setView] = useState<EditorView>(start ? { kind: 'item', slug: start } : { kind: 'shop' });
  const [tab, setTab] = useState<ShopTab>('items');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  /* An item that leaves the shop — removed here, or elsewhere — has nothing left
     to describe, so the list comes back rather than an empty panel. */
  const product =
    view.kind === 'item' ? (products.find((one) => one.slug === view.slug) ?? null) : null;
  const showing: EditorView = view.kind === 'item' && !product ? { kind: 'shop' } : view;

  const heldName = (() => {
    const slug = Object.keys(edits)[0];
    return slug ? (products.find((one) => one.slug === slug)?.name ?? 'this item') : null;
  })();

  const leave = (then: () => void) => {
    if (heldName) {
      setBlocked(`Save or discard your changes to ${heldName} first.`);
      return;
    }
    if (showing.kind === 'shop' && tab === 'settings' && settingsDirty) {
      setBlocked('Save or discard your settings changes first.');
      return;
    }
    setBlocked(null);
    then();
  };

  const notice =
    blocked || refused ? (
      <Pressable
        onPress={() => {
          setBlocked(null);
          onDismissRefusal();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Problem>
          <Body color={theme.color.ink}>{blocked ?? refused}</Body>
        </Problem>
      </Pressable>
    ) : null;

  return (
    <EditorFrame
      kind={showing.kind === 'item' ? 'Item' : showing.kind === 'add' ? 'New item' : 'Shop'}
      title={
        showing.kind === 'item' && product
          ? product.name
          : showing.kind === 'add'
            ? 'Add a product'
            : 'The bookstore'
      }
      onBack={showing.kind === 'shop' ? undefined : () => leave(() => setView({ kind: 'shop' }))}
      backLabel="All items"
      onClose={() => leave(onClose)}
      notice={notice}
    >
      {showing.kind === 'item' && product ? (
        <ProductSettings
          key={product.slug}
          product={product}
          sections={settings.sections}
          onRemoved={() => setView({ kind: 'shop' })}
        />
      ) : showing.kind === 'add' ? (
        <AddProduct sections={settings.sections} onClose={() => setView({ kind: 'shop' })} />
      ) : (
        <View style={{ flex: 1 }}>
          <EditTabs
            tabs={[
              { id: 'items', label: `Items (${products.length})` },
              { id: 'categories', label: 'Categories' },
              { id: 'settings', label: 'Settings', dirty: settingsDirty },
            ]}
            value={tab}
            onChange={(next) => {
              // Settings holds unsaved changes in its own state; leaving the tab would drop them.
              if (tab === 'settings' && settingsDirty && next !== 'settings') {
                setBlocked('Save or discard your settings changes first.');
                return;
              }
              setBlocked(null);
              setTab(next);
            }}
          />
          {tab === 'items' ? (
            <ItemList
              products={products}
              onAdd={() => setView({ kind: 'add' })}
              onSelect={(slug) => {
                setBlocked(null);
                setView({ kind: 'item', slug });
              }}
            />
          ) : tab === 'categories' ? (
            <CategoryEditor sections={settings.sections} products={products} />
          ) : (
            <ShopSettings
              settings={settings}
              taxedCount={products.filter((one) => one.taxable).length}
              onDirty={setSettingsDirty}
            />
          )}
        </View>
      )}
    </EditorFrame>
  );
}

/** Every item, searchable, each one a row that opens it. "Add a product" leads. */
function ItemList({
  products,
  onAdd,
  onSelect,
}: {
  products: ShopProduct[];
  onAdd: () => void;
  onSelect: (slug: string) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => (query.trim() ? products.filter((one) => matches(one, query)) : products),
    [products, query],
  );

  return (
    <PanelBody>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.xs,
          minHeight: 48,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.color.accent,
          backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        })}
      >
        <Icon name="plus" color={theme.color.accent} size={16} />
        <Small color={theme.color.accent}>Add a product</Small>
      </Pressable>

      <View style={{ gap: theme.space.xs }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${products.length} items`}
          placeholderTextColor={theme.color.inkFaint}
          accessibilityLabel="Search items"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            minHeight: 44,
            paddingHorizontal: theme.space.md,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.color.rule,
            backgroundColor: theme.color.paperSunken,
            color: theme.color.ink,
            fontFamily: theme.fontFamily.ui,
            fontSize: theme.fontSize.body,
          }}
        />

        {shown.map((one) => {
          const stock = one.sizes
            ? `${one.sizes.reduce((sum, size) => sum + size.count, 0)} in sizes`
            : one.stockCount === null
              ? ''
              : one.stockCount === 0
                ? 'Sold out'
                : `${one.stockCount} in stock`;
          const sale = clearanceOf({ wasPriceCents: one.wasPriceCents, amountCents: one.amount });
          return (
            <Pressable
              key={one.slug}
              onPress={() => onSelect(one.slug)}
              accessibilityRole="button"
              accessibilityLabel={`${one.name}, ${
                sale ? `was ${money(sale.wasCents)}, now ${money(sale.nowCents)}` : money(one.amount)
              }${stock ? `, ${stock}` : ''}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                paddingVertical: theme.space.xs,
                borderBottomWidth: 1,
                borderBottomColor: theme.color.rule,
                backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
                minHeight: 56,
              })}
            >
              <View style={{ width: 40 }}>
                <Cover slug={one.slug} name={one.name} fallback={one.images[0] ?? null} height={48} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Small numberOfLines={2}>{one.name}</Small>
                <Micro color={theme.color.inkSoft}>
                  {sale ? (
                    <>
                      <Text style={{ textDecorationLine: 'line-through', color: theme.color.inkFaint }}>
                        {money(sale.wasCents)}
                      </Text>{' '}
                      {money(sale.nowCents)}
                    </>
                  ) : (
                    money(one.amount)
                  )}
                  {stock ? (
                    <Text style={one.stockCount === 0 ? { color: theme.color.accent } : undefined}>
                      {` · ${stock}`}
                    </Text>
                  ) : null}
                </Micro>
              </View>
              <Icon name="next" color={theme.color.inkFaint} size={14} />
            </Pressable>
          );
        })}
        {shown.length === 0 ? <Micro color={theme.color.inkFaint}>Nothing matches.</Micro> : null}
      </View>
    </PanelBody>
  );
}
