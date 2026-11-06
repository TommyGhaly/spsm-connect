import SwiftUI

/// One of the app's long About pages, in the clip: the words from
/// `AboutText.swift`, with the church's edits from `aboutOverrides/{slug}` laid
/// over them.
///
/// ---------------------------------------------------------------------------
/// ## Two layers, the app's two
///
/// The **coded text** is generated from `src/about/future.ts` and `tour.ts` by
/// `scripts/make-clip-text.mjs` — the same words the app's screens draw, so
/// the clip cannot say something the app does not. It is compiled in, and it
/// is what shows offline.
///
/// The **church's edits** are `aboutOverrides/{slug}`, which staff write from
/// the website's About editor and which `src/about/overrides.tsx` reads in the
/// app. Read here with one REST call when the page opens. The rules are the
/// shared package's: a slot with words replaces the coded words, a slot that is
/// empty or blank is *no override* (`copyOf`), and an override of a run of
/// paragraphs is split back into paragraphs on the blank line
/// (`paragraphsOf`). Sections staff added go at the foot, in their order.
///
/// A failed read is the coded text, unchanged and unannounced — exactly what
/// the app shows when the same read fails.
/// ---------------------------------------------------------------------------
struct AboutPage: View {
    let slug: String
    /// The construction fund button, for the `give` block.
    var give: (() -> Void)?

    @StateObject private var model = AboutModel()
    @State private var sheet: IdentifiableURL?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(model.page(slug).sections.enumerated()), id: \.offset) { _, section in
                SectionCard(section: section, slots: model.slots, give: give)
            }
            ForEach(model.added, id: \.id) { added in
                AddedSection(section: added)
            }
        }
        .environment(\.openURL, OpenURLAction { url in
            // A link in the church's text opens over the clip rather than
            // leaving it — see `Handoff.swift`.
            sheet = IdentifiableURL(url: url)
            return .handled
        })
        .safari(url: $sheet)
        .task { await model.load(slug) }
    }
}

/* ── The generated text ─────────────────────────────────────────────────── */

struct AboutDocument: Decodable {
    let sections: [Section]

    struct Section: Decodable {
        let ground: String
        let fold: Bool?
        let number: Int?
        let blocks: [Block]
    }

    struct Block: Decodable {
        let t: String
        let text: String?
        let slot: String?
        let label: String?
        let paragraphs: [String]?
        let items: [Item]?
        /// A picture: a path on the church's site, never a bundled file.
        let src: String?
        let alt: String?
        /// Width over height, so the space is held before the file lands.
        let aspect: Double?
    }

    struct Item: Decodable {
        let term: String?
        let termSlot: String?
        let detail: String?
        let detailSlot: String?
        let note: String?
        let noteSlot: String?
        let value: String?
        let label: String?
        let when: String?
        let what: String?
        let paragraphs: [String]?
        let src: String?
        let alt: String?
        let aspect: Double?
    }

    static let all: [String: AboutDocument] = {
        (try? JSONDecoder().decode([String: AboutDocument].self, from: Data(AboutText.json.utf8))) ?? [:]
    }()
}

/// A section staff appended on the website: `AboutSection` in
/// `schema/about.ts`. A `picture` section shows its words and caption; the
/// photograph itself stays on the website. (The coded pages' own pictures are
/// drawn, by path — see `RemotePicture`.)
struct AddedAboutSection {
    let id: String
    let order: Int
    let ground: String
    let eyebrow: String?
    let heading: String
    let body: String
    let items: [(term: String, detail: String)]
    let caption: String?
}

@MainActor
final class AboutModel: ObservableObject {
    @Published private(set) var slots: [String: String] = [:]
    @Published private(set) var added: [AddedAboutSection] = []
    private var loaded = false

    func page(_ slug: String) -> AboutDocument {
        AboutDocument.all[slug] ?? AboutDocument(sections: [])
    }

    func load(_ slug: String) async {
        guard !loaded else { return }
        loaded = true
        guard let fields = try? await FirestoreREST.document("aboutOverrides/\(slug)") else { return }

        var text: [String: String] = [:]
        for (key, value) in fields["slots"]?.mapValue ?? [:] {
            // `said()`: blank is not an override.
            if let words = value.mapValue?["text"]?.stringValue,
               !words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                text[key] = words
            }
        }
        slots = text

        added = (fields["sections"]?.arrayValue ?? []).prefix(24).compactMap { raw in
            guard let row = raw.mapValue, let id = row["id"]?.stringValue else { return nil }
            let items = (row["items"]?.arrayValue ?? []).compactMap { item -> (String, String)? in
                guard let map = item.mapValue, let term = map["term"]?.stringValue else { return nil }
                return (term, map["detail"]?.stringValue ?? "")
            }
            return AddedAboutSection(
                id: id,
                order: row["order"]?.intValue ?? 0,
                ground: row["ground"]?.stringValue ?? "plain",
                eyebrow: row["eyebrow"]?.stringValue,
                heading: row["heading"]?.stringValue ?? "",
                body: row["body"]?.stringValue ?? "",
                items: items,
                caption: row["image"]?.mapValue?["caption"]?.stringValue
            )
        }
        .sorted { $0.order < $1.order }
    }
}

/* ── Drawing it ─────────────────────────────────────────────────────────── */

/// The four grounds the About pages alternate between — `ABOUT_GROUNDS`.
private struct Ground {
    let paper: Color
    let ink: Color
    let soft: Color
    let accent: Color

    init(_ name: String) {
        switch name {
        case "deep":
            paper = Ink.deep; ink = Ink.inkInverse; soft = Ink.inkInverse.opacity(0.82); accent = Ink.gold
        case "sunken":
            paper = Ink.paperSunken; ink = Ink.ink; soft = Ink.inkSoft; accent = Ink.accent
        case "tinted":
            paper = Ink.accentSoft; ink = Ink.ink; soft = Ink.inkSoft; accent = Ink.accent
        default:
            paper = Ink.paperRaised; ink = Ink.ink; soft = Ink.inkSoft; accent = Ink.accent
        }
    }
}

/// The church's markup — `**bold**`, `*italic*`, `[a link](/path)` — which is
/// exactly the inline markdown `AttributedString` reads. Relative links resolve
/// against the church's site.
private func rich(_ text: String) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
    return (try? AttributedString(markdown: text, options: options, baseURL: ClipConfig.origin))
        ?? AttributedString(text)
}

private struct SectionCard: View {
    let section: AboutDocument.Section
    let slots: [String: String]
    let give: (() -> Void)?
    @State private var open = false

    var body: some View {
        let ground = Ground(section.ground)
        VStack(alignment: .leading, spacing: 12) {
            if section.fold == true {
                // A tour station: its heading and one line, then the rest
                // behind a button — six stations open at once is a very long
                // scroll for somebody standing in a doorway.
                Button { withAnimation(.easeOut(duration: 0.2)) { open.toggle() } } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        if let number = section.number {
                            Text("\(number)")
                                .font(Face.displayBold(22, relativeTo: .title2))
                                .foregroundStyle(ground.accent)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(Array(headBlocks.enumerated()), id: \.offset) { _, block in
                                BlockView(block: block, slots: slots, ground: ground, give: give)
                            }
                        }
                        Spacer(minLength: 4)
                        Image(systemName: open ? "chevron.up" : "chevron.down")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(ground.accent)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint(open ? "Hides this station" : "Shows this station")

                if open {
                    ForEach(Array(bodyBlocks.enumerated()), id: \.offset) { _, block in
                        BlockView(block: block, slots: slots, ground: ground, give: give)
                    }
                }
            } else {
                ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in
                    BlockView(block: block, slots: slots, ground: ground, give: give)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(ground.paper)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Ink.rule, lineWidth: section.ground == "deep" ? 0 : 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    /// The station's title and lede — everything before its first subhead.
    private var headBlocks: [AboutDocument.Block] {
        Array(section.blocks.prefix { $0.t == "eyebrow" || $0.t == "title" || $0.t == "lede" })
    }

    private var bodyBlocks: [AboutDocument.Block] {
        Array(section.blocks.dropFirst(headBlocks.count))
    }
}

private struct BlockView: View {
    let block: AboutDocument.Block
    let slots: [String: String]
    let ground: Ground
    let give: (() -> Void)?

    /// `copyOf`.
    private func words(_ coded: String?, _ slot: String?) -> String {
        slot.flatMap { slots[$0] } ?? coded ?? ""
    }

    /// `paragraphsOf`: an override is one string, split on the blank line.
    private var paragraphs: [String] {
        if let slot = block.slot, let override = slots[slot] {
            return override
                .components(separatedBy: "\n\n")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        return block.paragraphs ?? []
    }

    var body: some View {
        switch block.t {
        case "eyebrow":
            Text(words(block.text, block.slot).uppercased())
                .font(Face.label)
                .kerning(0.8)
                .foregroundStyle(ground.accent)

        case "title":
            Text(words(block.text, block.slot))
                .font(Face.heading)
                .foregroundStyle(ground.ink)
                .fixedSize(horizontal: false, vertical: true)

        case "lede":
            Text(rich(words(block.text, block.slot)))
                .font(Face.lede)
                .foregroundStyle(ground.soft)
                .tint(ground.accent)
                .fixedSize(horizontal: false, vertical: true)

        case "subhead":
            Text(block.text ?? "")
                .font(Face.displayBold(18, relativeTo: .headline))
                .foregroundStyle(ground.ink)
                .padding(.top, 6)
                .fixedSize(horizontal: false, vertical: true)

        case "prose":
            Paragraphs(paragraphs: paragraphs, ground: ground)

        case "small":
            Text(rich(words(block.text, block.slot)))
                .font(Face.small)
                .foregroundStyle(ground.soft)
                .tint(ground.accent)
                .fixedSize(horizontal: false, vertical: true)

        case "aside":
            Text(rich(block.text ?? ""))
                .font(Face.lede.italic())
                .foregroundStyle(ground.soft)
                .tint(ground.accent)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.leading, 12)
                .overlay(alignment: .leading) { Rectangle().fill(Ink.gold).frame(width: 2) }

        case "quote":
            VStack(alignment: .leading, spacing: 8) {
                if let label = block.label {
                    Text(label).font(Face.small.weight(.semibold)).foregroundStyle(ground.accent)
                }
                Paragraphs(paragraphs: paragraphs, ground: ground, italic: true)
            }
            .padding(12)
            .background(Ink.paperSunken.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 10))

        case "fold":
            Fold(block: block, ground: ground)

        case "figures":
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], alignment: .leading, spacing: 14) {
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { _, item in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.value ?? "")
                            .font(Face.displayBold(26, relativeTo: .title))
                            .foregroundStyle(ground.accent)
                        Text(item.label ?? "")
                            .font(Face.body.weight(.semibold))
                            .foregroundStyle(ground.ink)
                        Text(item.note ?? "")
                            .font(Face.small)
                            .foregroundStyle(ground.soft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }

        case "list":
            VStack(alignment: .leading, spacing: 12) {
                if let label = block.label {
                    Text(label).font(Face.body.weight(.semibold)).foregroundStyle(ground.ink)
                }
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { _, item in
                    ListRow(item: item, words: words, ground: ground, bulleted: item.detail == nil)
                }
            }

        case "timeline":
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(item.when ?? "")
                            .font(Face.small.weight(.semibold))
                            .foregroundStyle(ground.accent)
                            .frame(width: 96, alignment: .leading)
                        Text(rich(item.what ?? ""))
                            .font(Face.body)
                            .foregroundStyle(ground.soft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }

        case "steps":
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("\(index + 1)")
                            .font(Face.displayBold(18, relativeTo: .headline))
                            .foregroundStyle(ground.accent)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.term ?? "").font(Face.body.weight(.semibold)).foregroundStyle(ground.ink)
                            if let note = item.note {
                                Text(note).font(Face.small).foregroundStyle(ground.accent)
                            }
                            Paragraphs(paragraphs: item.paragraphs ?? [], ground: ground)
                        }
                    }
                }
            }

        case "plate":
            // `Plate`: column width, the caption under it. The caption can be
            // the church's edit; the picture is the website's file.
            VStack(alignment: .leading, spacing: 6) {
                RemotePicture(src: block.src, alt: block.alt, aspect: block.aspect)
                if !words(block.text, block.slot).isEmpty {
                    Text(rich(words(block.text, block.slot)))
                        .font(Face.small)
                        .foregroundStyle(ground.soft)
                        .tint(ground.accent)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

        case "strip":
            // `Strip`: a row of pictures to swipe through, each at one height
            // and its own width, the caption under it.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { _, item in
                        let width = Self.stripHeight * min(max(item.aspect ?? 1, 0.6), 1.8)
                        VStack(alignment: .leading, spacing: 6) {
                            RemotePicture(src: item.src, alt: item.alt, aspect: nil)
                                .frame(width: width, height: Self.stripHeight)
                            Text(item.note ?? "")
                                .font(Face.small)
                                .foregroundStyle(ground.soft)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(width: width, alignment: .leading)
                    }
                }
                .padding(.horizontal, 16)
            }
            // Out to the card's edges, so the row reads as one that goes on.
            .padding(.horizontal, -16)

        case "give":
            if let give {
                ClipButton(label: block.text ?? "Give", action: give)
            }

        case "elsewhere":
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "safari")
                Text(block.text ?? "")
                    .fixedSize(horizontal: false, vertical: true)
            }
            .font(Face.small)
            .foregroundStyle(ground.soft)

        default:
            EmptyView()
        }
    }
}

extension BlockView {
    static let stripHeight: CGFloat = 180
}

/// One of the website's pictures, fetched when it is drawn.
///
/// Nothing is bundled — the clip's 15 MB is for code — so until the file lands,
/// and if it never does, the space is held by a plain sunken ground of the
/// right shape: no spinner, no broken-image glyph, the same honest state as
/// `AppIconImage`. The words around it read whole either way.
private struct RemotePicture: View {
    let src: String?
    let alt: String?
    let aspect: Double?

    var body: some View {
        // No aspect fills whatever frame it is given — the strip's tiles.
        // (`aspectRatio(nil)` would not: it falls back to a square.)
        if let aspect {
            picture.aspectRatio(CGFloat(aspect), contentMode: .fit)
        } else {
            picture
        }
    }

    private var picture: some View {
        Rectangle()
            .fill(Ink.paperSunken)
            .overlay {
                if let src {
                    AsyncImage(url: ClipConfig.page(src), transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .accessibilityElement()
            .accessibilityLabel(alt ?? "")
            .accessibilityAddTraits(.isImage)
    }
}

private struct Paragraphs: View {
    let paragraphs: [String]
    let ground: Ground
    var italic = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(rich(paragraph))
                    .font(italic ? Face.body.italic() : Face.body)
                    .foregroundStyle(ground.soft)
                    .tint(ground.accent)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct ListRow: View {
    let item: AboutDocument.Item
    let words: (String?, String?) -> String
    let ground: Ground
    let bulleted: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            if bulleted {
                Text("•").foregroundStyle(ground.accent)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(rich(words(item.term, item.termSlot)))
                    .font(bulleted ? Face.body : Face.body.weight(.semibold))
                    .foregroundStyle(ground.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if item.detail != nil {
                    Text(rich(words(item.detail, item.detailSlot)))
                        .font(Face.body)
                        .foregroundStyle(ground.soft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if item.note != nil {
                    Text(words(item.note, item.noteSlot))
                        .font(Face.small)
                        .foregroundStyle(ground.accent)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The website's `Reveal`: a label, then its words behind a tap.
private struct Fold: View {
    let block: AboutDocument.Block
    let ground: Ground
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { withAnimation(.easeOut(duration: 0.2)) { open.toggle() } } label: {
                HStack(alignment: .firstTextBaseline) {
                    Text(block.label ?? "")
                        .font(Face.body.weight(.semibold))
                        .foregroundStyle(ground.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 8)
                    Image(systemName: open ? "minus" : "plus")
                        .foregroundStyle(ground.accent)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(open ? "Hides the explanation" : "Shows the explanation")

            if open {
                if let aside = block.text {
                    Text(rich(aside)).font(Face.small.italic()).foregroundStyle(ground.soft)
                }
                Paragraphs(paragraphs: block.paragraphs ?? [], ground: ground)
                ForEach(Array((block.items ?? []).enumerated()), id: \.offset) { _, part in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(part.term ?? "").font(Face.body.weight(.semibold)).foregroundStyle(ground.ink)
                        Text(rich(part.detail ?? "")).font(Face.body).foregroundStyle(ground.soft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(.vertical, 2)
        .overlay(alignment: .bottom) { Rectangle().fill(Ink.rule).frame(height: 1) }
    }
}

private struct AddedSection: View {
    let section: AddedAboutSection

    var body: some View {
        let ground = Ground(section.ground)
        VStack(alignment: .leading, spacing: 10) {
            if let eyebrow = section.eyebrow, !eyebrow.isEmpty {
                Text(eyebrow.uppercased()).font(Face.label).kerning(0.8).foregroundStyle(ground.accent)
            }
            if !section.heading.isEmpty {
                Text(section.heading).font(Face.heading).foregroundStyle(ground.ink)
            }
            if !section.body.isEmpty {
                Paragraphs(
                    paragraphs: section.body.components(separatedBy: "\n\n").filter {
                        !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    },
                    ground: ground
                )
            }
            ForEach(Array(section.items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(rich(item.term)).font(Face.body.weight(.semibold)).foregroundStyle(ground.ink)
                    if !item.detail.isEmpty {
                        Text(rich(item.detail)).font(Face.body).foregroundStyle(ground.soft)
                    }
                }
            }
            if let caption = section.caption, !caption.isEmpty {
                Text(caption).font(Face.small).foregroundStyle(ground.soft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(ground.paper)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Ink.rule, lineWidth: section.ground == "deep" ? 0 : 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
