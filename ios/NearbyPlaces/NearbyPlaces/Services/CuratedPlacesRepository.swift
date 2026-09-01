import CoreLocation
import Foundation

/// 웹앱이 배포한 큐레이션 장소 목록을 받아 쓴다.
///
/// 씨드 파일 → 수집 스크립트 → places.json 까지가 웹 저장소에서 끝나 있고,
/// 이 앱은 완성된 정적 JSON을 내려받기만 한다. **API 키가 필요 없다.**
/// 씨드를 고쳐 재배포하면 앱을 다시 빌드하지 않아도 내용이 바뀐다.
///
/// 카카오 REST를 쓸 때는 서버가 거리를 계산해 정렬까지 해 줬지만, 여기에는 좌표뿐이라
/// 거리 계산과 정렬을 앱이 한다. 웹앱의 js/curated.js 와 같은 구조다.
actor CuratedPlacesRepository: PlacesRepository {
    static let dataURL = URL(string: "https://rhyun2.github.io/gittest/data/places.json")!

    private let url: URL
    private let session: URLSession
    /// 한 번 받으면 앱이 살아 있는 동안 재사용한다.
    private var cached: [Entry]?

    init(url: URL = CuratedPlacesRepository.dataURL, session: URLSession = .shared) {
        self.url = url
        self.session = session
    }

    func nearby(
        center: CLLocationCoordinate2D,
        category: PlaceCategory,
        radius: Int
    ) async throws -> [Place] {
        let entries = try await loadEntries()
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)

        return entries
            .filter { $0.categoryCode == category.rawValue }
            .compactMap { entry -> Place? in
                let target = CLLocation(latitude: entry.lat, longitude: entry.lng)
                let distance = origin.distance(from: target)
                guard distance <= Double(radius) else { return nil }
                return entry.toPlace(distanceMeters: Int(distance.rounded()))
            }
            .sorted { $0.distanceMeters < $1.distanceMeters }
    }

    private func loadEntries() async throws -> [Entry] {
        if let cached { return cached }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            throw PlacesError.unreachable
        }

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw PlacesError.server(status: http.statusCode)
        }

        do {
            let decoded = try JSONDecoder().decode(Payload.self, from: data)
            cached = decoded.places
            return decoded.places
        } catch {
            throw PlacesError.invalidResponse
        }
    }

    /// 테스트나 당겨서 새로고침에서 다시 받고 싶을 때.
    func clearCache() {
        cached = nil
    }
}

// MARK: - places.json 구조

private extension CuratedPlacesRepository {
    struct Payload: Decodable {
        let places: [Entry]
    }

    /// 배포된 JSON 한 건.
    ///
    /// address·summary·image·rating·note 는 없는 항목이 있어 전부 옵셔널이다.
    /// 하나라도 필수로 잡으면 그 항목 때문에 목록 전체의 디코딩이 실패한다.
    struct Entry: Decodable, Sendable {
        let id: String
        let name: String
        let category: String
        let categoryCode: String
        let lat: Double
        let lng: Double
        let placeUrl: String

        let address: String?
        let summary: String?
        let image: String?
        let rating: Double?
        let note: String?

        func toPlace(distanceMeters: Int) -> Place {
            Place(
                id: id,
                name: name,
                category: category,
                address: address ?? "",
                note: note ?? "",
                summary: summary ?? "",
                imageURL: image.flatMap(URL.init(string:)),
                placeURL: URL(string: placeUrl),
                rating: rating,
                latitude: lat,
                longitude: lng,
                distanceMeters: distanceMeters
            )
        }
    }
}
