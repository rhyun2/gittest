import SwiftUI
import UIKit

struct NearbyListView: View {
    @State private var viewModel: NearbyViewModel

    init(viewModel: NearbyViewModel = NearbyViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                controls
                Divider()
                content
            }
            .navigationTitle("내 주변")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("새로고침", systemImage: "arrow.clockwise") {
                        viewModel.refresh()
                    }
                    .disabled(isLoading)
                }
            }
            .task { viewModel.onAppear() }
            .onChange(of: viewModel.category) { viewModel.reload() }
            .onChange(of: viewModel.radius) { viewModel.reload() }
        }
    }

    private var isLoading: Bool {
        if case .loading = viewModel.state { return true }
        return false
    }

    // MARK: - 상단 컨트롤

    private var controls: some View {
        VStack(spacing: 12) {
            Picker("카테고리", selection: $viewModel.category) {
                ForEach(PlaceCategory.allCases) { category in
                    Text(category.title).tag(category)
                }
            }
            .pickerStyle(.segmented)

            HStack {
                Text("반경")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Picker("반경", selection: $viewModel.radius) {
                    ForEach(NearbyViewModel.radiusOptions, id: \.self) { meters in
                        Text(viewModel.label(forRadius: meters)).tag(meters)
                    }
                }
                .pickerStyle(.segmented)
            }

            if viewModel.isReducedAccuracy {
                reducedAccuracyBanner
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }

    private var reducedAccuracyBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "location.slash")
            Text("정확한 위치가 꺼져 있어 거리가 정확하지 않을 수 있어요.")
                .font(.caption)
            Spacer(minLength: 0)
            Button("설정") { openSettings() }
                .font(.caption.weight(.semibold))
        }
        .padding(10)
        .background(.yellow.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - 본문

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView("주변을 찾는 중…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case let .loaded(places):
            List(places) { place in
                if let url = place.placeURL {
                    // 카카오맵 장소 상세 페이지를 Safari로 연다.
                    // Link의 라벨은 기본적으로 강조색이 입혀지므로 본문 색으로 되돌린다.
                    Link(destination: url) {
                        PlaceRow(place: place)
                    }
                    .foregroundStyle(.primary)
                } else {
                    PlaceRow(place: place)
                }
            }
            .listStyle(.plain)
            .refreshable { await viewModel.refreshAndWait() }

        case .empty:
            ContentUnavailableView {
                Label("주변에 등록된 곳이 없어요", systemImage: "mappin.slash")
            } description: {
                // 이 앱은 실시간 검색을 하지 않는다. 직접 등록해 둔 장소만 보여주므로
                // 등록 지역(현재는 제주) 밖에서는 반경을 넓혀도 계속 0건이다.
                Text("이 앱은 미리 등록해 둔 장소만 보여줍니다. 아직 이 지역에는 등록된 곳이 없어요.")
            } actions: {
                if let wider = nextRadius {
                    Button("\(viewModel.label(forRadius: wider))까지 넓혀보기") {
                        viewModel.radius = wider
                    }
                }
            }

        case let .failed(failure):
            failureView(failure)
        }
    }

    @ViewBuilder
    private func failureView(_ failure: NearbyViewModel.Failure) -> some View {
        switch failure {
        case .permissionDenied:
            ContentUnavailableView {
                Label("위치 권한이 필요해요", systemImage: "location.slash")
            } description: {
                Text("설정에서 위치 접근을 '앱을 사용하는 동안'으로 허용하면 주변 장소를 찾아드려요.")
            } actions: {
                Button("설정 열기") { openSettings() }
                    .buttonStyle(.borderedProminent)
            }

        case let .message(text):
            ContentUnavailableView {
                Label("불러오지 못했어요", systemImage: "exclamationmark.triangle")
            } description: {
                Text(text)
            } actions: {
                Button("다시 시도") { viewModel.refresh() }
                    .buttonStyle(.borderedProminent)
            }
        }
    }

    // MARK: - 액션

    /// 지금 반경보다 한 단계 넓은 선택지. 이미 최대면 nil.
    private var nextRadius: Int? {
        NearbyViewModel.radiusOptions.first { $0 > viewModel.radius }
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

#Preview {
    NearbyListView()
}
