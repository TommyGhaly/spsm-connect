/**
 * The privacy notice, written from this app's code rather than from a template.
 *
 * ---------------------------------------------------------------------------
 * The website's `/privacy` is the same document for the site, and its header is
 * the one to read first: every claim on that page names the file that makes it
 * true, so that the next person can re-check it instead of trusting a comment.
 * This is that page's counterpart for the phone, and it is a separate document
 * rather than a fetch of that one because the two collect different things. A
 * phone has a camera, a queue that survives being closed, a wallet, a platform
 * attestation and an App Clip; a browser has none of those, and a notice that
 * described the website's behaviour to somebody holding this app would be a
 * false statement the church had published about people who trusted it.
 *
 * ## The claims, and what makes each one true
 *
 * Checked against the code on 16 September 2026. **A change to any of these is
 * a change to this file, in the same commit.**
 *
 *   - "no analytics service, no third-party crash reporter, no advertising
 *     identifier" — `package.json` has no `@react-native-firebase/analytics`,
 *     no `crashlytics`, no `@sentry/*`, no `expo-tracking-transparency` and no
 *     advertising SDK of any kind. The only counting the app does is
 *     `src/bookstore/track.ts` writing to the church's own Firestore, bounded
 *     by `@spsm/shared`'s `bookstoreEvents`.
 *   - "records what went wrong in the church's own database" —
 *     `src/diagnostics/report.ts`, into the `faults` collection, whose rule
 *     refuses every client read. The word *third-party* above is doing real
 *     work now and must not be dropped: there **is** a crash reporter, it is
 *     the church's, and `analytics/faults.ts` in `@spsm/shared` carries the
 *     argument for why it is not Crashlytics. It records no uid and no device
 *     id, which is what keeps the sentence after it true.
 *   - "never asks for your location" — there is no `expo-location`, and
 *     `app.config.ts` sets `isAccessMediaLocationEnabled: false` on
 *     expo-media-library, which is what keeps Android from handing over a
 *     photograph's location with the file.
 *   - "ninety days" — `EVENT_TTL_DAYS` in `@spsm/shared`.
 *   - the on-device list — every store this app writes: `spsm.bookstore.cart`
 *     (`bookstore/cart.ts`), `spsm.bookstore.visitor` (`bookstore/track.ts`),
 *     `spsm.theme.tokens.v*` (`theme/ThemeProvider.tsx`),
 *     `spsm.app.tour.passport.v1` (`about/passport.ts`), the `spsm-uploads.db`
 *     SQLite queue (`upload/queue.ts`), and Firebase Auth's own session.
 *   - "App Attest on iPhone, Play Integrity on Android" —
 *     `src/firebase/appCheck.ts`, and it is load-bearing rather than decorative:
 *     `galleryUploadUrl` and `formUploadUrl` read the App Check header by hand
 *     and answer `401 unattested` without it.
 *   - "made smaller on the phone … which drops everything the file carried
 *     besides the picture" — `upload/condense.ts` re-encodes through
 *     `ImageManipulator`; its header is explicit that this is a courtesy and
 *     that the server strip in `functions/src/galleries.ts` (`sharp` keeps no
 *     metadata unless told to) is the guarantee.
 *   - "a video is published as you sent it" — the same Function's
 *     `onGalleryMediaCreated` passes video over rather than transcoding it, and
 *     the approval path copies `previewPath ?? sourcePath`. So a clip's own
 *     metadata survives both hops. `condense` does not re-encode video either.
 *     This is the one place this notice is less comfortable than the website's,
 *     and it is said out loud for that reason.
 *   - "signs in anonymously … a phone, not a person" — `uploadIdToken` in
 *     `src/firebase/auth.ts` calls `signInAnonymously`, and
 *     `enforceTenantOnCreate` writes those accounts no member document.
 *   - "a scrambled form of the network address … kept for a day" —
 *     `addressKey()` in `functions/src/uploadQuota.ts` is a truncated SHA-256,
 *     the plain address is never written, and `sweepStaleQuotas` deletes the
 *     documents daily.
 *   - "never a card number" — `src/payments/square.ts` hands Square's native
 *     sheet a nonce to mint and posts only that; `functions/src/checkout.ts`
 *     prices the basket itself, and there is nowhere in the request to put a
 *     card or a price.
 *   - "opens Tithe.ly's own form in the system browser" — `src/giving/open.ts`
 *     uses `WebBrowser.openBrowserAsync`, deliberately not a `WebView`, and its
 *     header carries the three reasons.
 *   - "delete their own account from the menu" — `src/session/account.ts` posts
 *     to `/api/account/delete`, which removes the auth user and
 *     `members/{uid}` and deliberately keeps the `updatedBy` audit fields.
 *   - "the app sends no push notifications" — nothing in `src/` or `app/` calls
 *     `@react-native-firebase/messaging`, requests notification permission, or
 *     reads a token. The library is compiled in (`app.config.ts` lists the
 *     plugin), which is why the sentence about a device token is hedged the way
 *     it is rather than promising none exists.
 *   - "the register records a tick, a time and who ticked it" —
 *     `src/camp/admin/Register.tsx` writes exactly that through
 *     `markAttendance`, and the app still has no child registration form of its
 *     own: a registration is made on the website, by a parent.
 *
 * ## What this notice deliberately does not do
 *
 * The same two abstentions the website's page makes, for the same reasons. It
 * claims no GDPR or CCPA rights — this is a Massachusetts church, not a
 * business, and reciting a European legal basis table would be borrowed
 * authority that buried the two things a parishioner actually wants to know:
 * who can read what they typed, and who to write to. And it promises no consent
 * gate, because the app has nothing to gate: the permissions it asks for are
 * the platform's own prompts, asked at the moment the thing they are for is
 * used.
 *
 * ## Why it is code, and carries no slot id
 *
 * Every other long screen in this app reads `aboutOverrides` so that a
 * correction made on the website is live here without a release — see
 * `src/about/overrides.tsx`. **Nothing here does, and that is the point.** The
 * accuracy of these sentences depends on the code they sit beside, so the
 * person changing the behaviour must be the person changing the sentence. A
 * privacy notice a volunteer can rewrite from the Firebase console is one that
 * can be made untrue by somebody who has not read `upload/condense.ts`.
 * ---------------------------------------------------------------------------
 */

/** The date the words below last changed. Updated by hand, and only then. */
export const UPDATED = '16 September 2026';

/** A labelled point — the website's `<li><strong>`. */
export type Point = { term: string; detail: string };

export type PrivacySection = {
  eyebrow: string;
  title: string;
  body: readonly string[];
  /** A labelled list, rendered after the body. */
  points?: readonly Point[];
};

export const OPENING = {
  eyebrow: 'St. Philopater Mercurius & St. Mina',
  title: 'Privacy',
  note: `How this app handles what you tell it. Last changed ${UPDATED}.`,
  body: [
    'This app is run by St. Philopater Mercurius & St. Mina Coptic Orthodox Church in Wayland, Massachusetts. It collects nothing about you until you hand it something, and what it collects then is read by the church office and by the servants who look after that part of the church — nobody else.',
    'There is no advertising in it, nothing in it is sold, rented or shared for anybody’s marketing, and there is no tracking of you between apps. This notice says plainly what each part of the app asks for, where it goes, and how to ask the office about it.',
  ],
} as const;

export const SECTIONS: readonly PrivacySection[] = [
  {
    eyebrow: 'Simply using it',
    title: 'What the app collects on its own',
    body: [
      'Opening the app and reading it does not identify you. There is no advertising library in it, no analytics service — not Google Analytics, not Firebase Analytics, not any other — and no crash reporter belonging to anybody but the church. It holds no advertising identifier, which is why it never shows you the tracking permission: there would be nothing to ask for.',
      'When the app itself breaks, it writes down what broke — the error, and which screen you were on — and sends that to the church’s own database so the fault can be fixed. It is deliberately not sent to Google, to Apple, or to any crash-reporting company. It carries no name, no account and nothing that identifies your phone, it is readable only by the people who run the church’s systems, and it is deleted after thirty days.',
      'It never asks for your location, either. There is no location permission in the app at all — and on Android it also declines the separate permission that would let it read the place a photograph was taken, so the system removes that from the file before the app ever sees it.',
      'Two things happen without you doing anything:',
    ],
    points: [
      {
        term: 'Server logs',
        detail:
          '**The church’s server is Google Firebase**, which keeps its own records of the requests the app makes — the path, the time, and the network address it came from. Those are Google’s operational and security logs, held under Google’s terms; the church does not read them request by request and does not use them to build a picture of anybody.',
      },
      {
        term: 'Bookstore counts',
        detail:
          '**The shop counts which books are looked at** and what is typed into its search box, so the people who order stock know what the church is actually asking for. It counts against a random sixteen-character identifier this installation generates for itself — not a name, not an email address, derived from nothing about you, and readable by no one but the church. The individual records are deleted after ninety days; only the totals are kept, and the identifier is gone when the app is deleted.',
      },
    ],
  },
  {
    eyebrow: 'On your own phone',
    title: 'What stays on the device',
    body: [
      'Some things are kept on the phone and never sent anywhere. The basket while you are filling it, that random bookstore identifier, a cached copy of the church’s colours so the app does not flash on opening, which stations of the festival tour you have collected, and — if you are a servant who has signed in — the session that keeps you signed in.',
      'The largest of them is the **queue of photographs waiting to be sent**. It is a small database on the phone holding each picture, its size, and which gallery it is going to, so that a batch of sixty photographs survives the app being closed and the phone going in a pocket. A row leaves the queue when it has been sent, or when you delete it from the queue screen.',
      'Which stations of the tour you have collected is on the honour system precisely because it is on the phone: the church holds no record of who walked which station, and the reward would not be worth asking a stranger at a festival to sign in for. Deleting the app removes every one of these.',
    ],
  },
  {
    eyebrow: 'Before the church will take a photograph',
    title: 'Proving the app is genuine',
    body: [
      'The church’s server will not accept a photograph or a form attachment from an app that cannot prove it is a real copy running on a real device. On an iPhone or iPad that proof is **Apple’s App Attest**; on Android it is **Google’s Play Integrity**. The question is answered by Apple or by Google, and the app passes their answer on.',
      'That check carries no name, no account, and nothing about what is being sent. It exists so that a script cannot empty the parish’s budget overnight, and it is the reason the app sometimes says it could not prove it is genuine and refuses to send — that refusal is this, working.',
    ],
  },
  {
    eyebrow: 'The reason this app exists',
    title: 'Photographs and video',
    body: [
      'The app asks for the camera the first time you take a photograph for a gallery, and for the photo library the first time you choose one. It receives only the items you pick in the system’s own picker; it does not read your library, and it never saves anything back to it.',
      'A photograph is **made smaller on the phone before anything is sent**, and that re-encoding drops everything the file carried besides the picture itself — the camera and phone details, and any place it was tagged with. So a location generally never leaves the phone at all. The church’s server strips the metadata again on its own side when it builds the copy that gets published, and that second strip is the guarantee; the one on the phone is a courtesy that happens earlier.',
      '**A video is different, and it is worth saying plainly.** Nothing re-encodes it — a phone cannot, and the church’s server does not either — so a clip is published as you sent it, carrying whatever the file carried. If that matters for a particular recording, send a photograph instead, or ask the office before sending it.',
      'You do not need an account to send anything. The app signs itself in anonymously so that a batch can be counted against *something* — that session is a phone, not a person, and it holds no name and no email address. Alongside it the church stores a scrambled form of the network address the batch came from, scrambled one way so that it counts uploads without recording where anybody was. Both are kept for a day.',
      'Sending continues after you put the phone down: the transfer is handed to the operating system, which carries it whether or not the app is running, and the app is woken occasionally to start the next item in a queue it did not finish.',
      'What you send stays private until an administrator has looked at it and approved it. **Once approved it is published on a public page** — on the church’s website, visible to anyone, with no sign-in needed to see it. If a photograph of you or of your child is there and you would rather it were not, write to the office and it will be taken down. You do not need to explain why.',
    ],
  },
  {
    eyebrow: 'When you write to us',
    title: 'Forms',
    body: [
      '**The contact form** asks for your name, an email address, a subject, your message, and a phone number if you would rather be called. It is stored so the office can answer it, and it is answered by the office.',
      '**Other forms** are written by the church’s staff, so each one asks for whatever that form is for, and some let you attach a photograph. Whatever you type is stored as you typed it, together with the date and — if you happened to be signed in — the account you were signed in as. An attachment goes into a part of the church’s storage that no member of the public can read, deliberately: a world-readable place would make every photograph anybody attached findable by anyone who guessed a path. Staff who have been given the forms area can read submissions and note how one was handled.',
      '**Vehicle registration** is different in one way worth naming: the plate, make, model and colour, and each driver’s name and phone number, are sent on to Taksis — the church’s own parking app, running on a separate church system — because that is where the people who need to identify a car in the lot look it up. It is not sent anywhere outside the church.',
      '**The summer camp’s sign-up** for servants asks for your name, phone number, email address, date of birth, shirt size, somebody to ring in an emergency and how they are related to you, and which times you can serve. It is read by the people who run the camp and by nobody else. You cannot read it back afterwards — the confirmation on screen is the whole of what you get — because the database refuses that collection to everybody without a grant on the camp.',
      'A form that charges a fee hands the payment to Square, below.',
    ],
  },
  {
    eyebrow: 'Children',
    title: 'What the app does not ask a child',
    body: [
      'Nothing in this app asks a child to fill anything in. A child’s camp registration is made on the church’s website, by a parent or guardian, and the website’s own privacy page describes what it asks for and who reads it. A parent can correct or withdraw it by writing to the office.',
      'What the app does hold about a child is the camp’s **register**, and only for the servants running the camp. Marking a child present records a tick, the time it was tapped, and the account of the servant who tapped it — nothing else, and never a note about the child. In the afternoon the same screen shows the name and telephone number of the adult down to collect each child, so that the servant at the door can ring them; that comes from the registration the parent made and is not entered here. Nobody without a grant on the camp can read any of it.',
      'Permission to photograph a child for the church’s galleries is asked separately, for each child, and recorded with that child’s registration. It is not assumed from anything else. If you believe a child has sent us something through this app, write and it will be deleted.',
    ],
  },
  {
    eyebrow: 'The bookstore and the offering',
    title: 'Buying and giving',
    body: [
      '**The bookstore.** Checkout asks for a first and last name, an email address, and a postal address if you want the order posted rather than put aside for collection after the Liturgy. The card is typed into **Square’s own card sheet** — that screen belongs to Square, not to this app — or paid with Apple Pay or Google Pay where the church has the wallet set up. What the app sends the church is a single-use token; a card number never reaches the church’s systems and there is nowhere in them to keep one. There is also deliberately no price in that request: the church’s server prices the basket from its own catalogue. Your email address is where the receipt goes. Square keeps its own record of the payment under its own privacy policy, and a refund is made through Square by a member of staff.',
      '**Giving.** The Give button opens Tithe.ly’s own form in the system browser, sliding up over the app with the address bar showing, rather than in a rectangle this app drew — so you can see whose page you are typing a card into, and so Apple Pay and Google Pay keep working. What you enter there goes to Tithe.ly, under their privacy policy, and the church receives your contribution record from Tithe.ly. This app never sees your card, your bank details, or the amount.',
    ],
  },
  {
    eyebrow: 'Reading, watching, finding the place',
    title: 'The calendar, the stream and the map',
    body: [
      'The calendar, the week’s bulletin and the notices behind the bell are read from the church’s own systems, and nothing about you goes with the request. The servants’ rota is the one read that requires a sign-in, because it is the one that is not public.',
      'The livestream plays **YouTube** inside the app. Playing a video lets YouTube count the view and set its own cookies, as it would in a browser, and a service that has been recorded stays on the church’s YouTube channel afterwards. Recent services are handed to the YouTube app where you have it.',
      'The map on the contact screen is **Google Maps**, loaded in a web view. Loading it tells Google that a map was loaded, which is the same thing that happens on the website.',
      'The About screens read their words from the same place the website’s editors write them, so a correction made there appears here; the photographs on those screens are fetched from the church’s site as you scroll.',
    ],
  },
  {
    eyebrow: 'Servants and staff',
    title: 'Accounts',
    body: [
      'Accounts exist only for the servants and staff who administer something. Nothing else in the app needs one: sending a photograph, filling in a form, buying a book and giving all work signed out, and the sign-in screen says so.',
      'Signing in uses the church’s **Microsoft account**, and only the church’s — a personal Microsoft account is refused. The password is typed to Microsoft, never to this app, and this app never receives it. What is stored is the account’s identifier, the name and email address Microsoft provides, and which areas of the church’s software that person has been given.',
      'A servant can delete their own account from the menu in this app. That removes the sign-in and the record of what they were allowed to administer. Two honest limits on it: it does not touch their church Microsoft account, which belongs to the church’s Microsoft tenant and is a different job done by a different person; and it does not erase who edited what. The note that a page was changed, or a photograph approved, by a particular person stays, because that is the church’s record of what it published rather than a description of anybody.',
    ],
  },
  {
    eyebrow: 'Tags, cards and notifications',
    title: 'Two things that are not what they look like',
    body: [
      '**A tag by a door, or a code on a printed card**, can open a small piece of this app on an iPhone without installing anything. That piece is camera-only by design, may run nothing in the background, and iOS clears whatever it stored without warning. Nothing on the tag or the card identifies you — it holds a link and nothing else — and tapping one tells the church only what any visit to the church’s own address would.',
      '**The app sends no push notifications.** The bell in the header is this week’s notices from the bulletin, read when you open it; nothing is pushed to the phone, and the app never asks for permission to notify you. The machinery for push is compiled into the app, so Apple’s and Google’s push services may hold a device token for it, but nothing in the app registers to be notified and the church sends nothing. If that ever changes, it changes here first.',
    ],
  },
  {
    eyebrow: 'Named, not summarised',
    title: 'Services this app relies on',
    body: [
      'Each of these does one job, and each holds what it needs for that job under its own privacy policy:',
    ],
    points: [
      {
        term: 'Google Firebase',
        detail:
          'The database, file storage, sign-in, and the church’s server. Everything the app stores off your phone is stored here.',
      },
      {
        term: 'Apple App Attest, Google Play Integrity',
        detail: 'The check that this is a genuine copy of the app on a real device.',
      },
      {
        term: 'Square',
        detail:
          'Bookstore payments, Apple Pay and Google Pay, and any form that charges a fee.',
      },
      { term: 'Tithe.ly', detail: 'The offering, on the giving screen.' },
      { term: 'Microsoft', detail: 'Sign-in for servants and staff.' },
      { term: 'YouTube', detail: 'The livestream and the recent services.' },
      { term: 'Google Maps', detail: 'The map on the contact screen.' },
      {
        term: 'Breeze',
        detail:
          'The church’s own records system, which the calendar reads from. The reading happens on the church’s side; nothing about you is sent to it by your using the app.',
      },
      {
        term: 'Taksis',
        detail: 'The church’s parking app, which receives vehicle registrations.',
      },
      {
        term: 'The App Store and Google Play',
        detail:
          'Where the app was installed from. Apple and Google keep their own record of that and show the church counts — how many installed it, how often it crashed — which name nobody. On an iPhone the church sees a crash report only from people who have turned on sharing with developers in iOS Settings.',
      },
    ],
  },
  {
    eyebrow: 'How it is held',
    title: 'Keeping it, and keeping it safe',
    body: [
      'Everything the app sends goes over an encrypted connection, and the endpoints that take photographs and attachments refuse a request that cannot prove the app is genuine.',
      'Access is granted one area at a time rather than by a single shared password: somebody given the forms area cannot read the camp’s sign-ups, and somebody given the camp cannot read the church’s finances. That is enforced by the database rather than by this app — a screen this app showed by mistake is still refused — which is the right order of trust. Card numbers are not in the church’s systems at all.',
      'How long something is kept depends on what it is. Bookstore counts are deleted after ninety days, and the records that count uploads after a day. A queued photograph sits on your phone until it is sent or you delete it. A form submission is kept while the office is dealing with it and for as long as the record is needed afterwards. Orders are kept as the church’s own records. Nothing is kept because it might be useful to somebody one day.',
    ],
  },
  {
    eyebrow: 'Write to the office',
    title: 'Asking what we hold',
    body: [
      'You may ask what the church holds about you, ask for it to be corrected, or ask for it to be deleted, and the church will do it. Write to the office — [the address, the phone number and a form are on the contact screen](/contact).',
      'Two honest limits. Some records the church keeps as its own history — who published a page, who approved a photograph, what an order was for — and those are kept even when an account is deleted. And Square and Tithe.ly hold their own copies of a payment; a request about a payment record has to go to them, and the office will tell you how.',
      'This notice ships inside the app, so it changes when the app does and the date under the title above is the date it last changed. It cannot be edited from a console, deliberately: these sentences live beside the code they describe, so changing what the app does and changing this page is one job rather than two. The church will not quietly weaken it.',
    ],
  },
];
