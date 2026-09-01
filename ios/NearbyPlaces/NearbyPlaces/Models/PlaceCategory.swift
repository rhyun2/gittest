import Foundation

/// 카카오 로컬 API의 카테고리 그룹 코드.
///
/// 요청 한 번에 코드 하나만 넘길 수 있으므로, 여러 카테고리를 함께 보여주려면
/// 병렬로 호출한 뒤 `distanceMeters` 기준으로 다시 정렬해야 한다.
enum PlaceCategory: String, CaseIterable, Identifiable, Sendable {
    case attraction = "AT4"
    case restaurant = "FD6"
    case cafe = "CE7"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .attraction: "관광지"
        case .restaurant: "맛집"
        case .cafe: "카페"
        }
    }

}
