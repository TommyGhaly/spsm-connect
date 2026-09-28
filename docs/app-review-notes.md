# App Review: answering Guideline 2.1 — Information Needed

The reply to the rejection of the first submission of **SPSM Connect**
(`org.spsm.connect`, version 1.0.0), and the standing text for the **App Review
Information → Notes** field so that no future submission has to be written from
scratch.

Three parts, and they are for different readers:

- **Part A** is Apple-facing, and answers Apple's six numbered items in their
  order. Paste it into the Resolution Center reply.
- **Part B** is Apple-facing and condensed, for the Notes field, which is capped
  at 4,000 characters. It is not a summary of Part A written casually — it is
  the subset that has to survive into every later submission.
- **Part C** is ours. It is what has to be true *before* Part A is sent, the
  shot list for the recording Apple asked for, and an honest note on the one
  answer that is an argument rather than a feature.

**Nothing here should be sent until Part C's checklist is complete.** Apple's
letter opens by saying the build should be complete and tested on physical
devices before review; a reply that arrives ahead of the demo accounts it
promises is a second rejection.

---

# Part A — the Resolution Center reply

> Paste from here to the end of Part A.

Thank you for the review. Answers to each of the six items follow, and the same
information has been added to the App Review Information Notes field.

## 1. Screen recording

A screen recording captured on a physical iPhone running the current version of
iOS is attached. It begins with a cold launch of the app from the Home Screen
and follows a typical user's path through the app.

**On account registration:** the app does not offer account registration, and
cannot. There is no sign-up, no email/password, no social sign-in. The only
identity provider is the church's own single-tenant Microsoft Entra ID
directory, and an account in it is created by the parish administrator for a
volunteer who serves in a specific ministry. A member of the public cannot
create one, and does not need one — every feature intended for a parishioner or
a visitor works fully signed out.

**On account deletion:** although the app supports no account creation, account
deletion is nonetheless implemented for the volunteers who do hold accounts, and
is shown in the recording. It is reached from the navigation drawer's account
card → **Delete account**. It removes the Firebase Authentication user and the
member record that lists which areas the person administers. The confirmation
text states plainly what is *not* deleted — the person's separate church
Microsoft account, which this app does not own and cannot remove.

**On user-generated content:** the recording shows the photograph submission
flow, which is the app's only user-generated content, and the notice the sender
is shown before sending. See item 3 below for how this content is moderated.

**On paid content:** the recording shows a purchase from the parish bookstore
and the giving flow. There is no paid or subscription content inside the app —
see item 4.

## 2. Purpose, audience, and the problem it solves

**SPSM Connect is the parish app of St. Philopater Mercurius & St. Mina Coptic
Orthodox Church**, a 501(c)(3) religious congregation at 169 Rice Rd, Wayland,
Massachusetts. It is published by the church itself, and the App Store seller
name is the church's legal name.

**Target audience:** the congregation of this parish — roughly a few hundred
families — together with visitors and anyone curious about the Coptic Orthodox
faith. It is a free app aimed at the general public, not at employees.

**The problem it solves.** A parish communicates through paper in a vestibule, a
website nobody checks on a phone, and a group chat that scrolls away. Families
miss the change to a service time, photographs of a children's camp live on
somebody's phone and are never shared with the parents, and a form that must be
filled in — a vehicle registration, a camp sign-up — means finding a laptop.
SPSM Connect puts all of it in one place: the parish calendar, the livestream
and its archive, the photograph galleries for each ministry, the church's forms,
its bookstore, its giving page, and an introduction to the liturgy for a visitor
who has never attended one.

**The value it provides** is that everything is current. The calendar, the
forms, the galleries and even the app's own colours are read live from the
church's database, so the parish office can correct a service time or publish a
new form without an app release.

**On Guideline 3.2 — this is not an employee or internal-business app.** Every
feature listed above is available to any member of the public with no account
and no sign-in. A small number of administrative screens — approving submitted
photographs, reviewing form submissions, taking camp attendance — are reserved
for the volunteers who run those ministries, and those screens are hidden
entirely from everyone else. They are a minority of the app and exist so the
public-facing content stays current; they are not its purpose. The app is
intended for, and useful to, the general public, which is why it is submitted
for public distribution rather than as a Custom App.

## 3. Setting up and accessing the main features

**No setup, no login, and no sample files are needed for the great majority of
the app.** Launch it and everything below is immediately available:

- **Calendar** — the parish calendar, in week and month views.
- **Send** (the centre tab) — take or choose a photograph and send it to the
  church. See the moderation note below.
- **Forms** — the church's forms, read live from its database. Tapping any form
  opens it; a form with a fee takes payment through Square's own sheet.
- **Bookstore** — physical books the parish stocks; card or Apple Pay via Square.
- **Giving** — opens the church's Tithe.ly donation page in the system browser.
- **Navigation drawer** — the photograph galleries by ministry, the livestream
  and its archive, an introduction to the liturgy and to the faith, the parish's
  expansion plans, contact details, notification settings, and the privacy
  notice.

### User-generated content, and how it is moderated

The app's only user-generated content is **photographs sent to the church**.
The moderation model is **pre-publication review**, and it is enforced by the
server, not by the app:

- A photograph is sent anonymously and is written to a quarantined location
  that **the sender themselves cannot read back**.
- It then waits in an approval queue belonging to a **named administrator of
  that specific ministry**, who is a volunteer signed in with a real church
  account.
- **Nothing is displayed to anyone, anywhere, until that administrator approves
  it.** Every query the app makes for gallery content filters on approved status,
  and the database's own security rules reject any query that does not — so this
  cannot be bypassed by a modified client.
- The sender is told this before and after sending, in as many words: *"The
  church reviews photographs before anybody else sees them."*
- An administrator can remove any photograph at any time after approval.

**On reporting and blocking.** Because of the above, a user of this app can
never encounter content submitted by another user: everything visible has been
selected and published by the church, exactly as the photographs on the parish's
own website are. There is also **no user-to-user interaction of any kind** — no
profiles, no comments, no direct messages, no follows, no feed of other users'
posts, and no display of who submitted anything. Senders are anonymous sessions
rather than accounts, so there is no user account for another user to block, and
no channel through which one user could reach another.

Anyone who objects to a published photograph — for example a parent who does not
want a picture of their child shown — can reach the parish office directly from
the app's **Contact** screen, and the **Privacy** screen states this and gives
the same contact route. Such requests are acted on by the same administrators
who approve the queue.

We are glad to add an in-app report control to the gallery if the review team
would prefer one; we did not include it because there is no unreviewed content
for it to act on, and we did not want to imply to parishioners that the
photographs the church has published are unvetted.

### Accessing the administrative screens

Administrative screens are hidden unless the signed-in account has been granted
the relevant area. Two demo accounts have been created for App Review in the
church's directory. Sign in from the navigation drawer → **Sign in with
Microsoft**.

| Purpose | Username | Password |
| --- | --- | --- |
| Main review account — grants for the photograph approval queue, form submissions and camp administration | `<<APPLE_DEMO_ACCOUNT_1>>` | `<<APPLE_DEMO_PASSWORD_1>>` |
| Second account, provided so the **account deletion** flow can be exercised without destroying the first | `<<APPLE_DEMO_ACCOUNT_2>>` | `<<APPLE_DEMO_PASSWORD_2>>` |

Both accounts are exempt from multi-factor authentication so that no second
device is required. Please sign in with the first account to see the
administrative screens; the second is disposable and exists so that deleting an
account does not remove your access to the rest.

After signing in with the first account, the following become visible:
**drawer → Photos → any ministry → the approval queue** (submitted photographs
awaiting review), **Forms → Admin** (form definitions and submissions), and a
**Camp** tab during the camp season.

### Testing a payment

Please do not use a live card. The build submitted for review is configured
against Square's **production** environment because that is what the parish
needs in order to sell a book; if the review team wishes to complete a purchase
end to end, tell us and we will provide a build pointed at Square's sandbox,
where test card `4111 1111 1111 1111`, any future expiry and any CVV complete a
payment without money moving. The payment sheet itself is Square's, and reaching
it — which the recording shows — demonstrates the flow without a charge.

## 4. External services, tools, and platforms

| Service | What it does here |
| --- | --- |
| **Google Firebase** — Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, Cloud Messaging, App Check (App Attest) | The app's entire backend: content, photographs, push notifications, and abuse prevention. App Check/App Attest is what stops a non-Apple client uploading to the church's storage. |
| **Microsoft Entra ID** (single-tenant) | Sign-in for the church's volunteers only, through Firebase Authentication's Microsoft provider. Not used by, or available to, the public. |
| **Square** (In-App Payments SDK) | Card and Apple Pay for physical books and real-world fees. See the note below on In-App Purchase. |
| **Tithe.ly** | The church's donation page, opened in the system browser rather than embedded, so the donor can see the address they are entering a card into. |
| **Castr** | The live video stream of services. |
| **YouTube** | The archive of past services; handed off to the YouTube app or browser rather than played in-app. |
| **www.spsmwayland.org** | The church's own website and API — the same content, same URLs, from the same database. Serves the calendar feed, issues signed upload URLs, and performs account deletion. |

**No artificial intelligence or machine learning services of any kind are used.**
No content in this app is AI-generated, and nothing a user enters is sent to any
AI provider.

**No advertising, analytics, attribution, or tracking SDKs of any kind are
present.** When the app encounters an error it records what broke and which
screen it happened on, into the church's own database, retained thirty days —
not to Apple, Google, or any crash-reporting company. It carries no name, no
account, and nothing identifying the device.

**On Guideline 3.1.1 — why there is no In-App Purchase.** The app sells nothing
that In-App Purchase covers, and therefore has no IAP products to submit:

- The **bookstore** sells *physical books*, shipped or collected at the church.
  Physical goods must not use In-App Purchase.
- **Forms with a fee** charge for *real-world services* — registering a vehicle
  for the car park, a place at the children's summer camp.
- **Giving** is a *charitable donation* to a 501(c)(3) religious organisation,
  collected on the church's own Tithe.ly page in the system browser.

There is no digital content, no subscription, and no feature inside the app that
is unlocked by paying.

## 5. Regional differences

**There are none.** The app contains no geographic gating of any kind: no
region checks, no country-conditional features, and no content that varies by
locale. Every user in every region sees identical features and identical
content, which is the life of one parish in Massachusetts.

Two details are US-anchored simply because the church is:

- Prices are shown in **US dollars**, and Square's merchant country is the
  United States. Square accepts internationally issued cards.
- The parish calendar is kept in **US Eastern time**, because that is when the
  services happen.

Neither restricts access or changes what any user can do.

## 6. Regulated industry and third-party material

**The app does not operate in a regulated industry.** It is the app of a
religious congregation. It offers no financial, medical, legal, gambling, or
similar regulated service. The only money it handles is the sale of books by the
church and donations to the church, both through established processors — Square
and Tithe.ly — with which the church holds merchant accounts in its own name.

**All content in the app belongs to the church**, and there is no third-party
protected material for which authorisation would be needed:

- The liturgical, catechetical and historical text, the introduction to the
  liturgy, the parish's history and its expansion plans are the church's own.
- The photographs are taken at the parish's own events and are published only
  after review by the parish (see item 3).
- The **livestream and its archive** are the church's own broadcasts, on the
  church's own Castr and YouTube channels.
- The **books** in the bookstore are physical stock the parish has purchased for
  resale; cover images are used to identify the copy being sold.
- The one set of third-party marks shown are **app icons identifying Tithe.ly
  and Taksis** on a screen that recommends them. They are displayed unmodified,
  purely to identify the app in question, and each links to that app's own App
  Store page. Taksis is also published by this church.

**Documentation.** The church's IRS 501(c)(3) determination letter and its
Massachusetts certificate of incorporation are available immediately on request;
please tell us where to upload them and they will be provided the same day.

## The App Clip

This submission includes an App Clip (`org.spsm.connect.Clip`). Its experiences
are invoked exclusively by **NFC tags and printed App Clip Codes physically
located in the church building** — by the car park, at the bookstore table, in
the vestibule — at URLs of the form `https://www.spsmwayland.org/c/<name>`.

The review team therefore cannot trigger them without a tag. To exercise the
clip on a device, please register a Local Experience under **Settings →
Developer → Local Experiences** with URL prefix `https://www.spsmwayland.org/c`
and bundle ID `org.spsm.connect.Clip`; any QR code holding one of those URLs
then brings up the real App Clip card. We are happy to mail physical NFC tags or
a printed card sheet to the review team if that would be more useful.

Thank you again for the review. We are happy to provide anything further.

> End of Part A.

---

# Part B — the 4,000-character version

> Answers Apple's six items in their own numbering, in 3,919 characters. This is
> what actually gets sent: paste it as the **Resolution Center reply** and into
> **App Store Connect → App Review Information → Notes**, where it stays for
> every future submission. Part A above is the same content at full length, for
> a reply box with no cap. Re-count after substituting the credentials — there
> is only about 80 characters of headroom.

1. RECORDING
Attached: a physical iPhone on current iOS, from a cold launch. The app
has NO account registration - no sign-up, no email/password, no social sign-in.
The only identity provider is the church's single-tenant Microsoft Entra
directory; accounts exist solely for volunteers who administer content. Account deletion is implemented anyway and is shown (drawer > account
card > Delete account): it removes the auth user and member record, and states
that it cannot remove the person's separate church Microsoft account. The
recording also covers the photograph flow, bookstore and giving.

2. PURPOSE AND AUDIENCE
SPSM Connect is the free parish app of St. Philopater Mercurius & St. Mina
Coptic Orthodox Church, a 501(c)(3) congregation in Wayland, Massachusetts,
published by the church itself. Audience: its congregation, visitors, and anyone
curious about the Coptic Orthodox faith. It replaces parish news on paper and in
chats that scroll away. The app carries the parish calendar, livestream
and archive, photograph galleries, the church's forms, bookstore, giving page
and an introduction to the liturgy - all read live from the church's database,
so the office can change them without a release.
Guideline 3.2: this is a public app, not an employee one. Every feature above
works with no account. A few admin screens (approving photographs, reviewing
submissions, camp attendance) are reserved for ministry volunteers and hidden
from everyone else; they exist only so the public content stays current.

3. SETUP AND ACCESS
No setup, login or sample files are needed: everything listed in item 2 works
signed out.
UGC: the only user-generated content is photographs sent to the church, and they
are pre-moderated server-side. A submission is quarantined where even its sender
cannot read it back, waits in a named ministry administrator's queue, and is
shown to nobody until approved; server rules reject any gallery query not
filtered to approved, so a modified client cannot bypass it. Senders are told
this; administrators can remove anything later.
Reporting/blocking: a user can never encounter unreviewed content, and there is
no user-to-user interaction - no profiles, comments, messages or feeds.
Submitters are anonymous, so there is no account to block and no channel between
users. Objections reach the parish office from the in-app Contact and Privacy
screens. We will gladly add a report control if you prefer one.
Demo accounts (drawer > Sign in with church account; MFA disabled):
Admin: <<ACCOUNT_1>> / <<PASSWORD_1>>
Disposable, for deletion testing: <<ACCOUNT_2>> / <<PASSWORD_2>>
The first reveals the approval queue (drawer > Photos > a ministry), Forms >
Admin and camp administration. Please do not use a live card; the build uses
Square production. We can supply a sandbox build on request.

4. EXTERNAL SERVICES
Google Firebase (Auth, Firestore, Storage, Functions, Messaging, App Check); Microsoft Entra ID, single-tenant, staff only; Square In-App
Payments; Tithe.ly for donations, in the system browser; Castr for the live
stream; YouTube for the archive; and the church's own site and API at
www.spsmwayland.org. NO AI or machine-learning services are used.
No IAP (3.1.1): the bookstore sells physical books, forms charge for real-world
services, and giving is a donation to a 501(c)(3) via Tithe.ly in the browser.
There is no digital content, subscription or paid unlock.

5. REGIONAL DIFFERENCES
None - no geographic gating anywhere; features and content are identical in
every region. Prices are USD and the calendar US Eastern, because the parish
is in Massachusetts.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not a regulated industry. All text, photographs and video are the church's own,
on its own Castr and YouTube channels, and third-party app icons appear
unmodified only to identify Tithe.ly and Taksis (also ours). The 501(c)(3) letter is available on request.

> End of Part B.

---

# Part C — ours

## C1. Before Part A is sent

- [ ] **Two Microsoft accounts exist in the church tenant for App Review**, and
      both have been signed into successfully *from the app on a physical
      device*, not merely created.
- [ ] **Multi-factor authentication and Conditional Access are exempted for
      both.** This is the step most likely to be missed and it fails silently
      from Apple's side — a reviewer meets an MFA prompt for a device they do
      not have, and files the same 2.1 again. Verify by signing in on a device
      that has never seen the tenant.
- [ ] **The first account holds real grants** — at minimum the photograph
      approval queue for one ministry, and forms. An account that signs in and
      reveals nothing is worse than no account, because it looks like the app is
      broken.
- [ ] **The approval queue is not empty.** Send two or three photographs from an
      unsigned device beforehand so the reviewer sees a queue with items in it.
- [ ] **A published gallery has photographs in it**, for the same reason.
- [ ] **Placeholders replaced in both parts.** Part A uses
      `<<APPLE_DEMO_ACCOUNT_1>>` and friends; Part B uses the shorter
      `<<ACCOUNT_1>>` / `<<PASSWORD_1>>` because it is counting characters.
      Re-count Part B afterwards — the cap is 4,000 and it sits at 3,919.
- [ ] **The exact submitted build launches on a physical iPhone.** Not the
      simulator. A Release build that drops Square's nested frameworks dies at
      launch under dyld with no crash report, which a reviewer would report as
      2.1 Bugs. `reset-ios.sh` checks the framework embed ordering; run it, and
      then actually launch the archive through TestFlight.
- [ ] **The App Clip installs and its version matches the app's.**
- [ ] The 501(c)(3) determination letter is to hand, in case item 6 is pressed.

## C2. The recording

One continuous take on a physical iPhone, current iOS, using the built-in
screen recorder (Control Centre). Roughly six to eight minutes. iOS has no
touch-indicator setting, so move deliberately and pause a beat on each screen
before tapping — that, and not a highlight ring, is what makes a flow readable
to somebody watching it once. **Start from the Home Screen
and tap the icon** — Apple asks for the launch explicitly, and a recording that
begins with the app already open reads as hiding a launch crash.

Sign in only where the script says to. Most of this must visibly happen signed
out, because that is the answer to Guideline 3.2.

1. **Home Screen → tap the icon.** Let the splash and first screen settle
   without cutting.
2. **Calendar** — week view, step forward, switch to month.
3. **Drawer → About / the liturgy tour** — scroll a page of real content.
4. **Drawer → Photos** — a ministry, then down into a level, then open a
   photograph full-screen. This is the published, moderated gallery.
5. **Send tab** — take a photograph, **pause on the notice that says the church
   reviews photographs before anybody else sees them**, and send it. Then show
   that it does not appear in the gallery. This is the whole moderation answer
   in fifteen seconds, so do not rush it.
6. **Forms** — open a free form, fill and submit it. Then open a form with a fee
   far enough to show Square's payment sheet appear. **Do not complete a live
   charge.**
7. **Bookstore** — a book, add to basket, open the basket, reach the Square
   sheet. Again, stop at the sheet.
8. **Giving** — tap through and show Tithe.ly opening in the browser with the
   address bar visible.
9. **Drawer → Livestream**, and **Contact**, and **Privacy**. Contact and
   Privacy matter: they are where Part A says a removal request goes.
10. **Sign in with church account**, using **account 1**. Show the Microsoft sheet.
11. **The approval queue** — approve one photograph, then show it appearing in
    the gallery. This closes the loop opened at step 5 and is the single most
    persuasive thing in the recording.
12. **Forms → Admin → submissions**, briefly.
13. **Sign out.** Show the admin screens disappearing.
14. **Sign in with account 2**, then **drawer → Delete account**. Show the
    confirmation text, confirm, and show the app returning to its signed-out
    state.

Step 14 destroys account 2. Re-provision it before sending the reply if the
recording has to be shot twice.

## C3. The one answer that is an argument, not a feature

Item 3's reporting-and-blocking answer rests on pre-moderation. That is a
genuinely strong position — there is no unreviewed content, no user-to-user
surface, and no account to block — and Apple accepts it routinely for
pre-moderated apps. It is not certain. A reviewer working from the 1.2 checklist
may want to see a report control regardless of whether there is anything for it
to report.

The answer above therefore ends by offering to add one. If Apple asks, the work
is small and already scoped: a report action in `src/gallery/PictureTools.tsx`
writing to a `reports` collection, surfaced in the existing
`src/gallery/ReviewQueue.tsx`, with matching Firestore rules and the mirror in
`../Website`. Roughly a day. Do not pre-emptively ship it — offering costs
nothing and shipping an unused control implies to parishioners that what the
church publishes is unvetted.

## C4. Keeping this file true

Part B is the Notes field, and the Notes field outlives this rejection. When the
demo accounts change, when a service in item 4 is added or dropped, or when the
moderation model changes, **edit Part B in the same sitting and paste it back
into App Store Connect.** A Notes field that describes last year's app is how a
smooth submission becomes a 2.1.


---

# Part D — the second rejection, 1.0 (8), 28 September 2026

Two findings: **2.3.10** (Google Play references in the binary) and **4.8**
(Login Services). 2.3.10 is fixed in code. **4.8 is not being changed, and that
is decided:** the church will not add Sign in with Apple or any other sign-in
option. Sign-in exists only to reveal administrative screens to servants the
church has already provisioned; it is not a feature offered to users. D2 is the
reply that says so.

## D1. What changed in the binary

**2.3.10 — each platform shows only its own store.**

- `components/storeArtwork.ts` / `storeArtwork.android.ts` — the App Store
  badge is bundled on iOS only and the Google Play badge on Android only.
  `StoreBadges` drops the other store's link. Covers the Apps screen and the
  Giving screen's Tithe.ly card.
- `apps/AppsScreen.tsx` — the "App Store and Google Play" line and the "both
  stores are listed" footer are gone.
- `privacy/notice.ts` — every Google/Android sentence has an iOS reading.
- `upload/errors.ts` — the unattested message names the platform's own store.

**4.8 — the sign-in is labelled for what it is.** Every button that said "Sign
in with Microsoft" now says **"Sign in with church account"**, and the sign-in
screen says there is no sign-up and that the parish office creates accounts.
The reviewer read the old label as a third-party social login; the Microsoft
sheet that opens is unchanged and still shows Microsoft's branding.

Content read live from Firestore or the website is not in the binary; check it
does not mention Google Play before resubmitting. Resubmit as a new build
number.

## D2. The Resolution Center reply

> Paste from here to the end of D2.

Thank you for the review.

**Guideline 2.3.10 — resolved.** All references to Google Play have been removed
from the iOS binary in the build now submitted. The app's store badges now show
only the App Store, and the in-app privacy notice no longer refers to Google
Play or other Google platforms.

**Guideline 4.8 — we believe this guideline does not apply, and ask that the
app be reconsidered as submitted.** We will not be adding another login
service, for the reasons below.

SPSM Connect does not offer a login service to its users. Sign-in exists for
one purpose: to reveal administrative screens — approving submitted
photographs, reviewing form submissions, and camp administration — to the
volunteers who serve our congregation in those ministries. It is not required
for, and unlocks nothing in, any feature intended for the public. The calendar,
livestream, galleries, forms, bookstore, giving and all other content work
fully with no account.

The account used is the church's own organisational account, not a
third-party or social login:

- **Accounts are issued by the church.** The church's single-tenant Microsoft
  Entra ID directory is its organisational account system. The parish office
  creates an account in it for a volunteer who has been given a ministry to
  administer, and removes it when they stop.
- **Users cannot create an account.** There is no sign-up anywhere in the app.
  A personal Microsoft account, or any account outside the church's directory,
  is refused.
- **Another login option could not work.** Administrative access is granted to
  specific accounts in the church's directory. An account from Sign in with
  Apple or any other service would not be in that directory, could not be given
  access, and would reveal nothing — a member of the public signing in that way
  would gain no feature at all.

This is the case Guideline 4.8 exempts: an app that exclusively uses the
organisation's own account setup and sign-in system, and that requires the
user to sign in with an existing account issued by that organisation. To make
this clearer in the app itself, the sign-in button now reads "Sign in with
church account", and the sign-in screen states that there is no sign-up and
that accounts are created by the parish office. The demo accounts in the App
Review Information are accounts in this same directory, created by the church
for App Review.

The screenshots in the app's metadata do not show a sign-in screen and are
unaffected.

We are happy to provide anything further, or to discuss this by phone.

> End of D2.

## D3. The Notes-field addendum

Append this to Part B in App Store Connect → App Review Information → Notes,
so the next reviewer does not raise 4.8 again. Part B is 3,923 characters and
this is 212, so the total runs about 140 over the 4,000 cap: cut that much from
item 2's purpose paragraph before pasting, and re-count after the credentials.

> SIGN-IN (4.8): not a login service. "Sign in with church account" only
> reveals admin screens to volunteers holding accounts the church issued in
> its single-tenant directory. No sign-up; the public never signs in.

## D4. If Apple rejects this again

Ask for a phone call through the Resolution Center before changing anything,
and if it still stands, appeal to the App Review Board. Removing sign-in from
the public binary (a Custom App or TestFlight for servants) is a fallback, not
a first answer.
