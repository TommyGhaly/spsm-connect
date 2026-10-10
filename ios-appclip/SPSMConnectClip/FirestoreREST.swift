import Foundation

/// Firestore, over its REST API, with no SDK.
///
/// The Firebase iOS SDK is the single largest thing that would not fit in this
/// clip — `FirebaseFirestore` drags in gRPC, BoringSSL, abseil and leveldb, and
/// in the React Native clip those accounted for most of an 18 MB executable
/// against a 15 MB budget for the whole bundle.
///
/// What the clip actually needs from Firestore is two unauthenticated reads.
/// That is a URL and some JSON, and this is it. The same approach Taksis's clip
/// takes, and the same one `@spsm/shared`'s own `firestoreRest.ts` exists for.
///
/// **Reads only, and only what `firestore.rules` already makes public.** There
/// is no write path here on purpose: a write from a clip would need an App Check
/// token, and that question is unsettled — see `AppAttest.swift`.
enum FirestoreREST {
    private static var base: String {
        "https://firestore.googleapis.com/v1/projects/\(ClipConfig.firebaseProjectId)/databases/(default)/documents"
    }

    /// One document, as its decoded fields.
    static func document(_ path: String) async throws -> [String: FirestoreValue] {
        let url = URL(string: "\(base)/\(path)?key=\(ClipConfig.firebaseApiKey)")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }

        /*
         * 404 is not an error here. An absent settings document means "the
         * church has never set this", which every caller has a default for —
         * the same contract `readFormsPageConfig` keeps in the app, where a
         * failed read resolves to the defaults and never rejects.
         */
        if http.statusCode == 404 { return [:] }
        guard (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }

        let decoded = try JSONDecoder().decode(FirestoreDocument.self, from: data)
        return decoded.fields ?? [:]
    }

    /// Every document in a collection, as decoded fields.
    ///
    /// No ordering and no filtering: the collections this reads are small enough
    /// to sort on the phone. Callers filter in Swift.
    ///
    /// Only usable where `firestore.rules` allows an *unconstrained* list. It
    /// does not for `products` — see `query(_:where:equals:)` below.
    static func collection(_ path: String) async throws -> [[String: FirestoreValue]] {
        let url = URL(string: "\(base)/\(path)?key=\(ClipConfig.firebaseApiKey)&pageSize=100")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(FirestoreList.self, from: data)
        return (decoded.documents ?? []).map { $0.fields ?? [:] }
    }

    /// One equality filter over a collection, via `runQuery`.
    ///
    /// ---------------------------------------------------------------------
    /// A POST and a structured query, where `collection(_:)` above is a GET —
    /// and the difference is not convenience. `products` carries
    ///
    ///     allow read: if isPublished(resource.data);
    ///
    /// and a Firestore **list** is granted only when the query itself proves
    /// every document it could return satisfies that. An unfiltered GET proves
    /// nothing and is refused outright, so the filter is not an optimisation
    /// for a shop of eleven titles: it is the only shape of request the rules
    /// allow. The app states the same filter as `where('published', '==', true)`
    /// in `src/bookstore/data.ts`, and the website's `useLiveCatalog` as well.
    /// Three callers, one rule, one predicate.
    /// ---------------------------------------------------------------------
    static func query(
        _ collectionId: String,
        where field: String,
        equals value: Bool
    ) async throws -> [(id: String, fields: [String: FirestoreValue])] {
        let url = URL(string: "\(base):runQuery?key=\(ClipConfig.firebaseApiKey)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 12
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "structuredQuery": [
                "from": [["collectionId": collectionId]],
                "where": [
                    "fieldFilter": [
                        "field": ["fieldPath": field],
                        "op": "EQUAL",
                        "value": ["booleanValue": value],
                    ],
                ],
                "limit": 200,
            ],
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        /*
         * `runQuery` answers with a stream of results rather than a list, and a
         * result is allowed to carry no document at all — an empty match comes
         * back as a single entry holding only a `readTime`. `compactMap` is
         * what makes "the shop has nothing published" an empty array instead of
         * a decode failure.
         */
        let results = try JSONDecoder().decode([FirestoreQueryResult].self, from: data)
        return results.compactMap { result in
            guard let document = result.document, let name = document.name else { return nil }
            // `name` is the full resource path; the document id is its last
            // segment. Carried out because a product's id is its slug and the
            // checkout is keyed by slug.
            let id = String(name.split(separator: "/").last ?? "")
            guard !id.isEmpty else { return nil }
            return (id, document.fields ?? [:])
        }
    }
}

private struct FirestoreQueryResult: Decodable {
    let document: FirestoreDocument?
}

private struct FirestoreDocument: Decodable {
    /// The full resource path, present on `runQuery` results and unused by the
    /// two single-document readers above.
    let name: String?
    let fields: [String: FirestoreValue]?
}

private struct FirestoreList: Decodable {
    let documents: [FirestoreDocument]?
}

/// Firestore's REST encoding, which wraps every value in a type tag:
/// `{"stringValue": "…"}`, `{"booleanValue": true}`, and so on.
///
/// Only the four kinds the clip actually reads are decoded. An unrecognised one
/// becomes `.unknown` rather than a thrown error, because a new field added to a
/// document by the website must never stop the clip reading the fields it does
/// understand.
indirect enum FirestoreValue: Decodable {
    case string(String)
    case bool(Bool)
    case integer(Int)
    case map([String: FirestoreValue])
    case array([FirestoreValue])
    case unknown

    private enum CodingKeys: String, CodingKey {
        case stringValue, booleanValue, integerValue, mapValue, arrayValue
    }

    /// The two container shapes, which Firestore nests one level deeper than
    /// the scalars: `{"mapValue": {"fields": {…}}}`, `{"arrayValue": {"values": […]}}`.
    private struct MapBox: Decodable { let fields: [String: FirestoreValue]? }
    private struct ArrayBox: Decodable { let values: [FirestoreValue]? }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let value = try? container.decode(String.self, forKey: .stringValue) {
            self = .string(value)
        } else if let value = try? container.decode(Bool.self, forKey: .booleanValue) {
            self = .bool(value)
        } else if let raw = try? container.decode(String.self, forKey: .integerValue) {
            // Firestore sends integers as strings in JSON, which is easy to
            // miss and produces a silent decode failure rather than a loud one.
            self = .integer(Int(raw) ?? 0)
        } else if let box = try? container.decode(MapBox.self, forKey: .mapValue) {
            self = .map(box.fields ?? [:])
        } else if let box = try? container.decode(ArrayBox.self, forKey: .arrayValue) {
            self = .array(box.values ?? [])
        } else {
            self = .unknown
        }
    }

    var stringValue: String? { if case .string(let v) = self { return v } else { return nil } }
    var boolValue: Bool? { if case .bool(let v) = self { return v } else { return nil } }
    var intValue: Int? { if case .integer(let v) = self { return v } else { return nil } }
    var mapValue: [String: FirestoreValue]? { if case .map(let v) = self { return v } else { return nil } }
    var arrayValue: [FirestoreValue]? { if case .array(let v) = self { return v } else { return nil } }
}
