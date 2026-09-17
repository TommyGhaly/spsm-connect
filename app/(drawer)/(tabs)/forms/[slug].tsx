/**
 * One form, by its address.
 *
 * `/forms/<slug>` is the website's URL for the same thing, which is not a
 * convenience: a universal link or a QR code printed on a card has to land
 * here, and the slug in it was chosen by whoever built the form rather than by
 * this codebase.
 *
 * `?about=` is passed straight through: it is the website's own parameter for
 * opening the contact form on a subject, and the calendar's sign-in help uses
 * it to send somebody to ask for a church account.
 *
 * The title is set from the definition once it has been read. A `Stack.Screen`
 * rather than `navigation.setOptions`, so the header is declared where it is
 * decided — and "Form" stands in for the second it takes.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/forms/FormScreen';

export default function Screen() {
  const { slug, about } = useLocalSearchParams<{ slug: string; about?: string }>();
  const [title, setTitle] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen options={{ title: title ?? 'Form' }} />
      <FormScreen
        slug={String(slug ?? '')}
        {...(about ? { about: String(about) } : {})}
        onTitle={setTitle}
      />
    </>
  );
}
