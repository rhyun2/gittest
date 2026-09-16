# NearbyPlaces — 네이티브 iOS 앱

현재 위치 주변에 **등록해 둔 장소**를 가까운 순으로 보여주는 SwiftUI 앱.

웹앱이 만들어 배포한 데이터를 그대로 받아 쓴다.

```
https://rhyun2.github.io/gittest/data/places.json
```

**API 키가 하나도 필요 없다.** 공개된 정적 JSON을 내려받는 것이 전부다. 씨드를 고쳐 웹앱을 재배포하면
앱을 다시 빌드하지 않아도 내용이 바뀐다.

> ⚠️ **이 코드는 Swift 툴체인이 없는 환경에서 작성했다.** 첫 빌드에서 나온 오류는 아래
> [첫 빌드에서 고친 것](#첫-빌드에서-고친-것)에 정리했고, 더 나올 수 있다.

---

## 개발환경 구축

### 0. 준비물 확인

| 항목 | 필요 조건 |
|---|---|
| Mac | 필수. Xcode는 macOS에서만 동작한다 |
| macOS | Xcode 26 기준 macOS 15.6 이상 |
| 디스크 | 여유 40GB 이상 권장 (설치 중 임시 공간이 크게 필요하다) |
| Apple ID | **시뮬레이터만 쓴다면 불필요.** 실기기는 필요하다 → [실제 아이폰에서 실행](#실제-아이폰에서-실행) |
| 비용 | **0원** — 실기기에 설치할 때도 마찬가지다 |

macOS 버전은 좌측 상단  → **이 Mac에 관하여** 에서 확인한다.

### 1. Xcode 설치

**App Store** 를 열어 `Xcode` 검색 → 받기.

- 다운로드가 수 GB, 설치까지 합치면 **30분~1시간** 정도 걸린다. 네트워크가 빠르면 더 짧다
- 설치가 끝나면 **한 번 실행**한다. 첫 실행에서 추가 컴포넌트를 더 받고 라이선스 동의를 요구한다
- iOS 시뮬레이터는 보통 함께 설치된다. 없다면 Xcode → **Settings → Components** 에서 iOS 런타임을 받는다

터미널에서 확인:

```bash
xcodebuild -version
xcrun simctl list devices available | head
```

### 2. 코드 받기

```bash
git clone https://github.com/rhyun2/gittest.git   # 이미 있으면 git pull
cd gittest
```

### 3. 프로젝트 열기

```bash
open ios/NearbyPlaces/NearbyPlaces.xcodeproj
```

> **열리지 않으면** (프로젝트 파일이 손상됐다는 메시지)
> 이 `.xcodeproj` 는 Xcode 없이 손으로 작성한 것이라 그럴 수 있다. 2분이면 새로 만들 수 있다.
>
> 1. Xcode → **File → New → Project** → **iOS → App** → Next
> 2. Product Name `NearbyPlaces`, Interface **SwiftUI**, Language **Swift** → 저장 위치는 아무 곳
> 3. 만들어진 프로젝트에서 기본 생성된 `ContentView.swift` 와 `NearbyPlacesApp.swift` 를 지운다
> 4. Finder에서 `ios/NearbyPlaces/NearbyPlaces/` 폴더를 Xcode 좌측 파일 목록으로 **끌어다 놓는다**
>    (Copy items if needed 체크, Create groups 선택)
> 5. 타깃 설정 → **Info** 탭 → `Privacy - Location When In Use Usage Description` 항목을 추가하고
>    값에 `현재 위치 주변의 관광지와 맛집을 가까운 순으로 찾기 위해 위치 정보를 사용합니다.` 를 넣는다
> 6. **General → Minimum Deployments** 를 **iOS 17.0** 이상으로 맞춘다 (`CLLocationUpdate` 가 17.0부터다)

### 4. 시뮬레이터로 실행

1. Xcode 상단 가운데의 실행 대상에서 **iPhone 시뮬레이터**를 고른다 (예: iPhone 16)
2. **⌘R** 또는 ▶ 버튼

시뮬레이터만 쓸 때는 **서명 설정이 필요 없다.** Signing & Capabilities 는 건드리지 않아도 된다.

첫 빌드는 1~2분 걸린다. 이후에는 훨씬 빠르다.

### 5. 위치를 제주로 지정 ← 빠뜨리면 계속 0건

시뮬레이터의 기본 위치는 미국(Apple 본사)이라 그대로 두면 **등록된 곳이 없다**고 나온다.

시뮬레이터 창을 선택한 뒤 메뉴에서:

**Features → Location → Custom Location…**

| 항목 | 값 |
|---|---|
| Latitude | `33.4580` |
| Longitude | `126.9427` |

성산일출봉 부근이다. 입력 후 앱에서 **↻ 새로고침**을 누른다.

> 위치 권한 팝업이 뜨면 **"앱을 사용하는 동안 허용"** 을 누른다.

### 6. 확인할 것

- 목록이 **거리순**으로 뜨는지
- **사진**이 붙는지 (61곳 중 34곳에 사진이 있다. 없는 곳은 회색 자리로 남는다)
- 항목을 누르면 **카카오맵 장소 페이지**가 Safari로 열리는지
- **관광지 / 맛집 / 카페** 탭을 바꿔도 위치 권한을 다시 묻지 않는지
- **반경**을 500m ↔ 5km 로 바꾸면 개수가 달라지는지

---

## 실제 아이폰에서 실행

**돈은 들지 않는다.** 유료 Apple Developer Program($99/년)은 App Store·TestFlight 배포에 필요한 것이고,
내 아이폰에 직접 설치해 쓰는 것은 **무료 Apple ID** 로 된다. 이것을 무료 프로비저닝(Personal Team)이라 한다.

| 준비물 | 비고 |
|---|---|
| Apple ID | 평소 쓰는 것. 가입비 없음 |
| USB 케이블 | 첫 연결만 유선. 이후 무선 가능 |
| 아이폰 iOS 버전 | 설치된 Xcode 가 지원하는 범위 안이어야 한다 |

### 1. Xcode 에 Apple ID 등록

```
Xcode → Settings (⌘,) → Accounts → 왼쪽 아래 [+] → Apple ID
```

로그인하면 목록에 `본인이름 (Personal Team)` 이 생긴다. 이것이 무료 팀이다.

### 2. Bundle Identifier 바꾸기 ← 빠뜨리기 쉽다

이 프로젝트의 기본값은 `com.example.NearbyPlaces` 다. `com.example` 은 예시용이라 **다른 사람이 이미
등록했을 가능성이 높고**, 그러면 서명이 실패한다. Bundle ID 는 전 세계에서 유일해야 한다.

```
프로젝트 파일 클릭 → TARGETS: NearbyPlaces → Signing & Capabilities
→ Bundle Identifier 를 고유한 값으로 (예: com.rhyun.NearbyPlaces)
```

도메인을 실제로 소유할 필요는 없다. 겹치지만 않으면 된다.

### 3. 서명 설정

같은 **Signing & Capabilities** 탭에서:

- ☑️ **Automatically manage signing**
- **Team** → `본인이름 (Personal Team)`

빨간 오류가 사라지면 된 것이다. 시뮬레이터는 서명이 필요 없었지만 실기기는 반드시 필요하다.

### 4. 아이폰 연결과 개발자 모드

케이블로 연결하고 아이폰에서 **"이 컴퓨터를 신뢰하시겠습니까?"** → 신뢰.

iOS 16 이상이면 개발자 모드를 켜야 한다.

```
아이폰 설정 → 개인정보 보호 및 보안 → 개발자 모드 → 켬 → 재시동
```

> 이 항목은 **Xcode 에 기기를 한 번 연결한 뒤에야 나타난다.** 처음부터 찾으면 없다.

### 5. 실행과 "신뢰하지 않는 개발자"

실행 대상에서 시뮬레이터 대신 **연결된 아이폰**을 고르고 **⌘R**.

첫 실행은 여기서 한 번 막힌다 — 앱은 설치됐는데 실행이 안 되는 상태다.

```
아이폰 설정 → 일반 → VPN 및 기기 관리 → 본인 Apple ID → 신뢰
```

그 후 홈 화면에서 앱을 누르거나 Xcode 에서 다시 ⌘R.

### 무료 계정의 제약

| 제약 | 내용 |
|---|---|
| **7일 만료** | 일주일 뒤 앱이 실행되지 않는다. Mac 에 연결해 ⌘R 하면 7일 연장 |
| 동시 설치 3개 | 무료 서명으로 설치한 앱은 기기당 3개까지 |
| 7일에 App ID 10개 | Bundle ID 를 자꾸 바꾸면 한도에 걸린다 |
| 일부 기능 불가 | 푸시 알림, App Groups, CloudKit, Sign in with Apple 등 |

**7일 만료가 가장 걸린다.** 계속 쓰려면 주마다 한 번 Mac 에 연결해 다시 빌드해야 한다.
그게 번거로워지는 시점이 유료 프로그램(1년 유효)을 고려할 때다.

이 앱이 쓰는 **위치 권한과 네트워크는 무료 계정에서 아무 제약이 없다.**

### 무선 디버깅

첫 유선 연결 이후로는 케이블이 필요 없다.

```
Xcode → Window → Devices and Simulators → 기기 선택 → ☑️ Connect via network
```

같은 Wi-Fi 에 있으면 실행 대상 목록에 계속 뜬다.

### 실기기에서는 위치를 바꿀 수 없다

시뮬레이터와 달리 좌표를 임의로 지정할 수 없다. 등록된 61곳이 전부 제주라서 **제주 밖에서는 계속 0건**이다.

실기기에서 의미 있게 확인하려면 `data/seeds/jeju.txt` 에 현재 지역 장소를 몇 개 추가하고
수집 스크립트를 다시 돌려 배포한다. 앱은 재빌드하지 않아도 된다 — 배포된 `places.json` 을 받아 쓰기 때문이다.

---

## 구조

```
ios/NearbyPlaces/
├── Config/Info.plist              위치 권한 사유
├── NearbyPlaces.xcodeproj
└── NearbyPlaces/
    ├── NearbyPlacesApp.swift
    ├── Models/
    │   ├── Place.swift            화면용 모델 (거리 포맷, 한줄평 우선)
    │   └── PlaceCategory.swift    AT4 관광지 / FD6 맛집 / CE7 카페
    ├── Services/
    │   ├── LocationService.swift          CLLocationUpdate 기반 1회성 위치 획득
    │   ├── PlacesRepository.swift         프로토콜 + 에러 타입
    │   └── CuratedPlacesRepository.swift  places.json 내려받기 · 거리 계산 · 정렬
    ├── ViewModels/NearbyViewModel.swift
    └── Views/{NearbyListView,PlaceRow}.swift
```

## 웹앱과 무엇이 같고 다른가

| | 웹앱 | 이 앱 |
|---|---|---|
| 큐레이션 장소 | ✅ | ✅ 같은 데이터 |
| 카카오 실시간 검색 | ✅ | ❌ **없다** |
| 필요한 키 | 카카오 JavaScript 키 | **없음** |

**이 앱은 등록된 장소만 보여준다.** 제주 밖에서는 반경을 넓혀도 계속 0건이다. 웹앱은 그럴 때
카카오 실시간 검색으로 넘어가지만, 이 앱은 그렇게 하지 않는다. 카카오 REST 키를 앱에 넣어야 하고
그 키는 도메인 제한이 안 걸려 노출되면 막을 방법이 없기 때문이다.

## 알아둘 점

**거리 계산·정렬을 앱이 한다.** 카카오 REST는 서버가 `distance` 를 계산해 정렬까지 해 줬지만
큐레이션 데이터에는 좌표뿐이다. `CLLocation.distance(from:)` 으로 직접 구한다.
웹앱 `web/js/curated.js` 와 같은 구조다.

**위치는 첫 유효 좌표를 받으면 스트림을 끊는다.** 실시간 추적이 아니므로 계속 구독하면 배터리를
쓰고 상태 표시줄에 파란 바가 남는다. `CLLocationUpdate` 에는 `desiredAccuracy` 도 `distanceFilter`
도 없어서 정확도 검사를 직접 건다.

**카테고리·반경을 바꿔도 위치를 다시 잡지 않는다.** 저장된 좌표를 재사용하고, 새로고침 시에도
200m 미만 이동이면 좌표를 갱신하지 않아 목록 순서가 흔들리지 않는다.

**장소 목록은 앱이 살아 있는 동안 한 번만 내려받는다.** 당겨서 새로고침은 위치를 다시 잡는 것이지
데이터를 다시 받는 것이 아니다. 데이터를 갱신하려면 앱을 재실행한다.

## 첫 빌드에서 고친 것

### 기본 인자에서 `@MainActor` 타입을 만들 수 없다

```
Call to main actor-isolated initializer 'init()' in a synchronous nonisolated context
```

`NearbyViewModel` 과 `NearbyListView` 두 곳에서 같은 이유로 났다.

```swift
// ❌ 기본 인자 식은 호출부에서, 즉 @MainActor 격리 밖에서 평가된다
init(locationService: LocationService = LocationService()) { … }

// ✅ 기본값은 nil, 실제 객체는 격리된 본문에서 만든다
init(locationService: LocationService? = nil) {
    self.locationService = locationService ?? LocationService()
}
```

기본 인자는 함수 안이 아니라 **부르는 쪽에서** 계산된다. 그래서 타입이 `@MainActor` 여도
그 기본값 식은 격리를 물려받지 못한다. 주입 지점(테스트·프리뷰용)은 그대로 남기고 싶었으므로
기본값만 `nil` 로 미뤘다.

`NearbyListView` 는 여기에 더해 **init 자체에 `@MainActor` 를 붙여야** 했다. `View` 는 구조체이고
`body` 만 `@MainActor` 라, init 본문은 격리되지 않은 상태이기 때문이다.

### `CLLocationUpdate` 의 권한 속성은 iOS 18부터다

```
'authorizationDenied' is only available in iOS 18.0 or newer
```

`CLLocationUpdate` 자체는 iOS 17.0부터지만 `authorizationDenied` · `authorizationDeniedGlobally` ·
`authorizationRestricted` 세 속성은 **iOS 18에 추가**됐다. 이 앱의 배포 타깃은 iOS 17.0이다.

타깃을 18로 올리는 대신, 예전부터 있던 `CLLocationManager.authorizationStatus` 로 같은 값을 읽도록
바꿨다. 다만 통로가 달라서 한 가지를 더 해야 했다 — 권한이 거부되면 `liveUpdates()` 는 **아무것도
내놓지 않고 조용히 멈춘다.** 스트림 안에서 상태를 볼 기회조차 없다는 뜻이다.

그래서 `waitForRefusal()` 을 작업 그룹에 한 갈래 더 넣었다. 300ms마다 권한 상태만 확인하다가
거부가 잡히면 사유를 던진다. 이게 없으면 권한을 껐을 때 "권한이 꺼져 있습니다" 대신 15초 뒤
타임아웃 안내가 떠서, 사용자가 무엇을 고쳐야 하는지 알 수 없다.

```
작업 그룹 ─┬─ firstUsableCoordinate()  좌표를 기다린다
           ├─ waitForRefusal()         권한 거부를 감시한다   ← 추가
           └─ Task.sleep(timeout)      15초 상한
           가장 먼저 끝난 갈래가 결과가 된다
```

## 검증 상태

| 항목 | 상태 |
|---|---|
| JSON 디코딩 계약 (배포 데이터 61건) | ✅ 전부 디코딩 가능하도록 검사 |
| 이미지 URL이 https 인지 (ATS 차단 방지) | ✅ 61건 모두 https |
| `.xcodeproj` 참조 무결성 | ✅ 미정의 참조 0건 |
| **Swift 컴파일** | ⚠️ 진행 중 — 첫 빌드의 동시성 격리 오류 2건을 고쳤다 |
| 시뮬레이터 실행 | ❌ 미검증 |
