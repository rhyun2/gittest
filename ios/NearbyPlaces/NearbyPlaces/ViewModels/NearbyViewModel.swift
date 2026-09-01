import CoreLocation
import Observation

@MainActor
@Observable
final class NearbyViewModel {
    enum Failure: Equatable {
        case permissionDenied
        case message(String)
    }

    enum ViewState {
        case idle
        case loading
        case loaded([Place])
        case empty
        case failed(Failure)
    }

    /// 반경 선택지(미터).
    static let radiusOptions = [500, 1_000, 3_000, 5_000]

    var category: PlaceCategory = .attraction
    var radius = 1_000

    private(set) var state: ViewState = .idle
    private(set) var isReducedAccuracy = false

    private let locationService: LocationService
    private let repository: PlacesRepository

    /// 마지막으로 검색한 좌표. 카테고리·반경만 바꿀 때는 위치를 다시 잡지 않고 재사용한다.
    private var lastCoordinate: CLLocationCoordinate2D?
    private var searchTask: Task<Void, Never>?

    init(
        locationService: LocationService = LocationService(),
        repository: PlacesRepository = CuratedPlacesRepository()
    ) {
        self.locationService = locationService
        self.repository = repository
    }

    /// 첫 진입 시 한 번만 실행한다.
    func onAppear() {
        guard case .idle = state else { return }
        refresh()
    }

    /// 새 위치를 잡아 다시 검색한다.
    func refresh() {
        run(refreshingLocation: true)
    }

    /// 당겨서 새로고침용. 검색이 끝날 때까지 기다려야 스피너가 제때 사라진다.
    func refreshAndWait() async {
        run(refreshingLocation: true)
        await searchTask?.value
    }

    /// 카테고리나 반경만 바뀐 경우. 이미 잡아둔 좌표를 재사용한다.
    func reload() {
        run(refreshingLocation: false)
    }

    private func run(refreshingLocation: Bool) {
        searchTask?.cancel()
        searchTask = Task { [weak self] in
            await self?.search(refreshingLocation: refreshingLocation)
        }
    }

    private func search(refreshingLocation: Bool) async {
        state = .loading

        do {
            let coordinate = try await resolveCoordinate(forceRefresh: refreshingLocation)
            isReducedAccuracy = locationService.isReducedAccuracy

            let places = try await repository.nearby(
                center: coordinate,
                category: category,
                radius: radius
            )
            guard !Task.isCancelled else { return }
            state = places.isEmpty ? .empty : .loaded(places)
        } catch is CancellationError {
            return
        } catch let error as LocationService.LocationError {
            switch error {
            case .denied, .restricted:
                state = .failed(.permissionDenied)
            case .unavailable, .timedOut:
                state = .failed(.message(error.localizedDescription))
            }
        } catch let error as PlacesError {
            state = .failed(.message(error.localizedDescription))
        } catch {
            state = .failed(.message("네트워크 연결을 확인해 주세요."))
        }
    }

    private func resolveCoordinate(forceRefresh: Bool) async throws -> CLLocationCoordinate2D {
        if !forceRefresh, let cached = lastCoordinate {
            return cached
        }

        let fresh = try await locationService.currentCoordinate()
        // 200m도 안 움직였으면 좌표를 갱신하지 않는다. 위치가 미세하게 흔들릴 때마다
        // 목록 순서가 바뀌는 것을 막고, 캐시가 붙을 여지를 남긴다.
        if let cached = lastCoordinate, cached.distance(to: fresh) < 200 {
            return cached
        }
        lastCoordinate = fresh
        return fresh
    }

    /// 반경 표시용 라벨.
    func label(forRadius meters: Int) -> String {
        meters < 1_000 ? "\(meters)m" : "\(meters / 1_000)km"
    }
}
