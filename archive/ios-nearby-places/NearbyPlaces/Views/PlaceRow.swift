import SwiftUI

struct PlaceRow: View {
    let place: Place

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(place.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(place.shortCategory)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(place.displayAddress)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Text(place.distanceText)
                .font(.callout.monospacedDigit().weight(.medium))
                .foregroundStyle(.tint)
                // 목록에서 거리 열이 들쭉날쭉하지 않도록 폭을 고정한다.
                .frame(minWidth: 56, alignment: .trailing)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    List {
        PlaceRow(place: Place(
            id: "1",
            name: "경복궁",
            category: "여행 > 관광,명소 > 문화유적 > 고궁,궁",
            roadAddress: "서울 종로구 사직로 161",
            address: "서울 종로구 세종로 1-1",
            phone: "02-3700-3900",
            latitude: 37.579617,
            longitude: 126.977041,
            distanceMeters: 231,
            placeURL: nil
        ))
        PlaceRow(place: Place(
            id: "2",
            name: "북촌한옥마을",
            category: "여행 > 관광,명소 > 문화유적",
            roadAddress: "서울 종로구 계동길 37",
            address: "서울 종로구 계동 105",
            phone: nil,
            latitude: 37.582604,
            longitude: 126.983814,
            distanceMeters: 1420,
            placeURL: nil
        ))
    }
}
