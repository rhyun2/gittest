import CoreLocation
import Foundation

/// 카카오 로컬 API 카테고리 검색 구현체.
///
/// `sort=distance`를 넘기면 서버가 거리순으로 정렬하고 `distance` 필드(미터)까지 채워 주므로,
/// 앱에서 거리 계산이나 정렬을 다시 할 필요가 없다.
struct KakaoPlacesRepository: PlacesRepository {
    /// 나중에 프록시를 도입하면 이 값만 프록시 주소로 바꾸면 된다.
    static let endpoint = URL(string: "https://dapi.kakao.com/v2/local/search/category.json")!

    /// 카카오 `radius` 상한.
    static let maxRadius = 20_000
    /// 카카오 `size` 상한.
    static let maxPageSize = 15

    private let session: URLSession
    private let apiKeyProvider: @Sendable () -> String?

    init(
        session: URLSession = .shared,
        apiKeyProvider: @escaping @Sendable () -> String? = { AppSecrets.kakaoRestAPIKey }
    ) {
        self.session = session
        self.apiKeyProvider = apiKeyProvider
    }

    func nearby(
        center: CLLocationCoordinate2D,
        category: PlaceCategory,
        radius: Int
    ) async throws -> [Place] {
        guard let apiKey = apiKeyProvider() else { throw PlacesError.missingAPIKey }

        var components = URLComponents(url: Self.endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "category_group_code", value: category.rawValue),
            // 카카오는 x가 경도, y가 위도다. 순서를 뒤집으면 엉뚱한 곳의 결과가 나온다.
            URLQueryItem(name: "x", value: String(center.longitude)),
            URLQueryItem(name: "y", value: String(center.latitude)),
            URLQueryItem(name: "radius", value: String(min(max(radius, 0), Self.maxRadius))),
            // 기본값이 accuracy라서 거리순을 원하면 반드시 명시해야 한다.
            URLQueryItem(name: "sort", value: "distance"),
            URLQueryItem(name: "size", value: String(Self.maxPageSize)),
        ]

        var request = URLRequest(url: components.url!)
        request.setValue("KakaoAK \(apiKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PlacesError.invalidResponse }

        switch http.statusCode {
        case 200:
            break
        case 400:
            throw PlacesError.badRequest
        case 401, 403:
            throw PlacesError.unauthorized
        case 429:
            throw PlacesError.quotaExceeded
        default:
            throw PlacesError.server(status: http.statusCode)
        }

        do {
            let decoded = try JSONDecoder().decode(KakaoCategoryResponse.self, from: data)
            return decoded.documents.compactMap(Place.init(document:))
        } catch {
            throw PlacesError.invalidResponse
        }
    }
}

// MARK: - 응답 DTO

/// 카테고리 검색 응답 중 이 앱이 쓰는 필드만 담는다.
private struct KakaoCategoryResponse: Decodable {
    let documents: [Document]

    struct Document: Decodable {
        let id: String
        let placeName: String
        let categoryName: String
        let addressName: String
        let roadAddressName: String
        let phone: String
        /// 경도(longitude). 문자열로 온다.
        let x: String
        /// 위도(latitude). 문자열로 온다.
        let y: String
        let placeURL: String
        /// 직선거리(미터). 요청에 x, y를 넘겼을 때만 채워지고, 타입은 문자열이다.
        let distance: String

        // place_url -> placeUrl 이 되어 버려서 convertFromSnakeCase 대신 직접 매핑한다.
        enum CodingKeys: String, CodingKey {
            case id
            case placeName = "place_name"
            case categoryName = "category_name"
            case addressName = "address_name"
            case roadAddressName = "road_address_name"
            case phone
            case x
            case y
            case placeURL = "place_url"
            case distance
        }
    }
}

private extension Place {
    /// 좌표나 거리를 숫자로 못 바꾸면 그 장소는 버린다.
    init?(document: KakaoCategoryResponse.Document) {
        guard let longitude = CLLocationDegrees(document.x),
              let latitude = CLLocationDegrees(document.y),
              let distance = Int(document.distance)
        else { return nil }

        self.init(
            id: document.id,
            name: document.placeName,
            category: document.categoryName,
            roadAddress: document.roadAddressName,
            address: document.addressName,
            phone: document.phone.isEmpty ? nil : document.phone,
            latitude: latitude,
            longitude: longitude,
            distanceMeters: distance,
            placeURL: URL(string: document.placeURL)
        )
    }
}
