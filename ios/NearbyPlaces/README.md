# NearbyPlaces — 네이티브 iOS 앱

현재 위치 주변에 **등록해 둔 장소**를 가까운 순으로 보여주는 SwiftUI 앱.

웹앱이 만들어 배포한 데이터를 그대로 받아 쓴다.

```
https://rhyun2.github.io/gittest/data/places.json
```

**API 키가 하나도 필요 없다.** 공개된 정적 JSON을 내려받는 것이 전부다. 씨드를 고쳐 웹앱을 재배포하면
앱을 다시 빌드하지 않아도 내용이 바뀐다.

> ⚠️ **이 코드는 아직 한 번도 컴파일된 적이 없다.** Swift 툴체인이 없는 환경에서 작성했다.
> 첫 빌드에서 오류가 나올 수 있고, 그 메시지를 보고 고치면 된다.

---

## 개발환경 구축

### 0. 준비물 확인

| 항목 | 필요 조건 |
|---|---|
| Mac | 필수. Xcode는 macOS에서만 동작한다 |
| macOS | Xcode 26 기준 macOS 15.6 이상 |
| 디스크 | 여유 40GB 이상 권장 (설치 중 임시 공간이 크게 필요하다) |
| Apple ID | **시뮬레이터만 쓴다면 불필요** |
| 비용 | **0원** |

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

## 검증 상태

| 항목 | 상태 |
|---|---|
| JSON 디코딩 계약 (배포 데이터 61건) | ✅ 전부 디코딩 가능하도록 검사 |
| 이미지 URL이 https 인지 (ATS 차단 방지) | ✅ 61건 모두 https |
| `.xcodeproj` 참조 무결성 | ✅ 미정의 참조 0건 |
| **Swift 컴파일** | ❌ **미검증** — 첫 빌드에서 확인된다 |
| 시뮬레이터 실행 | ❌ 미검증 |
