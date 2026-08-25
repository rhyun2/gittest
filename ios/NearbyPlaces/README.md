# NearbyPlaces — 1단계 최소 동작 앱

현재 위치 주변의 관광지·맛집·카페를 **가까운 순으로** 보여주는 iPhone 앱.
[설계 검토 문서](../../docs/ios-nearby-places-design.md)의 1단계(위치 획득 → 카카오 카테고리 검색 → 거리순 리스트)를 구현한 것이다.

- 최소 지원 버전: **iOS 17.0**
- Xcode 16 이상 / Swift 5 언어 모드
- 서버 없음. 앱에서 카카오 로컬 API를 직접 호출한다.

## 실행 방법

### 1. 카카오 REST API 키 발급

1. [카카오 개발자 콘솔](https://developers.kakao.com) → **내 애플리케이션** → 앱 생성
2. **앱 키** 탭에서 `REST API 키` 복사
3. **제품 설정 → 카카오맵**에서 카카오맵 API를 **활성화** (이걸 빼먹으면 401이 떨어진다)

### 2. 키 넣기

```bash
cd ios/NearbyPlaces
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
# Config/Secrets.xcconfig 를 열어 KAKAO_REST_API_KEY 값을 채운다
```

`Secrets.xcconfig`는 `.gitignore` 대상이라 커밋되지 않는다.
키를 넣지 않고 빌드해도 앱은 정상적으로 실행되며, "API 키 설정이 필요해요" 안내 화면이 뜬다.

### 3. 빌드

`NearbyPlaces.xcodeproj`를 Xcode에서 열고 실행한다.
서명은 타깃의 **Signing & Capabilities**에서 본인 팀을 선택하면 된다.

**시뮬레이터에서 위치 지정**: 실행 후 Xcode 메뉴 `Debug → Simulate Location`, 또는 시뮬레이터의
`Features → Location → Custom Location`에서 좌표를 넣는다. (예: 경복궁 `37.5796`, `126.9770`)
기본값인 Apple 본사 좌표로는 국내 결과가 나오지 않는다.

> 이 `.xcodeproj`는 Xcode 없이 손으로 작성했다. 혹시 열리지 않으면
> Xcode에서 새 iOS App 프로젝트(SwiftUI, iOS 17)를 만들고 `NearbyPlaces/` 폴더를 통째로 끌어다 놓은 뒤,
> 타깃 빌드 설정에서 `INFOPLIST_FILE`을 `Config/Info.plist`로, 프로젝트 base configuration을
> `Config/Base.xcconfig`로 지정하면 동일하게 동작한다.

## 구조

```
Config/
  Base.xcconfig              #include? 로 Secrets.xcconfig를 선택적으로 끌어온다
  Secrets.xcconfig.example   복사해서 Secrets.xcconfig를 만든다
  Info.plist                 $(KAKAO_REST_API_KEY) 주입 · 위치 권한 사유
NearbyPlaces/
  NearbyPlacesApp.swift
  Models/
    Place.swift              화면용 모델 (거리 포맷, 주소 폴백)
    PlaceCategory.swift      AT4 관광명소 / FD6 음식점 / CE7 카페
  Services/
    AppSecrets.swift         Info.plist에서 키 읽기, 없으면 nil
    LocationService.swift    CLLocationUpdate 기반 1회성 위치 획득
    PlacesRepository.swift   프로토콜 + 에러 타입
    KakaoPlacesRepository.swift
  ViewModels/
    NearbyViewModel.swift    상태 관리, 좌표 캐싱
  Views/
    NearbyListView.swift
    PlaceRow.swift
```

## 구현에서 짚어둔 것들

**거리순 정렬을 앱에서 하지 않는다.** 카카오에 `sort=distance`를 넘기면 서버가 정렬해 주고
응답의 `distance` 필드(미터)까지 채워 준다. `Place.distanceMeters`는 그 값을 그대로 쓴다.

**`x`가 경도, `y`가 위도다.** 순서를 뒤집으면 엉뚱한 나라의 결과가 나온다.
`KakaoPlacesRepository.nearby(center:category:radius:)` 한 곳에서만 변환한다.

**첫 유효 좌표를 받으면 스트림을 끊는다.** `CLLocationUpdate`에는 `desiredAccuracy`도
`distanceFilter`도 없어서 `horizontalAccuracy` 검사를 직접 건다. 음수는 좌표 무효를 뜻한다.
실내에서 fix가 영영 안 올 수 있어 15초 타임아웃을 둔다.

**카테고리·반경만 바꿀 때는 위치를 다시 잡지 않는다.** 마지막 좌표를 재사용하고,
새로고침 시에도 200m 미만 이동이면 좌표를 갱신하지 않아 목록 순서가 흔들리지 않는다.

**권한 상태별 폴백**: 거부 시 설정 딥링크가 있는 안내 화면, '정확한 위치' 해제 시 정확도
기준을 5km로 완화하고 상단에 배너를 띄운다.

**API 키가 없어도 크래시하지 않는다.** `AppSecrets.kakaoRestAPIKey`가 `nil`이면
`PlacesError.missingAPIKey`가 올라오고 설정 안내 화면이 뜬다.

## 이번 단계에 없는 것

지도 뷰, 상세 시트와 길찾기 딥링크, 응답 캐싱, TourAPI 이미지 보강은 2단계다.
API 키는 앱 바이너리 안에 있으므로 실사용자 배포 전에는 프록시를 앞에 두어야 한다
([설계 문서 6절](../../docs/ios-nearby-places-design.md#6-백엔드-없이-api-키-다루기)).
그때 바꿀 곳은 `KakaoPlacesRepository.endpoint` 한 줄이다.

## 테스트

`PlacesRepository`가 프로토콜이라 네트워크 없이 뷰모델을 검증할 수 있다.

```swift
struct StubRepository: PlacesRepository {
    let places: [Place]
    func nearby(center: CLLocationCoordinate2D, category: PlaceCategory, radius: Int) async throws -> [Place] {
        places
    }
}
```

이 저장소에는 아직 테스트 타깃이 없다.
