import SwiftUI

/// The shared furniture: a screen, a card, a button, a label.
///
/// The Swift counterparts of `components/Surface.tsx` and `components/Type.tsx`,
/// kept deliberately small. Every one of these exists because three or more
/// screens need it; anything used once is written where it is used.

/// The standing ground for every experience: a deep header carrying the
/// church's name and the card title, over a scrolling body on `paper`.
struct ClipScreen<Content: View>: View {
    let destination: ClipDestination
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("ST. PHILOPATER MERCURIUS & ST. MINA")
                    .font(Face.label)
                    .kerning(0.8)
                    .foregroundStyle(Ink.gold)
                Text(destination.title)
                    .font(Face.title)
                    .foregroundStyle(Ink.inkInverse)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 18)
            .background(Ink.deep)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    content()
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Ink.paper)
        }
        .background(Ink.paper)
        /*
         * An App Clip is presented as a sheet the system sizes, and it is not
         * full height. Ignoring the bottom safe area lets the body run to the
         * edge rather than leaving a band of paper under the last card.
         */
        .ignoresSafeArea(edges: .bottom)
    }
}

/// A raised panel. The clip's whole visual vocabulary is cards on paper, which
/// is the app's too.
struct ClipCard<Content: View>: View {
    var spacing: CGFloat = 10
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Ink.paperRaised)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Ink.rule, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

/// The eyebrow above a heading — small, tracked, and the accent's only job
/// besides the primary button.
struct ClipEyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(Face.label)
            .kerning(0.8)
            .foregroundStyle(Ink.accent)
    }
}

struct ClipHeading: View {
    let text: String
    var body: some View {
        Text(text).font(Face.heading).foregroundStyle(Ink.ink)
    }
}

struct ClipBody: View {
    let text: String
    var tone: Color = Ink.inkSoft
    var body: some View {
        Text(text)
            .font(Face.body)
            .foregroundStyle(tone)
            .fixedSize(horizontal: false, vertical: true)
    }
}

enum ClipButtonTone { case primary, quiet }

struct ClipButton: View {
    let label: String
    var tone: ClipButtonTone = .primary
    var busy: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView()
                        .tint(tone == .primary ? Ink.inkInverse : Ink.accent)
                        .scaleEffect(0.8)
                }
                Text(label)
                    .font(.system(size: 16, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            // 44pt, which is the tap target every one of these has to clear.
            .frame(minHeight: 48)
            .foregroundStyle(tone == .primary ? Ink.inkInverse : Ink.accent)
            .background(tone == .primary ? Ink.accent : Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(tone == .primary ? Color.clear : Ink.rule, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(busy)
    }
}

/// What every screen shows when a fetch fails.
///
/// One sentence and a retry, never a status code — the same rule
/// `upload/errors.ts` follows for the app. A clip is opened by somebody
/// standing in a doorway, and the useful thing is whether pressing again might
/// work.
struct ClipProblem: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        ClipCard {
            ClipEyebrow(text: "That did not load")
            ClipBody(text: message)
            if let retry {
                ClipButton(label: "Try again", tone: .quiet, action: retry)
            }
        }
    }
}
