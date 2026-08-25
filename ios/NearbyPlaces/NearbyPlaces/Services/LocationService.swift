import CoreLocation
import Observation

/// 현재 위치를 1회성으로 얻는다.
///
/// 실시간 추적이 아니므로 쓸 만한 첫 좌표를 받으면 곧바로 스트림을 끊는다.
/// 계속 구독하면 배터리를 쓰고 상태 표시줄에 파란 바가 남아, 사용자에게
/// 앱이 자기를 계속 따라다닌다는 인상을 준다.
@MainActor
@Observable
final class LocationService {
    enum LocationError: LocalizedError {
        case denied
        case restricted
        case unavailable
        case timedOut

        var errorDescription: String? {
            switch self {
            case .denied:
                "위치 권한이 꺼져 있습니다."
            case .restricted:
                "이 기기에서는 위치 서비스를 사용할 수 없습니다."
            case .unavailable:
                "현재 위치를 확인할 수 없습니다."
            case .timedOut:
                "위치를 확인하는 데 시간이 너무 오래 걸립니다. 실외에서 다시 시도해 주세요."
            }
        }
    }

    /// 사용자가 '정확한 위치'를 꺼 둔 경우 true. 이때는 좌표가 수 킬로미터 단위로 뭉개진다.
    private(set) var isReducedAccuracy = false

    @ObservationIgnored private let manager = CLLocationManager()

    var authorizationStatus: CLAuthorizationStatus {
        manager.authorizationStatus
    }

    /// 아직 물어본 적 없을 때만 권한을 요청한다.
    /// 백그라운드 위치를 쓰지 않으므로 `Always`는 절대 요청하지 않는다.
    func requestAuthorizationIfNeeded() {
        guard manager.authorizationStatus == .notDetermined else { return }
        manager.requestWhenInUseAuthorization()
    }

    /// 쓸 만한 정확도의 좌표 하나를 받아 돌려준다.
    func currentCoordinate(timeout: Duration = .seconds(15)) async throws -> CLLocationCoordinate2D {
        requestAuthorizationIfNeeded()

        return try await withThrowingTaskGroup(of: CLLocationCoordinate2D.self) { group in
            group.addTask { @MainActor in
                try await self.firstUsableCoordinate()
            }
            group.addTask {
                // 실내에서는 유효한 fix가 영영 안 올 수 있어 상한을 둔다.
                try await Task.sleep(for: timeout)
                throw LocationError.timedOut
            }

            guard let coordinate = try await group.next() else {
                throw LocationError.unavailable
            }
            group.cancelAll()
            return coordinate
        }
    }

    private func firstUsableCoordinate() async throws -> CLLocationCoordinate2D {
        for try await update in CLLocationUpdate.liveUpdates() {
            if update.authorizationDenied || update.authorizationDeniedGlobally {
                throw LocationError.denied
            }
            if update.authorizationRestricted {
                throw LocationError.restricted
            }

            isReducedAccuracy = manager.accuracyAuthorization == .reducedAccuracy

            guard let location = update.location else { continue }
            // horizontalAccuracy가 음수면 좌표가 무효라는 뜻이다.
            guard location.horizontalAccuracy > 0 else { continue }

            // CLLocationUpdate에는 desiredAccuracy도 distanceFilter도 없어서
            // 정확도 기준은 여기서 직접 건다.
            // 정확한 위치를 끈 경우엔 100m 기준을 영원히 못 넘기므로 완화한다.
            let threshold: CLLocationAccuracy = isReducedAccuracy ? 5_000 : 100
            guard location.horizontalAccuracy < threshold else { continue }

            // return과 함께 for 루프를 벗어나면서 스트림 구독이 해제된다.
            return location.coordinate
        }
        throw LocationError.unavailable
    }
}

extension CLLocationCoordinate2D {
    /// 두 좌표 사이의 직선거리(미터).
    func distance(to other: CLLocationCoordinate2D) -> CLLocationDistance {
        CLLocation(latitude: latitude, longitude: longitude)
            .distance(from: CLLocation(latitude: other.latitude, longitude: other.longitude))
    }
}
