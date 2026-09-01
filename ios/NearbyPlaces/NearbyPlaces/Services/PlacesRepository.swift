import CoreLocation
import Foundation

/// 장소 검색 추상화.
///
/// 구현체를 갈아끼우면 데이터 소스를 바꿔도 뷰모델과 뷰는 손대지 않아도 된다.
protocol PlacesRepository: Sendable {
    /// `center` 주변 장소를 가까운 순으로 돌려준다.
    /// - Parameter radius: 미터.
    func nearby(
        center: CLLocationCoordinate2D,
        category: PlaceCategory,
        radius: Int
    ) async throws -> [Place]
}

enum PlacesError: LocalizedError, Equatable {
    /// 장소 목록을 내려받지 못했다. 대개 네트워크 문제다.
    case unreachable
    case server(status: Int)
    /// 받아온 JSON을 해석하지 못했다. 배포된 파일 형식이 바뀐 경우다.
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unreachable:
            "장소 목록을 내려받지 못했습니다. 네트워크 연결을 확인해 주세요."
        case let .server(status):
            "장소 목록을 가져오지 못했습니다. (HTTP \(status))"
        case .invalidResponse:
            "장소 목록을 해석하지 못했습니다. 배포된 데이터 형식을 확인해 주세요."
        }
    }
}
