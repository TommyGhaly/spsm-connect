import SwiftUI

/// `/c/give` — the offering.
///
/// Laid out after the website's `/giving`, which is two bands: the dome hero
/// with its verse and the one button (`features/giving/GivingHero.tsx`), and
/// Tithe.ly's app card underneath (`GivingApps.tsx`). The photograph is the same
/// file the website serves, fetched rather than bundled — the clip has 15 MB and
/// a hero photo is not where to spend it — and the portrait crop, because the
/// clip is always a phone. Between the two sits the one thing the website does
/// not need and a tag-tapper does: three lines saying what happens after "Give".
///
/// Two things worth stating plainly, because a payment inside an App Clip
/// sounds like it should be a problem and this one is not:
///
///   - **Nothing is charged by this binary.** The gift is made on Tithe.ly's own
///     hosted form, in Safari with the address visible. No card field belongs to
///     this app and there is nowhere in it to keep one.
///   - **A donation to a nonprofit is the case Apple names** for collecting
///     money outside in-app purchase, so this needs no payment SDK.
struct GiveView: View {
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .give) {
            GiveHero {
                sheet = IdentifiableURL(url: ClipConfig.givingURL)
            }

            ClipCard(spacing: 14) {
                ClipEyebrow(text: "How it works")
                GiveStep(number: 1, symbol: "hand.tap", text: "Tap **Give**. The church’s Tithe.ly page opens over this one.")
                GiveStep(number: 2, symbol: "calendar", text: "Choose an amount, and whether it is **once** or **recurring**.")
                GiveStep(number: 3, symbol: "creditcard", text: "Pay with **Apple Pay** or a card. Tithe.ly sends your receipt.")
            }

            GiveAppCard {
                sheet = IdentifiableURL(url: GiveAppCard.appStore)
            }
        }
        .safari(url: $sheet)
    }
}

/* ── The hero ───────────────────────────────────────────────────────────── */

/// The website's `.give-hero`, as a card: the dome photograph under a deep
/// veil, the verse with its gold rule, and a gold button — gold rather than the
/// accent for the website's reason, that red on oxblood is the quietest thing
/// in the band.
private struct GiveHero: View {
    let give: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 150)

            Text("OFFERING")
                .font(Face.label)
                .kerning(0.8)
                .foregroundStyle(Ink.gold)
            Text("Giving to the church")
                .font(Face.displayBold(26, relativeTo: .title))
                .foregroundStyle(Ink.inkInverse)
                .padding(.top, 4)

            // 1 Chronicles 29:14, as on the website's hero — said at the altar
            // in the Liturgy, and the sentence that says what an offering is.
            VStack(alignment: .leading, spacing: 6) {
                Text("“For all things come from You, and of Your own we have given You.”")
                    .font(Face.display(18))
                    .italic()
                    .foregroundStyle(Ink.inkInverse.opacity(0.92))
                    .fixedSize(horizontal: false, vertical: true)
                Text("1 CHRONICLES 29:14")
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.gold)
            }
            .padding(.leading, 14)
            .overlay(alignment: .leading) {
                Rectangle().fill(Ink.gold.opacity(0.6)).frame(width: 2)
            }
            .padding(.top, 14)

            Button(action: give) {
                HStack(spacing: 8) {
                    Image(systemName: "heart.fill")
                        .imageScale(.small)
                    Text("Give")
                        .font(Face.body.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
                .foregroundStyle(Ink.ink)
                .background(Ink.gold)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.top, 22)
            .accessibilityHint("Opens the church’s Tithe.ly giving page")

            Label {
                Text("Tithe.ly processes the payment. The church never sees your card details.")
            } icon: {
                Image(systemName: "lock.fill")
            }
            .font(Face.small)
            .foregroundStyle(Ink.inkInverse.opacity(0.75))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 12)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                Ink.deep
                AsyncImage(
                    url: ClipConfig.page("/img/hero-giving-portrait-900.webp"),
                    transaction: Transaction(animation: .easeOut(duration: 0.3))
                ) { phase in
                    if let image = phase.image {
                        // Anchored to the top: the dome and cross are the top
                        // of the portrait crop, and the bottom is where the
                        // words go under the heaviest part of the veil.
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .clipped()
                .accessibilityHidden(true)

                // The veil. Light over the cross, deep under the text — the
                // website's mobile veil, turned to run top to bottom because
                // here the words sit below the photograph rather than over it.
                LinearGradient(
                    stops: [
                        .init(color: Ink.deep.opacity(0.05), location: 0),
                        .init(color: Ink.deep.opacity(0.2), location: 0.25),
                        .init(color: Ink.deep.opacity(0.8), location: 0.42),
                        .init(color: Ink.deep.opacity(0.9), location: 0.6),
                        .init(color: Ink.deep.opacity(0.95), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay {
            // The website closes `.band--deep` with a gold hairline.
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Ink.gold.opacity(0.35), lineWidth: 1)
        }
    }
}

/* ── How it works ───────────────────────────────────────────────────────── */

private struct GiveStep: View {
    let number: Int
    let symbol: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(Ink.accentSoft)
                Image(systemName: symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Ink.accent)
            }
            .frame(width: 34, height: 34)
            .accessibilityHidden(true)

            Text(text)
                .font(Face.body)
                .foregroundStyle(Ink.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 7)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("Step \(number). ") + Text(text))
    }
}

/* ── Tithe.ly's app ─────────────────────────────────────────────────────── */

/// The website's `GivingApps`: the same app card `/c/apps` shows, because the
/// thing asked here is the same — find a blue app in the store that is not
/// named after this church. The icon and the publisher are how you know.
private struct GiveAppCard: View {
    /// From `src/apps/stores.ts`, as on `/c/apps` — Tithe.ly ships two products
    /// under similar names, and this is the giving one.
    static let appStore = URL(string: "https://apps.apple.com/us/app/tithely-giving/id694740700")!

    let open: () -> Void

    var body: some View {
        ClipCard(spacing: 12) {
            ClipEyebrow(text: "Giving from a phone")
            HStack(spacing: 12) {
                AppIconImage(url: ClipConfig.page("/img/app-tithely-192.webp"), size: 52)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Tithely Giving")
                        .font(Face.body.weight(.semibold))
                        .foregroundStyle(Ink.ink)
                    Text("Tithe.ly")
                        .font(Face.small)
                        .foregroundStyle(Ink.inkFaint)
                }
            }
            ClipBody(text: "Gives to the church once or on a schedule — the same offering as the button above. You don’t need it to give.")
            Rectangle().fill(Ink.rule).frame(height: 1)
            AppStoreBadge(appName: "Tithely Giving", action: open)
        }
    }
}
