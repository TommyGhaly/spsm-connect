/**
 * Putting a new book in the shop.
 *
 * A sheet rather than a tile at the end of the shelf, which is where the
 * website puts it. On a 390pt screen the shelf is two columns and the tile
 * would be a card-sized target for a form that needs four fields and a
 * photograph — so the shelf gets one control in its header instead and the form
 * gets the room it needs.
 *
 * ## Square first, then here, and the order is forced
 *
 * The checkout prices orders from Square's own catalog, so a row that existed
 * only in Firestore would have no variation id: a book on the shop that nobody
 * can buy. `squareCreateProduct` enforces that order; this carries the form to
 * it and then attaches the photographs, which cannot happen earlier because an
 * image is attached to a catalog object and there is none until Square has
 * minted the item.
 *
 * A picture that fails therefore fails *after* the book exists. Saying so and
 * leaving the book is the honest outcome — the alternative is deleting a product
 * the parish just created because one photograph did not upload, and the
 * pictures can be added again from the book's own sheet in a second.
 */
import { useState } from 'react';
import { View } from 'react-native';
import type { BookstoreSection } from '@spsm/shared';

import { Close, Field, Problem, Sheet } from '@/components/Fields';
import { Button } from '@/components/Surface';
import { Body, Heading, Label, Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { PictureRow, PictureSource, PictureTile } from './Pictures';
import { CategoryChecklist, ShippingFields, TaxableField } from './ProductFields';
import { parsePrice } from './ProductSettings';
import type { PickedPicture } from './picture';

/**
 * Mounted only while it is open — `ShopScreen` renders it conditionally — which
 * is what makes it empty every time. A sheet held open with `null` would come
 * back carrying the title, price and photographs of the book somebody backed
 * out of adding, and the most likely thing to do with that form is press Add.
 */
export function AddProduct({
  sections,
  onClose,
}: {
  sections: BookstoreSection[];
  /**
   * Closed, one way or another.
   *
   * There is no `onAdded` beside it: the shelf is a live subscription, so the
   * new book arrives on its own the moment the Function mirrors it back. A
   * refresh callback would be a slower second copy of that.
   */
  onClose: () => void;
}) {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<readonly string[]>([]);
  const [shipping, setShipping] = useState<{ weightOz: number | null; mediaMail: boolean }>({
    weightOz: null,
    // Most of what the shop sells is books, so the box starts ticked — the
    // website's default, and the one fewer tap for the usual case.
    mediaMail: true,
  });
  // Off, like every product: nothing is taxed until somebody says so.
  const [taxable, setTaxable] = useState(false);
  const [pictures, setPictures] = useState<PickedPicture[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const cents = parsePrice(price);
  const priceBroken = price.trim() !== '' && cents === null;
  const ready = name.trim() !== '' && cents !== null && !busy;

  const submit = async () => {
    if (!ready || cents === null) return;
    setBusy(true);
    setFailed(null);

    const title = name.trim().replace(/\s+/g, ' ');

    try {
      const { createProduct, uploadProductImage } = await import('./adminData');
      const slug = await createProduct({
        name: title,
        description: description.trim(),
        priceCents: cents,
        /* All four on the create, not afterwards: `squareCreateProduct` files
           the item in Square and writes the parish's fields into the mirror
           in the one request, so a new book never spends a moment unfiled,
           unweighed or untaxed by mistake. */
        categoryIds: [...categoryIds],
        weightOz: shipping.weightOz,
        mediaMail: shipping.mediaMail,
        taxable,
      });

      for (const picture of pictures) {
        try {
          await uploadProductImage(slug, picture.dataUrl);
        } catch (cause) {
          setFailed(
            `“${title}” was added, but a picture did not upload` +
              `${cause instanceof Error ? `: ${cause.message}` : '.'} ` +
              'Add it from the book’s own settings.',
          );
          setBusy(false);
          // The book exists, so the form has nothing left to send — but the
          // sheet stays open carrying the sentence above, which is the only
          // place it can be read.
          return;
        }
      }

      setBusy(false);
      onClose();
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'The book could not be added.');
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      label="Add a book to the shop"
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Label>Bookstore</Label>
            <Heading>Add a book</Heading>
          </View>
          <Close onPress={onClose} what="the add form" />
        </View>
      }
    >

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      <Field
        label="Title"
        value={name}
        onChange={setName}
        required
        placeholder="Be Prepared"
        readOnly={busy}
      />

      <Field
        label="Price"
        value={price}
        onChange={setPrice}
        required
        keyboard="numbers-and-punctuation"
        placeholder="15.00"
        invalid={priceBroken}
        error={priceBroken ? 'A price like 8 or 8.50, up to $1,000.00.' : null}
        hint="In dollars. Square charges this at the till too."
        readOnly={busy}
      />

      <Field
        label="Description"
        value={description}
        onChange={setDescription}
        lines={3}
        placeholder="A line about it (optional)"
        readOnly={busy}
      />

      {sections.length > 0 ? (
        <View style={{ gap: theme.space.xs }}>
          <Label>Categories</Label>
          <CategoryChecklist
            sections={sections}
            chosen={categoryIds}
            busy={busy}
            onChange={setCategoryIds}
          />
        </View>
      ) : null}

      <View style={{ gap: theme.space.xs }}>
        <Label>Shipping</Label>
        <ShippingFields
          weightOz={shipping.weightOz}
          mediaMail={shipping.mediaMail}
          busy={busy}
          onChange={setShipping}
        />
      </View>

      <View style={{ gap: theme.space.xs }}>
        <Label>Sales tax</Label>
        <TaxableField taxable={taxable} busy={busy} onChange={setTaxable} />
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Label>Pictures</Label>

        {pictures.length > 0 ? (
          <PictureRow>
            {pictures.map((picture, index) => (
              <PictureTile
                key={picture.id}
                uri={picture.dataUrl}
                cover={index === 0}
                busy={busy}
                action="drop"
                what={name.trim() || 'this book'}
                onPress={() =>
                  setPictures((was) => was.filter((one) => one.id !== picture.id))
                }
              />
            ))}
          </PictureRow>
        ) : null}

        <PictureSource
          busy={busy}
          onPicked={(chosen) => {
            setFailed(null);
            setPictures((was) => [...was, ...chosen]);
          }}
          onError={setFailed}
        />

        <Micro color={theme.color.inkFaint}>
          The first one becomes the cover on the shelf. The book is created first, then its
          pictures — so a photograph that fails does not lose the book.
        </Micro>
      </View>

      <Button
        label={busy ? 'Adding…' : 'Add to the shop'}
        onPress={() => void submit()}
        disabled={!ready}
        busy={busy}
      />
    </Sheet>
  );
}
