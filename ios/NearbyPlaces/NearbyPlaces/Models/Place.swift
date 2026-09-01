import CoreLocation
import Foundation

/// 화면에서 쓰는 장소 모델.
///
/// 웹앱이 만들어 배포한 places.json 한 건에 대응한다. 거리는 서버가 주지 않으므로
/// 좌표를 받아 앱에서 계산해 채운다.
struct Place: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    /// "관광지" · "맛집" · "카페"
    let category: String
    let address: String
    /// 직접 적은 한줄평. 있으면 요약보다 앞세운다.
    let note: String
    /// TourAPI에서 가져온 개요. 없는 장소가 많다.
    let summary: String
    let imageURL: URL?
    let placeURL: URL?
    let rating: Double?
    // CLLocationCoordinate2D는 Hashable이 아니라서 위경도를 따로 들고 있는다.
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
    /// 현재 위치로부터의 직선거리(미터). 저장소가 계산해 채운다.
    var distanceMeters: Int

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// 목록에 보여줄 한 줄. 한줄평이 있으면 그쪽을 쓴다. 사람이 쓴 글이 더 쓸모 있다.
    var subtitle: String {
        note.isEmpty ? summary : note
    }

    /// 1km 미만은 미터, 그 이상은 소수 첫째 자리 킬로미터.
    var distanceText: String {
        distanceMeters < 1000
            ? "\(distanceMeters)m"
            : String(format: "%.1fkm", Double(distanceMeters) / 1000)
    }

    var ratingText: String? {
        rating.map { String(format: "★ %.1f", $0) }
    }
}
