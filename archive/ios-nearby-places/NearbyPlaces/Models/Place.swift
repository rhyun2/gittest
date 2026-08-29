import CoreLocation
import Foundation

/// 화면에서 쓰는 장소 모델. 카카오 응답 DTO와 분리해 두면 데이터 소스를 바꿔도 뷰가 영향받지 않는다.
struct Place: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    /// "음식점 > 한식 > 육류,고기" 형태의 전체 분류 문자열.
    let category: String
    let roadAddress: String
    let address: String
    let phone: String?
    // CLLocationCoordinate2D는 Hashable이 아니라서 위경도를 따로 들고 있는다.
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
    /// 카카오가 계산해서 내려준 직선거리(미터).
    let distanceMeters: Int
    let placeURL: URL?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// 도로명 주소가 비어 있는 장소가 종종 있어 지번 주소로 폴백한다.
    var displayAddress: String {
        roadAddress.isEmpty ? address : roadAddress
    }

    /// "음식점 > 한식 > 육류,고기" 중 가장 구체적인 마지막 조각만 보여준다.
    var shortCategory: String {
        category
            .split(separator: ">")
            .last
            .map { $0.trimmingCharacters(in: .whitespaces) }
            ?? category
    }

    /// 1km 미만은 미터, 그 이상은 소수 첫째 자리 킬로미터.
    var distanceText: String {
        distanceMeters < 1000
            ? "\(distanceMeters)m"
            : String(format: "%.1fkm", Double(distanceMeters) / 1000)
    }
}
