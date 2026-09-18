import SwiftUI

/// `/c/forms` — the church's forms, from the tag in the car park.
///
/// The tag opens whichever form the office has chosen, which is
/// `config/forms.nfcFormSlug` and defaults to the vehicle registration — that is
/// what the tag by the car park has always opened. The whole list is one press
/// away, because the office changes its mind and a tag is printed once.
///
/// ## The form itself opens in Safari, and that is not a shortcut
///
/// The app renders forms natively because it has a form engine: field types,
/// validation, file attachments, payment for the ones that charge. Porting that
/// to a 15 MB clip would be most of the budget for the rarest case. The church's
/// website renders every one of these already, submits to the same
/// `formSubmit`, and needs nothing installed — so the clip's job is to get
/// somebody to the right form in one tap, which it does.
///
/// It also sidesteps the unsettled question of whether a clip can mint an App
/// Check token at all: a form submitted in Safari is a browser submission, which
/// the website's own reCAPTCHA path already covers.
struct FormsView: View {
    @StateObject private var model = FormsModel()
    @State private var sheet: IdentifiableURL?

    var body: some View {
        ClipScreen(destination: .forms) {
            switch model.state {
            case .loading:
                ClipCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(Ink.accent)
                        ClipBody(text: "Reading the church's forms…")
                    }
                }

            case .failed(let message):
                ClipProblem(message: message) { model.load() }
                // The tag's own destination still works without the list,
                // because its slug has a default that needs no read.
                tagCard(slug: FormsModel.defaultSlug, title: "Register a vehicle")

            case .loaded(let forms):
                if let tagged = forms.first(where: { $0.slug == model.taggedSlug }) {
                    tagCard(slug: tagged.slug, title: tagged.title)
                }

                if forms.count > 1 {
                    ClipCard(spacing: 10) {
                        ClipEyebrow(text: "Every parish form")
                        ForEach(forms.filter { $0.slug != model.taggedSlug }, id: \.slug) { form in
                            Button {
                                sheet = IdentifiableURL(url: ClipConfig.page("/forms/\(form.slug)"))
                            } label: {
                                HStack {
                                    Text(form.title)
                                        .font(Face.body)
                                        .foregroundStyle(Ink.ink)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Ink.inkFaint)
                                }
                                .frame(minHeight: 44)
                            }
                            if form.slug != forms.last?.slug {
                                Divider().overlay(Ink.rule)
                            }
                        }
                    }
                }
            }

            ClipFooter(
                destination: .forms,
                readMore: "Every form the church keeps is on its website, and none of them needs an account."
            )
        }
        .safari(url: $sheet)
        .task { model.loadIfNeeded() }
    }

    private func tagCard(slug: String, title: String) -> some View {
        ClipCard {
            ClipEyebrow(text: "What this tag opens")
            ClipHeading(text: title)
            ClipBody(text: "It opens on the church's website. Nothing here needs an account.")
            ClipButton(label: "Open the form") {
                sheet = IdentifiableURL(url: ClipConfig.page("/forms/\(slug)"))
            }
        }
    }
}

struct ParishForm {
    let slug: String
    let title: String
    let order: Int
}

@MainActor
final class FormsModel: ObservableObject {
    enum State {
        case loading
        case loaded([ParishForm])
        case failed(String)
    }

    /// `DEFAULT_FORMS_PAGE_CONFIG.nfcFormSlug` in `@spsm/shared`. The vehicle
    /// registration is what the tag in the car park has always opened, and it is
    /// the right answer on a parish that has never changed the setting.
    static let defaultSlug = "vehicle-registration"

    @Published private(set) var state: State = .loading
    @Published private(set) var taggedSlug: String = FormsModel.defaultSlug
    private var started = false

    func loadIfNeeded() {
        guard !started else { return }
        started = true
        load()
    }

    func load() {
        state = .loading

        Task {
            /*
             * The setting first and separately, because it has a default and the
             * list does not. A failed settings read is not a failure of the
             * screen — the tag still opens the vehicle registration, which is
             * what it opened before anybody set anything.
             */
            if let config = try? await FirestoreREST.document("config/forms"),
               let slug = config["nfcFormSlug"]?.stringValue, !slug.isEmpty {
                taggedSlug = slug
            }

            do {
                let documents = try await FirestoreREST.collection("forms")

                let forms = documents.compactMap { fields -> ParishForm? in
                    // Published only. `firestore.rules` allows the read either
                    // way, so this is the clip's filter rather than the
                    // database's — the same `published == true` the website's
                    // own hub applies.
                    guard fields["published"]?.boolValue == true,
                          let slug = fields["slug"]?.stringValue,
                          let title = fields["title"]?.stringValue
                    else { return nil }

                    return ParishForm(slug: slug, title: title, order: fields["order"]?.intValue ?? 0)
                }
                // Lower `order` first, then alphabetical — exactly how the hub
                // on the web sorts. See `sortForms` in src/forms/data.ts.
                .sorted { $0.order != $1.order ? $0.order < $1.order : $0.title < $1.title }

                state = .loaded(forms)
            } catch {
                state = .failed("The church's forms could not be reached just now.")
            }
        }
    }
}
