/**
 * The list of forms, live from Firestore.
 *
 * ---------------------------------------------------------------------------
 * A floor under a live list, not a hardcoded list with a live one bolted on.
 *
 * `builtInCards()` — the contact form and the vehicle registration — is merged
 * into *every* render: before the read, after a failed read, and after a
 * successful read that did not include them. The tag in the car park is
 * equally unhelped by an empty list that arrived quickly and by one that never
 * arrived, and a stored document always wins over its built-in copy, because
 * staff edit these two like any other form.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import {
  NO_PAYMENT,
  builtInForms,
  toFormSlug,
  type FormDefinition,
  type FormDraft,
} from '@spsm/shared';

import { Problem } from '@/components/Fields';
import { Icon, isIconName } from '@/components/Icon';
import { Screen } from '@/components/Surface';
import { Body, Heading, Small } from '@/components/Type';
import { useCampSignUpOpen } from '@/camp/useCampConfig';
import { AdminFab } from '@/components/AdminFab';
import { mayAdminScreen } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { siteUrl } from '@/about/media';
import { useTheme } from '@/theme/ThemeProvider';

import { ManagedForms } from './admin/ManagedForms';
import { formImageUrl, watchPublishedForms } from './data';
import { writeForm } from './adminData';

export interface HubCard {
  slug: string;
  title: string;
  blurb: string;
  icon: string;
  /** A photograph the church chose, already absolute. Null for the tinted tile. */
  image: string | null;
  /** Where pressing it goes: a route in this app, or somebody else's website. */
  href: { kind: 'route'; path: string } | { kind: 'external'; url: string };
}

/**
 * Summer camp, as a card rather than a form definition.
 *
 * It is not in the `forms` collection and cannot be: a camp registration
 * repeats a child, carries a payment ledger written to over weeks, and has
 * roles appended long after it was taken, none of which a `FormField` list can
 * express. It has a screen of its own — `forms/summer-camp` — and the card is
 * assembled beside it, which is where a consequence of a route existing belongs.
 */
const CAMP_CARD: HubCard = {
  slug: 'summer-camp',
  title: 'Serve at summer camp',
  blurb:
    'Sign up to serve — the days you can come, which half of the camp, and what ' +
    'you would like to do. No account needed. Children are registered by the camp.',
  icon: 'people',
  image: siteUrl('/img/stock-camp-500.webp'),
  href: { kind: 'route', path: '/forms/summer-camp' },
};

/**
 * Whether the camp is advertised here at all — the blunt switch, matching
 * `SHOW_CAMP` in the website's hub. The finer control is the camp's own
 * settings, read by `useCampSignUpOpen`, which closes the form and says so.
 */
const SHOW_CAMP = true;

function builtInCards(): HubCard[] {
  return builtInForms().map(({ draft }) => toCard(draft as FormDefinition));
}

/**
 * The live list, with the two permanent forms guaranteed present.
 *
 * Keyed on slug rather than id, because a card is addressed by its slug and a
 * built-in's slug cannot be edited — the builder makes that field read-only for
 * exactly this reason.
 */
function withBuiltIns(cards: readonly HubCard[]): HubCard[] {
  const known = new Set(cards.map((card) => card.slug));
  const missing = builtInCards().filter((card) => !known.has(card.slug));
  // The built-ins first: `order` puts contact at 1 and the vehicle form at 10,
  // ahead of the 100 every other form is created with, and the live list
  // arrives already sorted by that same field.
  return [...missing, ...cards];
}

export function FormsHub() {
  const theme = useTheme();
  const router = useRouter();
  const grants = useGrants();
  const [cards, setCards] = useState<readonly HubCard[]>(builtInCards);

  useEffect(() => {
    return watchPublishedForms(
      (forms) => setCards(withBuiltIns(forms.map(toCard))),
      (error) => {
        // Keep whatever is on screen. An empty hub is the failure this guards
        // against, and it is the one the website's old hardcoded list existed
        // to avoid — so a failed read must not be allowed to produce it.
        console.error('[forms] could not read the forms list; showing the built-in list', error);
      },
    );
  }, []);

  /*
   * The camp card is appended rather than folded into `cards`, so a failed read
   * cannot take it away: `cards` falls back to the built-ins when the
   * subscription errors, and somebody signing up to serve should still find the
   * form on a phone that could not reach the database.
   */
  const campOpen = useCampSignUpOpen();
  const visible = SHOW_CAMP && campOpen ? [...cards, CAMP_CARD] : cards;

  /*
   * Not a security boundary — `firestore.rules` is, and it reads the grant
   * rather than this. What it decides is whether a row that leads to real
   * people's names and phone numbers is drawn at all.
   */
  const mayAdmin = mayAdminScreen(grants, 'forms');

  /*
   * Managing the list, in place, the way the bookstore tab is edited in place.
   *
   * Held here rather than inside `ManagedForms` because it decides something
   * *this* component draws: whether the parishioner's cards are on screen. The
   * two lists are never both shown — they are the same seven forms answered by
   * two different reads (see `ManagedForms`), and stacked they would read as
   * fourteen.
   *
   * `mayAdmin &&` guards the render rather than the state, so a grant read that
   * lands late or is revoked while somebody has the tab open takes the mode away
   * with the controls.
   */
  const [managing, setManaging] = useState(false);
  const inManageMode = mayAdmin && managing;

  /** A refused creation, from the pill. Cleared by the next attempt. */
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Make an empty form and open the builder on it.
   *
   * Up here rather than in `ManagedForms`, which is where it used to live,
   * because the control that calls it is up here now: the pill is an overlay
   * and has to be a sibling of `Screen` rather than something inside its
   * scroller. Nothing is lost by the move — this navigates away the moment it
   * succeeds, and the managed list refreshes itself on focus when somebody
   * comes back.
   */
  async function create() {
    const id = `form-${Date.now().toString(36)}`;
    setProblem(null);
    try {
      await writeForm(id, blankForm(id));
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : 'That form could not be created.');
      return;
    }
    router.push(`/forms/admin/${id}` as never);
  }

  return (
    <>
      <Screen>
      {mayAdmin ? <ManagedForms managing={managing} onManaging={setManaging} /> : null}

      {inManageMode ? null : (
        <>
          <Body color={theme.color.inkSoft}>
            The forms the church keeps online. Nothing here needs an account.
          </Body>

          {visible.map((card) => (
            <FormCard
              key={card.slug}
              card={card}
              onPress={() => {
                if (card.href.kind === 'external') {
                  void WebBrowser.openBrowserAsync(card.href.url);
                  return;
                }
                router.push(card.href.path as never);
              }}
            />
          ))}

          <Small color={theme.color.inkFaint}>
            Looking for something that is not here? Ask the church office — they can send you
            the right form.
          </Small>
        </>
      )}
      </Screen>

      {/*
        The office's controls, in the corner rather than across the top.

        This tab is two audiences on one screen and the row of buttons was the
        thing standing between them — it opened the hub, for everybody, on four
        controls most people may not press. See `components/AdminFab`; the shop,
        the ministry directory and every gallery page moved to the same corner
        at the same time.

        Outside `Screen`, because it is an overlay and must not scroll away.
      */}
      {mayAdmin ? (
        <AdminFab
          label={inManageMode ? 'Editing' : 'Manage'}
          actions={
            inManageMode
              ? [
                  { label: 'New form', onPress: () => void create() },
                  { label: 'Import a form', onPress: () => router.push('/forms/admin/import' as never) },
                  { label: 'Submissions', onPress: () => router.push('/forms/admin/submissions' as never) },
                  { label: 'Stop editing', onPress: () => setManaging(false) },
                ]
              : [
                  /*
                   * Submissions is here in both modes, and first out of edit
                   * mode, for the reason the shop puts Orders there: it is what
                   * somebody opens this tab for on a Monday morning, and it has
                   * nothing to do with managing the list.
                   */
                  { label: 'Submissions', onPress: () => router.push('/forms/admin/submissions' as never) },
                  { label: 'Manage the forms', onPress: () => setManaging(true) },
                ]
          }
        />
      ) : null}

      {/* A creation that was refused. The managed list has its own slot for its
          own writes; this one belongs to the pill, which has nowhere to put a
          sentence. */}
      {problem ? (
        <View
          style={{
            position: 'absolute',
            left: theme.space.gutter,
            right: theme.space.gutter,
            bottom: theme.space.lg,
          }}
        >
          <Problem>{problem}</Problem>
        </View>
      ) : null}
    </>
  );
}

/** A new form, in the shape the builder expects. Matches the website's `blankForm`. */
function blankForm(id: string): FormDraft {
  return {
    slug: toFormSlug(id),
    title: 'New form',
    blurb: '',
    icon: 'file',
    image: null,
    order: 100,
    published: false,
    open: true,
    closedMessage: null,
    kind: 'native',
    externalUrl: null,
    pushesToTaksis: false,
    fields: [],
    payment: { ...NO_PAYMENT },
    notifyEmails: [],
    confirmationMessage: 'Thank you — the church office has your submission.',
    confirmationEmailBody: '',
  };
}

/**
 * A published form, as a card.
 *
 * An `external` form keeps its own URL so the card opens Breeze directly rather
 * than going through a screen whose only content is another link. One press,
 * not two.
 *
 * The website has a `FORMS_WITH_A_HOME` map that points the contact card at
 * `/contact#write-heading`, because on the site that form is rendered under the
 * church's address and service times. There is no such screen here yet — the
 * drawer's Contact row is still unbuilt — so the card goes to the form itself,
 * which is the same form without the surroundings. Add the map when that screen
 * exists; do not add it before.
 */
export function toCard(form: FormDefinition): HubCard {
  const external = form.kind === 'external' && form.externalUrl !== null;
  return {
    slug: form.slug,
    title: form.title,
    blurb: form.blurb,
    icon: form.icon,
    image: formImageUrl(form.image),
    href: external
      ? { kind: 'external', url: form.externalUrl as string }
      : { kind: 'route', path: `/forms/${form.slug}` },
  };
}

/**
 * The photograph at the top of a card, or the absence of one.
 *
 * Its own component, and exported, because the manage mode draws the same plate
 * over its own controls — see `ManagedForms`. A volunteer deciding whether a
 * card is published should be looking at the card a parishioner sees, which
 * only works if it is literally the same one rather than a second rendering
 * that can drift.
 */
export function CardMedia({ card }: { card: HubCard }) {
  const theme = useTheme();

  if (card.image) {
    return (
      <Image
        source={{ uri: card.image }}
        style={{ width: '100%', height: 110, backgroundColor: theme.color.paper }}
        contentFit="cover"
        transition={150}
        accessibilityElementsHidden
      />
    );
  }

  /*
   * A plain tinted panel with the form's icon, not a gradient with the seal
   * watermarked into it. That was rejected on the website for reading as muddy
   * decoration; this is meant to look like an absence rather than a decision.
   */
  return (
    <View
      style={{
        width: '100%',
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.accentSoft,
      }}
    >
      <Icon
        name={isIconName(card.icon) ? card.icon : 'file'}
        size={28}
        color={theme.color.accent}
      />
    </View>
  );
}

function FormCard({ card, onPress }: { card: HubCard; onPress: () => void }) {
  const theme = useTheme();
  const external = card.href.kind === 'external';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        // Said in words, not only by an icon: somebody using a screen reader
        // needs to know a link leaves the app before they follow it.
        external ? `${card.title}. Opens in a browser.` : card.title
      }
      accessibilityHint={card.blurb}
      style={({ pressed }) => ({
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: pressed ? theme.color.accent : theme.color.rule,
        backgroundColor: theme.color.paperRaised,
        overflow: 'hidden',
      })}
    >
      <CardMedia card={card} />

      <View style={{ padding: theme.space.md, gap: theme.space.xs }}>
        <Heading>{card.title}</Heading>
        {card.blurb ? <Body color={theme.color.inkSoft}>{card.blurb}</Body> : null}

        {/*
          A worded affordance rather than a bare arrow in the corner: the arrow
          alone has to be recognised as "this is a link" and as "press here",
          and at 16pt in a quiet grey it manages neither.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Small color={theme.color.accent}>
            {external ? 'Open in a browser' : 'Open the form'}
          </Small>
          <Icon name="arrow" size={14} color={theme.color.accent} />
        </View>
      </View>
    </Pressable>
  );
}
