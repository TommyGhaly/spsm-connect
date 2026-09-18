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
    /// No ordering and no filtering: both would need `runQuery`, a POST and a
    /// structured query, and the collections this reads are small enough to sort
    /// on the phone. Callers filter in Swift.
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
}

private struct FirestoreDocument: Decodable {
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
enum FirestoreValue: Decodable {
    case string(String)
    case bool(Bool)
    case integer(Int)
    case unknown

    private enum CodingKeys: String, CodingKey {
        case stringValue, booleanValue, integerValue
    }

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
        } else {
            self = .unknown
        }
    }

    var stringValue: String? { if case .string(let v) = self { return v } else { return nil } }
    var boolValue: Bool? { if case .bool(let v) = self { return v } else { return nil } }
    var intValue: Int? { if case .integer(let v) = self { return v } else { return nil } }
}
