import CoreLocation
import Foundation

/// 장소 검색 추상화.
///
/// 구현체를 갈아끼우면 데이터 소스를 바꾸거나(해외 대응 시 MapKit 등) 앞단에 프록시를 붙일 때
/// 뷰모델과 뷰는 손대지 않아도 된다.
protocol PlacesRepository: Sendable {
    /// `center` 주변 장소를 가까운 순으로 돌려준다.
    /// - Parameter radius: 미터. 카카오 기준 상한은 20,000m다.
    func nearby(
        center: CLLocationCoordinate2D,
        category: PlaceCategory,
        radius: Int
    ) async throws -> [Place]
}

enum PlacesError: LocalizedError, Equatable {
    /// Secrets.xcconfig에 REST 키가 없다.
    case missingAPIKey
    /// 401 — 키가 잘못됐거나 해당 앱에서 로컬 API가 활성화되지 않았다.
    case unauthorized
    /// 429 — 일/월 쿼터 초과.
    case quotaExceeded
    case badRequest
    case server(status: Int)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            "카카오 REST API 키가 설정되지 않았습니다."
        case .unauthorized:
            "API 키가 올바르지 않습니다. 카카오 개발자 콘솔에서 REST API 키와 카카오맵 활성화 상태를 확인하세요."
        case .quotaExceeded:
            "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."
        case .badRequest:
            "검색 요청이 올바르지 않습니다. 반경 값을 확인해 주세요."
        case let .server(status):
            "장소 정보를 가져오지 못했습니다. (HTTP \(status))"
        case .invalidResponse:
            "장소 정보를 해석하지 못했습니다."
        }
    }
}
