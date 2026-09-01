import SwiftUI

struct PlaceRow: View {
    let place: Place

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            thumbnail

            VStack(alignment: .leading, spacing: 4) {
                Text(place.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(place.category)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if !place.address.isEmpty {
                    Text(place.address)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if !place.subtitle.isEmpty {
                    Text(place.subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                Text(place.distanceText)
                    .font(.callout.monospacedDigit().weight(.medium))
                    .foregroundStyle(.tint)
                    .accessibilityLabel("직선거리 \(place.distanceText)")

                if let ratingText = place.ratingText {
                    Text(ratingText)
                        .font(.footnote.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.orange)
                }
            }
            // 거리 열이 들쭉날쭉하지 않도록 폭을 고정한다.
            .frame(minWidth: 56, alignment: .trailing)
        }
        .padding(.vertical, 4)
    }

    /// 사진이 없거나 로드에 실패해도 자리를 유지해 목록 정렬이 어긋나지 않게 한다.
    private var thumbnail: some View {
        AsyncImage(url: place.imageURL) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFill()
            default:
                Color.clear
            }
        }
        .frame(width: 72, height: 72)
        // UIColor를 거치지 않는다. SwiftUI만으로 끝내면 UIKit import가 필요 없다.
        .background(Color.gray.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    List {
        PlaceRow(place: Place(
            id: "1",
            name: "성산일출봉",
            category: "관광지",
            address: "제주 서귀포시 성산읍 일출로 284-12",
            note: "새벽에 오르면 사람이 적다",
            summary: "",
            imageURL: nil,
            placeURL: nil,
            rating: 4.6,
            latitude: 33.459282,
            longitude: 126.939720,
            distanceMeters: 231
        ))
        PlaceRow(place: Place(
            id: "2",
            name: "만장굴",
            category: "관광지",
            address: "제주 제주시 구좌읍 만장굴길 182",
            note: "",
            summary: "거문오름 용암동굴계에 속한 용암동굴이다.",
            imageURL: nil,
            placeURL: nil,
            rating: nil,
            latitude: 33.528378,
            longitude: 126.771616,
            distanceMeters: 1420
        ))
    }
}
