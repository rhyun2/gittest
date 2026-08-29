# 아이폰 주변 관광지·맛집 앱 — 설계 검토

현재 위치를 받아 인근 관광지와 맛집을 **가까운 순서대로** 보여주는 iOS 앱의 구현 방법을 검토한 문서다.

> 이 문서의 코드는 모두 **설계 설명용 예시**다. Xcode 빌드나 실제 API 호출로 검증하지 않았다.

**전제**
- 서비스 지역: 한국 중심
- 개발 방식: SwiftUI 네이티브 (iPhone 전용)
- 백엔드: 없음 — 개발 난이도를 낮추기 위해 앱에서 API를 직접 호출

---

## 1. 결론

**SwiftUI + CoreLocation + MapKit(지도 렌더링) + 카카오 로컬 API(POI 데이터)** 조합을 권장한다. 서버 컴포넌트는 두지 않는다.

핵심 근거는 하나다. 카카오 로컬 API의 카테고리 검색은 `sort=distance`와 `radius`를 지원하고, **응답에 `distance` 필드(미터 단위)를 담아 이미 거리순으로 정렬해서 돌려준다.** 즉 "가까운 순서대로 표시"라는 이 앱의 핵심 요구사항이 클라이언트 거리 계산·정렬 로직 없이 API 호출 한 번으로 끝난다. 백엔드가 없어도 앱만으로 기능이 완결된다.

```
현재 좌표 (CoreLocation)
      ↓
GET category.json?category_group_code=FD6&x=경도&y=위도&radius=1000&sort=distance
      ↓
[{ place_name: "...", distance: "231", ... },  ← 이미 거리순 정렬됨
 { place_name: "...", distance: "418", ... }]
      ↓
그대로 리스트에 렌더링
```

---

## 2. 데이터 소스 비교

| 소스 | 국내 커버리지 | 거리순 정렬 | 비용 | 판정 |
|---|---|---|---|---|
| **카카오 로컬 API** | 맛집·관광지 모두 최상 | `sort=distance` 네이티브 지원, `distance` 반환 | 일 10만 / 월 300만 건 무료 | **채택** |
| 한국관광공사 TourAPI | 관광지 공식 데이터·대표이미지·개요 보유. 맛집은 얕음 | `arrange=E`(거리순), `dist` 반환 | 공공데이터포털 키, 무료 | **선택적 보조** (이미지·설명 보강) |
| Apple MapKit `MKLocalSearch` | 국내 POI가 얕고 카테고리 정보가 빈약 | 미지원 — 직접 계산·정렬 | 무료, 키 불필요 | 지도 렌더링에만 사용 |
| Google Places API (New) | 국내 커버리지 편차가 큼 | `rankPreference=DISTANCE` | 월 5,000건 무료, 이후 $32 / 1,000건 | 비용 문제로 탈락 |

### 왜 MapKit `MKLocalSearch`만으로는 부족한가

MapKit은 키도 필요 없고 비용도 없어서 가장 간단해 보이지만, 두 가지가 걸린다.

1. **국내 POI 커버리지.** 애플 지도의 한국 장소 데이터는 카카오·네이버 대비 누락이 많고, 특히 음식점 카테고리 분류와 상세 정보가 얕다. "인근 맛집"이 핵심 기능인 앱에서는 치명적이다.
2. **거리순 정렬 미지원.** `MKLocalSearch`는 관련도 기준으로 반환하므로 결과를 받아 직접 `CLLocation.distance(from:)`으로 계산해 정렬해야 한다. 반경 필터링도 직접 해야 한다.

다만 **지도를 그리는 용도로는 MapKit이 최선**이다. 별도 SDK 의존성 없이 SwiftUI `Map` 뷰로 바로 쓸 수 있고, 카카오와 동일한 WGS84 좌표계라 카카오가 준 좌표를 좌표 변환 없이 그대로 핀으로 찍을 수 있다. **데이터는 카카오, 렌더링은 MapKit**으로 역할을 나누는 것이 이 설계의 요점이다.

### 왜 Google Places가 아닌가

Nearby Search (New)는 `rankPreference: DISTANCE`와 `includedTypes: ["restaurant", "tourist_attraction"]`을 지원해 기능적으로는 요구사항을 만족한다. 문제는 비용이다. 2026년 기준 무료 한도가 SKU별로 분리되면서 Nearby Search는 **월 5,000건까지만 무료이고 이후 1,000건당 $32**다. 사용자 한 명이 하루에 열 번 검색하면 월 5,000건은 사용자 17명 규모에서 소진된다. 카카오의 일 10만 건과는 비교가 안 된다.

---

## 3. 아키텍처

서버 없이 앱 단독으로 동작한다.

```
SwiftUI App
 │
 ├─ LocationService         CoreLocation으로 현재 좌표 획득
 │
 ├─ PlacesRepository        프로토콜 (데이터 소스 추상화)
 │   └─ KakaoPlacesRepository ──(HTTPS)──► dapi.kakao.com
 │        └─ NearbyCache      좌표 반올림 캐시 키 + TTL
 │
 ├─ NearbyViewModel         @Observable, 화면 상태 관리
 │
 └─ Views                   리스트 · 지도 · 상세 시트
                            MapKit으로 지도 표시 (좌표 변환 불필요)
```

`PlacesRepository`를 프로토콜로 두는 이유는 두 가지다. 나중에 데이터 소스를 바꾸거나(예: 해외 대응 시 MapKit 구현체 추가), 프록시 서버를 앞에 붙일 때 이 구현체 하나만 교체하면 나머지 코드가 그대로 살아남는다.

```swift
protocol PlacesRepository {
    func nearby(center: CLLocationCoordinate2D,
                category: PlaceCategory,
                radius: Int) async throws -> [Place]
}

struct Place: Identifiable, Hashable {
    let id: String
    let name: String
    let category: String        // "음식점 > 한식 > 육류,고기"
    let roadAddress: String
    let phone: String?
    let coordinate: CLLocationCoordinate2D
    let distanceMeters: Int     // 카카오가 계산해 준 값
    let placeURL: URL           // 카카오맵 상세 페이지
}
```

---

## 4. 위치 획득

iOS 17+를 타깃으로 잡고 `CLLocationUpdate.liveUpdates()`를 쓴다. 기존 `CLLocationManager` delegate 방식보다 훨씬 간결하다.

```swift
@Observable
final class LocationService {
    private(set) var coordinate: CLLocationCoordinate2D?

    /// 쓸 만한 정확도의 첫 위치를 받으면 스트림을 끊는다.
    func requestOnce() async throws {
        for try await update in CLLocationUpdate.liveUpdates() {
            guard let location = update.location else { continue }
            // 음수는 좌표 무효를 의미하므로 반드시 검사한다
            guard location.horizontalAccuracy > 0,
                  location.horizontalAccuracy < 100 else { continue }
            coordinate = location.coordinate
            return   // 1회성 조회이므로 여기서 종료
        }
    }
}
```

### 설계 시 주의할 점

**`CLLocationUpdate`에는 `distanceFilter`와 `desiredAccuracy`가 없다.** 구형 `CLLocationManager`에 있던 이 옵션들이 신 API에는 존재하지 않으므로, 정확도 검사와 이동 거리 필터링을 **스트림에서 직접** 해야 한다. 위 코드의 `horizontalAccuracy` 검사가 그 역할이다.

**첫 유효 fix를 받으면 반드시 스트림을 끊는다.** 이 앱은 실시간 추적이 아니라 1회성 조회다. 계속 구독하면 배터리를 소모하고 상태 표시줄에 파란 바가 계속 떠서 사용자에게 "이 앱이 나를 계속 추적한다"는 인상을 준다.

**재검색은 200m 이상 이동했을 때만.** 위치가 조금 흔들릴 때마다 API를 다시 호출하면 쿼터만 낭비된다.

```swift
func shouldResearch(from last: CLLocationCoordinate2D,
                    to current: CLLocationCoordinate2D) -> Bool {
    let a = CLLocation(latitude: last.latitude, longitude: last.longitude)
    let b = CLLocation(latitude: current.latitude, longitude: current.longitude)
    return a.distance(from: b) > 200
}
```

### 권한 폴백 두 가지

**정확한 위치를 거부한 경우** (`accuracyAuthorization == .reducedAccuracy`): 위치가 수 킬로미터 단위로 뭉개져 오므로 "가장 가까운 곳" 자체가 무의미해진다. 검색 반경을 넓히고, "정확한 위치를 켜면 더 가까운 곳을 찾을 수 있어요" 안내와 함께 `UIApplication.openSettingsURLString` 딥링크를 제공한다.

**위치 권한을 아예 거부한 경우**: 지역을 직접 선택하는 화면으로 폴백한다. 이건 UX 배려가 아니라 **앱스토어 심사 요건**이다. 위치 권한 없이 앱이 아무것도 못 하고 멈추면 리젝 사유가 된다.

---

## 5. 카카오 로컬 API 사용법

### 엔드포인트

```
GET https://dapi.kakao.com/v2/local/search/category.json
Authorization: KakaoAK {REST_API_KEY}
```

### 파라미터

| 파라미터 | 값 | 비고 |
|---|---|---|
| `category_group_code` | `AT4` 관광명소 / `FD6` 음식점 / `CE7` 카페 | 필수 |
| `x` | **경도** (longitude) | 아래 함정 참고 |
| `y` | **위도** (latitude) | |
| `radius` | 0 ~ 20000 (미터) | 상한 20km |
| `sort` | `distance` | 기본값은 `accuracy`이므로 반드시 명시 |
| `size` | 1 ~ 15 | 페이지당 개수, 최대 15 |
| `page` | 1 ~ 45 | |

주요 카테고리 그룹 코드: `AT4`(관광명소), `FD6`(음식점), `CE7`(카페), `CT1`(문화시설), `AD5`(숙박), `MT1`(대형마트), `CS2`(편의점), `PK6`(주차장), `SW8`(지하철역), `BK9`(은행), `HP8`(병원), `PM9`(약국).

### 응답

```json
{
  "documents": [
    {
      "place_name": "○○식당",
      "category_name": "음식점 > 한식 > 육류,고기",
      "category_group_code": "FD6",
      "phone": "02-000-0000",
      "address_name": "서울 중구 ...",
      "road_address_name": "서울 중구 세종대로 ...",
      "x": "126.9779692",
      "y": "37.566535",
      "place_url": "http://place.map.kakao.com/12345678",
      "distance": "231"
    }
  ],
  "meta": { "total_count": 87, "pageable_count": 45, "is_end": false }
}
```

`distance`는 `x`, `y`를 넘겼을 때만 채워진다. 단위는 미터, 타입은 문자열이므로 `Int(doc.distance)` 변환이 필요하다.

### 반드시 짚고 갈 함정

**`x`가 경도, `y`가 위도다.** 수학 좌표계 관례를 따른 것이라 `CLLocationCoordinate2D(latitude:longitude:)`에 익숙한 상태에서 순서를 뒤집어 넣는 실수가 매우 흔하다. 결과가 엉뚱한 나라로 나오면 십중팔구 이것이다. TourAPI도 마찬가지로 `mapX`가 경도, `mapY`가 위도다. 변환 지점을 한 군데로 모아두면 안전하다.

```swift
extension CLLocationCoordinate2D {
    var kakaoX: String { String(longitude) }   // 경도
    var kakaoY: String { String(latitude) }    // 위도
}
```

**`distance`는 직선거리다.** 실제 걸어가는 거리가 아니다. "도보 약 3분" 같은 표기를 하려면 대략 80m/분으로 환산하되, 강이나 철길을 사이에 둔 경우 실제와 크게 차이날 수 있다. UI에서는 "직선거리 231m" 또는 아이콘으로 직선거리임을 암시하는 편이 오해가 적다. 실제 도보 경로 거리가 필요하면 별도의 길찾기 API를 붙여야 하는데, 국내 도보 경로 API는 무료 제공이 제한적이라 MVP 범위에서는 권하지 않는다.

**`radius` 상한이 20km다.** 시골 지역에서 반경 내 결과가 0건일 수 있으므로, 결과가 비면 반경을 자동으로 넓혀 재시도하는 로직(1km → 5km → 20km)을 넣으면 체감이 좋아진다.

### 관광지·맛집 동시 조회

카테고리 코드는 요청당 하나만 넘길 수 있으므로 두 카테고리를 함께 보여주려면 병렬 호출한다.

```swift
async let attractions = repo.nearby(center: coord, category: .attraction, radius: radius)
async let restaurants = repo.nearby(center: coord, category: .restaurant, radius: radius)
let merged = try await (attractions + restaurants).sorted { $0.distanceMeters < $1.distanceMeters }
```

---

## 6. 백엔드 없이 API 키 다루기

프록시 서버를 두지 않기로 했으므로, REST 키가 앱 바이너리 안에 존재한다. 결심한 트레이드오프를 명확히 하고 할 수 있는 완화책을 쓴다.

**리스크의 실체**: 앱 바이너리에서 문자열을 추출하거나 네트워크를 프록시로 가로채면 키를 얻을 수 있다. 카카오 REST 키는 IP 화이트리스트 외에는 제한 수단이 없는데, 모바일은 IP가 유동적이라 이걸 쓸 수 없다. 즉 **완전한 방어는 불가능하고, 프록시 없이는 이게 한계다.**

**그래도 반드시 해야 할 것 — 소스·깃 유출 차단**

키를 코드에 하드코딩하면 저장소에 그대로 커밋되고, 깃 히스토리에 한 번 들어간 키는 지우기 번거롭다. `.xcconfig`로 분리한다.

```
// Secrets.xcconfig  ← .gitignore 대상
KAKAO_REST_API_KEY = 여기에실제키
```

```xml
<!-- Info.plist -->
<key>KakaoRestAPIKey</key>
<string>$(KAKAO_REST_API_KEY)</string>
```

```swift
enum AppSecrets {
    static var kakaoRestAPIKey: String {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "KakaoRestAPIKey") as? String,
              !key.isEmpty else {
            fatalError("Secrets.xcconfig에 KAKAO_REST_API_KEY를 설정하세요")
        }
        return key
    }
}
```

저장소에는 `Secrets.xcconfig.example`만 커밋하고 `.gitignore`에 `Secrets.xcconfig`를 넣는다.

**호출량을 줄여 피해 규모를 줄이기**

좌표를 소수점 3자리(약 110m)로 반올림한 값을 캐시 키로 삼아 5~10분 TTL로 캐싱한다. 같은 자리에서 화면을 껐다 켜거나 카테고리를 오갈 때 재호출이 나가지 않는다.

```swift
func cacheKey(_ c: CLLocationCoordinate2D, _ category: PlaceCategory, _ radius: Int) -> String {
    let lat = (c.latitude * 1000).rounded() / 1000
    let lng = (c.longitude * 1000).rounded() / 1000
    return "\(lat),\(lng),\(category.rawValue),\(radius)"
}
```

반경 슬라이더는 300~500ms 디바운스를 걸어 드래그 중간값마다 요청이 나가지 않게 한다.

**사고 대응 준비**: 카카오 개발자 콘솔에서 사용량을 주기적으로 확인하고, 이상 급증이 보이면 키를 재발급한다. 일 10만 건 쿼터라 개인·학습용 규모에서 실질 리스크는 낮다.

**프록시가 필요해지는 시점**: 앱스토어 정식 배포 후 실사용자가 붙거나, 쿼터가 소진되거나 이상 트래픽이 관측될 때. 그때 `KakaoPlacesRepository`의 `baseURL`만 프록시 주소로 바꾸면 되도록 지금부터 URL을 상수 한 곳에 모아둔다. Cloudflare Workers 기준 30줄 남짓이면 되고, 그 단계에서 응답 캐싱까지 서버로 옮길 수 있다.

---

## 7. 화면 구성

```
┌─────────────────────────────┐
│  [관광지] [맛집] [카페]      │  세그먼트
│  반경: ●───── 1km            │  500m · 1km · 3km · 5km
├─────────────────────────────┤
│  ○○식당              231m    │
│  음식점 > 한식               │
│  서울 중구 세종대로 ...       │
├─────────────────────────────┤
│  △△카페              418m    │
│  ...                        │
└─────────────────────────────┘
        [ 리스트 ⇄ 지도 ]
```

거리 배지는 1km 미만이면 `231m`, 이상이면 `1.2km`로 포맷한다. 셀을 탭하면 상세 시트가 올라오고, 거기서 길찾기와 카카오맵 상세 페이지로 연결한다.

```swift
// 카카오맵 앱이 설치돼 있으면 카카오맵, 없으면 애플 지도
let kakao = URL(string: "kakaomap://route?ep=\(lat),\(lng)&by=FOOT")!
let apple = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)&dirflg=w")!
UIApplication.shared.open(UIApplication.shared.canOpenURL(kakao) ? kakao : apple)
```

`kakaomap://` 스킴을 쓰려면 `Info.plist`의 `LSApplicationQueriesSchemes`에 등록해야 `canOpenURL`이 정상 동작한다.

지도 뷰는 SwiftUI `Map`에 `Annotation`으로 핀을 찍는다. 카카오 좌표가 WGS84라 변환 없이 그대로 들어간다.

---

## 8. 개인정보·앱스토어 심사 체크리스트

- `NSLocationWhenInUseUsageDescription`에 구체적인 한국어 사유를 쓴다. "위치 정보가 필요합니다" 같은 무성의한 문구는 리젝 사유다. → "현재 위치 주변의 관광지와 맛집을 가까운 순으로 찾기 위해 위치 정보를 사용합니다."
- **"항상 허용"(`Always`) 권한은 요청하지 않는다.** 백그라운드 위치를 쓰지 않으므로 `WhenInUse`면 충분하고, 불필요한 권한 요청은 심사에서 문제가 된다.
- 위치 권한 없이도 앱의 기본 화면이 동작해야 한다(5절의 수동 지역 선택 폴백).
- 자체 서버가 없으므로 좌표를 수집·보관하지 않는다. App Privacy 신고는 **"위치 — 앱 기능 목적, 사용자 신원과 연결되지 않음"**.
- 카카오 API 이용약관상 출처 표기 요건을 확인하고, 필요하면 정보 화면에 "장소 정보 제공: 카카오"를 표기한다.

---

## 9. 로드맵

**1단계 — 최소 동작 앱**
위치 획득 → 카카오 카테고리 검색 → 거리순 리스트. 여기까지가 요구사항의 핵심이고, 이것만으로 앱이 성립한다.

**2단계 — 완성도**
지도 뷰, 상세 시트와 길찾기 딥링크, 캐시·디바운스, 반경 자동 확장. 관광지에 사진을 붙이고 싶으면 TourAPI `KorService2/locationBasedList2`(`contentTypeId=12` 관광지)를 좌표+상호명 근사 매칭으로 보강한다. 카카오 응답에는 이미지가 없기 때문이다.

**3단계 — 필요해지면**
프록시 도입(6절), 즐겨찾기, 필터(영업중·가격대).

## 10. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 카카오 쿼터 정책 변경 | 무료 한도 축소 가능 | 2026-07-21 개정 이력 있음(계정당 첫 앱만 무료 쿼터 제공). 정책 공지 주시 |
| 앱 내장 키 추출 | 쿼터 도용 | 6절 완화책. 실사용자 배포 시 프록시로 전환 |
| `radius` 20km 상한 | 시골 지역 결과 0건 | 반경 자동 확장(1km → 5km → 20km) |
| TourAPI ↔ 카카오 POI 매칭 | 잘못된 이미지 연결 | 좌표 50m 이내 + 상호명 유사도 임계값 이상일 때만 매칭. 실패 시 이미지 생략 |
| 직선거리 ≠ 도보거리 | 사용자 기대와 불일치 | UI에서 직선거리임을 명시 |

---

## 참고 자료

- [카카오 로컬 API 문서](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [카카오맵 API 무료 쿼터 운영 방식 변경 안내](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)
- [한국관광공사 국문 관광정보 서비스 (공공데이터포털)](https://www.data.go.kr/data/15101578/openapi.do)
- [CLLocationUpdate.LiveConfiguration — Apple Developer](https://developer.apple.com/documentation/corelocation/cllocationupdate/liveconfiguration)
- [Streamlined Location Updates with CLLocationUpdate (WWDC23)](https://medium.com/simform-engineering/streamlined-location-updates-with-cllocationupdate-in-swift-wwdc23-2200ef71f845)
- [Core Location Modern API Tips](https://twocentstudios.com/2024/12/02/core-location-modern-api-tips/)
- [Nearby Search (New) — Google Places API](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Places API Usage and Billing — Google](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
