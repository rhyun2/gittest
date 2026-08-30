# 기술 설계 — 내 주변 관광지·맛집 웹앱

제품 요구사항은 [prd.md](./prd.md)에 있다. 이 문서는 **어떻게 만들 것인가**를 다룬다.

> 코드 조각은 설명용 발췌다. 실제 구현은 `web/`에 있고, 실제 브라우저에서 검증했다.

---

## 1. 결론

**빌드 없는 정적 웹앱 + 카카오맵 JavaScript SDK.** 서버도, npm도, 번들러도 없다.

`index.html` 하나와 ES 모듈 네 개가 전부이고, `git push`가 곧 배포다.

---

## 2. iOS 네이티브에서 무엇이 어떻게 바뀌었나

원래 설계는 SwiftUI 네이티브였다([archive/ios-nearby-places-design.md](../archive/ios-nearby-places-design.md)). 개발 난이도 때문에 웹으로 전환하면서 **역할은 그대로 두고 구현체만 갈아끼웠다.**

| 역할 | iOS (중단) | 웹 (현재) |
|---|---|---|
| 위치 획득 | `LocationService` — CoreLocation `CLLocationUpdate` | `js/geo.js` — `navigator.geolocation` |
| 장소 검색 | `KakaoPlacesRepository` — REST `category.json` | `js/kakao.js` — SDK `services.Places.categorySearch` |
| 데이터 소스 추상화 | `PlacesRepository` 프로토콜 | `searchNearby()` 함수 = 모듈 경계 |
| 상태 관리 | `NearbyViewModel` (`@Observable`) | `js/main.js` — 상태 객체 + 재렌더 |
| 화면 | `NearbyListView` / `PlaceRow` | `index.html` `<template>` + `js/ui.js` |
| 키 관리 | xcconfig → Info.plist (노출 방어 **불가**) | `config.js` + 도메인 등록 (노출돼도 **무효화됨**) |
| 배포 | Xcode 빌드 · 서명 · 심사 | GitHub Pages (`git push`) |

**쉬워진 것**
- 서명·프로비저닝·앱스토어 심사가 통째로 사라졌다.
- 설치 없이 링크로 공유된다. 일회성 사용자에게 특히 잘 맞는다.
- **키 노출 문제가 구조적으로 해결됐다.** iOS에서는 REST 키를 앱에 넣으면 추출을 막을 방법이 없어 결국 프록시가 필요했는데, 웹의 JS 앱키는 등록된 도메인 밖에서 동작하지 않으므로 프록시가 필요 없다.
- 실제 브라우저에서 자동 검증이 가능하다(§8).

**까다로워진 것**
- Geolocation은 보안 컨텍스트에서만 동작하므로 **HTTPS 배포가 필수**다.
- iOS Safari에서 위치 권한을 거부하면 설정 앱으로 딥링크할 수 없다. 네이티브에서는 `UIApplication.openSettingsURLString` 한 줄이면 됐다.
- 백그라운드 위치, 푸시 같은 것은 애초에 불가능하다. 다만 이 앱은 쓰지 않는다.

---

## 3. 왜 REST가 아니라 JavaScript SDK인가

**카카오 REST API(`dapi.kakao.com/v2/local/...`)는 브라우저에서 호출할 수 없다.** CORS 헤더를 내려주지 않아 프리플라이트에서 막힌다. iOS 앱은 CORS 제약이 없어 REST를 그대로 썼지만, 웹에서는 선택지가 아니다.

대안은 두 가지였다.

| 방법 | 판정 |
|---|---|
| 프록시 서버를 두고 REST 호출 | 서버가 생긴다. "난이도를 낮춘다"는 전환 목적에 정면으로 반한다 |
| **카카오맵 JS SDK의 `services` 라이브러리** | **채택.** 같은 데이터를 CORS 없이, 서버 없이 받는다 |

SDK가 주는 데이터는 REST와 사실상 동일하다 — `place_name`, `category_name`, `address_name`, `road_address_name`, `phone`, `x`, `y`, `place_url`, 그리고 **`distance`**.

### 거리순 정렬은 여전히 서버가 한다

이건 iOS 설계에서 그대로 살아남은 핵심이다.

```js
places.categorySearch(category, callback, {
  location: new kakao.maps.LatLng(lat, lng),
  radius: 1000,
  sort: kakao.maps.services.SortBy.DISTANCE,  // ← 이것 하나로 정렬 끝
  size: 15,
});
```

앱에는 거리 계산도, 정렬도, 비교 함수도 없다. 카카오가 정렬해 준 배열을 그대로 렌더링한다.

### 좌표 순서 함정이 두 겹이다

iOS에서는 "x가 경도, y가 위도"라는 함정 하나였는데, 웹에서는 **입력과 출력의 순서가 서로 다르다.**

| | 순서 |
|---|---|
| 입력: `new kakao.maps.LatLng(a, b)` | **(위도, 경도)** |
| 출력: 결과 항목의 `x`, `y` | **x = 경도, y = 위도** |

같은 SDK 안에서 규칙이 뒤집힌다. 그래서 좌표 변환은 `js/kakao.js` 밖으로 새지 않게 한 파일 안에서만 한다.

```js
// js/kakao.js — 입력
location: new kakao.maps.LatLng(lat, lng),

// js/kakao.js — 출력 정규화
const lng = Number(item.x);
const lat = Number(item.y);
```

---

## 3-2. 데이터 소스가 둘인 이유

사진·평점·요약을 붙이려면 카카오만으로는 부족하다. 카카오 로컬은 **이미지도 평점도 주지 않는다.**

TourAPI(한국관광공사)가 관광지 사진과 개요를 갖고 있지만, 런타임에 부를 수 없다.

| 문제 | 내용 |
|---|---|
| CORS | `apis.data.go.kr` 은 브라우저 요청에 CORS 헤더를 주지 않는다 |
| 키 노출 | `serviceKey` 는 카카오 JS 키와 달리 **도메인 제한이 없다.** 노출되면 누구나 쓸 수 있다 |

프록시 서버를 두면 둘 다 풀리지만, 서버를 없앤 것이 이 전환의 핵심이었다.

**그래서 수집을 빌드 시점으로 옮겼다.** `scripts/build_places.py` 는 브라우저가 아니라 개발자 PC에서
돌기 때문에 CORS가 적용되지 않고, 키는 로컬 환경변수로만 쓰이며 결과 JSON에는 남지 않는다.

```
장소명만 적은 씨드
      │  scripts/geocode_seeds.py    카카오 REST 키 — 이름 → 좌표
      ↓
좌표가 채워진 씨드
      │  scripts/build_places.py     TourAPI 키 — 사진·요약 보강
      ↓
web/data/places.json  ──→  브라우저(키 불필요)
```

두 스크립트가 쓰는 키는 서로 다르고, 웹앱이 쓰는 JavaScript 키와도 다르다.

| 스크립트 | 키 | 왜 이 소스인가 |
|---|---|---|
| `geocode_seeds.py` | 카카오 **REST API 키** | 국내 음식점·카페 커버리지가 TourAPI보다 훨씬 좋다 |
| `build_places.py` | **TourAPI 키** (선택) | 관광지 사진과 개요를 가진 유일한 무료 공식 소스 |

둘 다 브라우저가 아닌 PC에서 돌기 때문에 CORS가 적용되지 않고, 키는 결과 JSON에 남지 않는다.
카카오 REST 키는 도메인 제한이 없어 진짜 비밀이다. 환경변수로만 넘긴다.

런타임에는 **두 소스를 모두 부르고 위아래로 이어 붙인다.**

```
┌─ 직접 정리한 장소 N곳 ─┐   사진·평점·한줄평이 붙어 있다
│  가까운 순              │
├─ 카카오맵 검색 결과 M곳 ┤   큐레이션에 없는 곳만
│  가까운 순              │
└────────────────────────┘
```

처음에는 "큐레이션이 있으면 카카오를 부르지 않는" 배타 구조였는데, 양쪽 모두에서 문제가 생겼다.
큐레이션이 없는 지역에서는 사진이 아예 안 보이고, 있는 지역에서는 큐레이션 몇 곳 때문에
주변 가게가 통째로 가려졌다. 이어 붙이는 방식이 두 문제를 동시에 없앤다.

정렬은 구획 안에서만 한다. 전체를 거리순으로 섞으면 큐레이션을 위에 두는 의미가 사라진다.

**중복 제거** — 같은 곳이 양쪽에 나오면 카카오 쪽에서 뺀다. 공백·중점을 지운 이름이 같으면
같은 곳으로 보고, 한쪽 이름이 다른 쪽을 품는 경우(`만장굴` vs `만장굴주차장`)는 100m 안에
있을 때만 같다고 본다. 이름만 보면 같은 건물의 다른 가게를 지워 버린다.

**클릭 시 이동** — 카카오 검색 결과는 응답에 담긴 장소 상세 페이지(`place_url`)로 간다.
큐레이션 장소는 카카오 장소 ID가 없어 그 URL을 만들 수 없으므로, 좌표로 지도를 여는
링크 형식을 쓴다.

```
https://map.kakao.com/link/map/{장소명},{위도},{경도}
```

PC냐 모바일이냐에 따라 카카오가 알아서 맞는 화면으로 보낸다. 이름·위도·경도를 쉼표로
구분하는 형식이라 **이름 안의 쉼표는 형식을 깨뜨린다.** 공백으로 바꾼 뒤 인코딩한다.
`geocode_seeds.py` 가 카카오 검색을 하면서 응답의 `place_url`(장소 상세 페이지)도 함께 모아
`data/kakao-links.json` 에 저장한다. 그 값이 있으면 좌표 링크 대신 상세 페이지로 보낸다.

씨드에 URL 칸을 더하지 않고 별도 파일로 뺀 이유는, 씨드가 사람이 자주 손대는 파일이기 때문이다.
`장소명 | 좌표 | 평점 | 한줄평` 뒤에 긴 URL이 붙으면 편집이 불편해진다. 링크 파일은 기계가
관리하고 사람은 보지 않아도 된다.

**카카오가 실패해도 큐레이션은 살린다.** 앱키가 없거나 검색이 실패해도 큐레이션 결과가 있으면
그것을 보여주고, 둘 다 비었을 때만 오류 화면을 띄운다. 덕분에 큐레이션이 덮는 지역에서는
**카카오 앱키 없이도 앱이 동작한다.**

정렬 주체도 소스마다 다르다. 카카오는 서버가 정렬해 주지만, 큐레이션은 좌표만 있으므로
`js/curated.js` 가 `geo.js` 의 `distanceBetween()` (하버사인)으로 직접 계산해 정렬한다.

### 이름을 좌표로 바꿀 때 조심한 것

같은 상호가 전국에 여럿 있다. "올레국수"를 그냥 검색하면 서울 가게가 1위로 나올 수 있다.
씨드 파일 상단 지시자로 두 겹의 방어를 뒀다.

```
#! region: 제주                        검색어 앞에 붙인다
#! bbox: 33.10,126.10,33.60,127.00    이 범위 밖 후보는 버리고 다음을 본다
```

카테고리도 함께 넘겨(`category_group_code`) 정확도를 높이되, 그것 때문에 결과가 0건이 되면
조건을 풀고 한 번 더 검색한다. 이미 좌표가 적힌 줄은 건드리지 않는다.

### 빌드 스크립트에서 조심한 것

- **`mapx` 가 경도, `mapy` 가 위도** — 카카오와 같은 함정이 TourAPI에도 있다. 변환은 스크립트 한 곳에서만
- **이미지 URL을 https로 올린다** — TourAPI는 `http://` 로 주는 경우가 있는데, 배포 페이지가 HTTPS라
  그대로 두면 혼합 콘텐츠로 차단돼 사진이 안 뜬다
- **`overview` 의 HTML 태그 제거** — `<br>` 등이 섞여 온다. 태그를 걷어내고 120자로 자른다
- **씨드에 적힌 값이 API 값보다 우선** — 사람이 고쳐 놓은 것을 덮어쓰지 않는다

---

## 4. 구조

```
web/
├── index.html          레이아웃 + <template> 두 개
├── styles.css          다크 모드, safe-area 대응
└── js/
    ├── config.js       카카오 JS 앱키 (gitignore, 예시 파일에서 복사)
    ├── kakao.js        SDK 로드 + 검색 + 응답 정규화
    ├── curated.js      places.json 로드 + 거리 계산·정렬
    ├── geo.js          Geolocation Promise 래핑 + 에러 분류
    ├── ui.js           렌더링만 담당 (상태를 모름)
    └── main.js         상태 + 이벤트 + 조립
```

의존 방향은 한쪽으로만 흐른다. `main.js → {kakao, geo, ui}`이고, `ui.js`는 상태 객체를 알지 못한 채 전달받은 값만 그린다.

### 상태

프레임워크 없이 평범한 객체 하나다.

```js
const state = {
  category: "AT4",   // AT4 관광지 / FD6 맛집 / CE7 카페
  radius: 1000,
  coords: null,      // 마지막으로 잡은 좌표
  appKey: null,
  requestId: 0,      // 늦게 온 응답이 최신 결과를 덮어쓰지 못하게
};
```

`requestId`는 경쟁 조건 방어다. 사용자가 카테고리를 빠르게 연달아 누르면 이전 요청이 나중에 도착할 수 있는데, 응답을 반영하기 전에 자기 `requestId`가 아직 최신인지 확인한다.

### 좌표 재사용 규칙 (iOS 뷰모델에서 그대로 옮겨옴)

- **카테고리·반경 변경** → 위치를 다시 잡지 않고 저장된 좌표로 재검색
- **새로고침 버튼** → 위치를 다시 잡되, **200m 미만 이동이면 좌표를 갱신하지 않는다**

두 번째 규칙이 없으면 GPS가 미세하게 흔들릴 때마다 목록 순서가 바뀐다. 검증에서 카테고리·반경을 두 번 바꿔도 `getCurrentPosition` 호출이 1회에 머무르는 것을 확인했다.

---

## 5. 위치 획득

```js
navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,   // 1분 내 좌표는 재사용, GPS를 또 켜지 않음
});
```

`getCurrentPosition`은 콜백 기반이라 Promise로 감싸고, 에러 코드를 의미 있는 종류로 바꾼다.

| 코드 | 분류 | 화면 |
|---|---|---|
| 1 `PERMISSION_DENIED` | `denied` | 설정 경로 안내 + 다시 시도 |
| 2 `POSITION_UNAVAILABLE` | `unavailable` | 일반 오류 + 다시 시도 |
| 3 `TIMEOUT` | `timeout` | "실외에서 다시 시도" |

여기에 표준에 없는 분류를 하나 더 뒀다. **`insecure`** — HTTPS가 아닐 때다.

```js
if (!window.isSecureContext) {
  return Promise.reject(new GeoError(GeoErrorKind.INSECURE, "..."));
}
```

HTTP로 열면 브라우저가 조용히 거부하거나 권한 거부처럼 위장된 에러를 준다. 원인을 헷갈리지 않도록 미리 걸러낸다. `http://localhost`는 보안 컨텍스트로 인정되므로 로컬 개발은 그대로 된다.

---

## 6. 키 관리 — iOS와 결정적으로 다른 지점

**JavaScript 앱키는 브라우저에 노출될 수밖에 없다.** 이건 숨길 수 있는 종류의 값이 아니다.

대신 카카오 콘솔의 **앱 설정 → 플랫폼 → Web → 사이트 도메인**에 등록한 오리진에서만 키가 동작한다. 남이 키를 가져가도 자기 도메인에서는 쓸 수 없다. Google Maps JS 키와 같은 모델이다.

등록해야 할 오리진:
```
http://localhost:8000       로컬 개발
https://rhyun2.github.io   배포
```

**따라서 이 키는 저장소에 커밋해도 실질적인 문제가 없다.** 다만 기본 설정은 `config.js`를 `.gitignore`에 넣고 배포 시 GitHub Actions가 저장소 Secret으로 생성하게 해뒀다. 공개 저장소에 키 문자열을 남기지 않는 편이 심리적으로 편하고, iOS 버전의 `Secrets.xcconfig` 패턴과 구조가 같아 이해하기 쉽기 때문이다. 번거로우면 그냥 커밋해도 된다.

`config.js`가 없을 때 앱 전체가 죽지 않도록 **동적 import**로 읽는다.

```js
async function loadAppKey() {
  try {
    const module = await import("./config.js");
    return module.KAKAO_JS_KEY ?? null;
  } catch {
    return null;   // → "앱키 설정이 필요해요" 화면
  }
}
```

정적 `import`였다면 파일 하나가 없다는 이유로 모듈 그래프 전체가 실패해 흰 화면이 된다.

---

## 7. 렌더링과 XSS

장소 이름과 주소는 **외부에서 온 문자열**이다. `innerHTML`을 쓰면 주입 경로가 열린다.

`index.html`에 `<template>`을 두고, 값은 전부 `textContent`로만 넣는다.

```js
const item = placeTemplate.content.cloneNode(true);
item.querySelector(".place-name").textContent = place.name;   // innerHTML 아님
```

프로젝트 전체에 `innerHTML` 사용이 한 곳도 없다.

---

## 8. 검증

Chromium + Playwright로 실제 브라우저에서 자동 검증한다. 카카오 앱키 없이 `window.kakao`를 스텁으로 주입해 앱 자체 로직만 떼어 확인한다.

```js
await context.grantPermissions(["geolocation"]);
await context.setGeolocation({ latitude: 37.5796, longitude: 126.977 });  // 경복궁
await page.addInitScript(kakaoStub);
```

확인 항목 22개가 통과했다. 주요 항목:

- 카카오가 준 순서를 **그대로** 렌더링 (앱이 재정렬하지 않음)
- `sort=distance`로 요청하고 `LatLng`에 (위도, 경도) 순서로 전달
- 좌표가 깨진 항목은 목록에서 제외 (4건 중 3건 렌더)
- 도로명 주소가 없으면 지번 주소로 폴백
- 카테고리·반경을 두 번 바꿔도 위치 획득은 **1회**
- 결과 0건일 때 한 단계 넓은 반경(1km → 3km)으로 재검색
- 권한 거부 시 검색을 시도조차 하지 않고 안내 화면 표시
- `config.js` 없을 때 앱키 안내 화면 표시

**검증하지 못한 것**: 실제 카카오 앱키로 실 데이터를 받아오는 경로. 키가 없어 스텁으로 대체했으므로, 로컬에서 키를 넣고 한 번 확인해야 한다.

---

## 9. 배포

`.github/workflows/deploy-pages.yml`이 `web/`을 GitHub Pages로 올린다. 배포 직전 저장소 Secret `KAKAO_JS_KEY`로 `js/config.js`를 만들어 넣는다.

배포 주소는 **https://rhyun2.github.io/gittest/** 다.

수동 선행 조건 세 가지:
1. 저장소 **Settings → Pages → Source**를 `GitHub Actions`로 변경
2. 저장소 **Settings → Secrets and variables → Actions**에 `KAKAO_JS_KEY` 등록
3. 카카오 콘솔에 배포 도메인(`https://rhyun2.github.io`) 등록 — 경로 없이 오리진만

---

## 10. 다음 단계

| 단계 | 내용 |
|---|---|
| 2단계 | 지도 뷰(카카오맵 SDK에 이미 포함), 장소 상세, 길찾기 딥링크, 검색 결과 캐싱 |
| 3단계 | PWA 홈 화면 추가, 즐겨찾기(localStorage), 큐레이션 지역 확대 |

프록시 도입은 **로드맵에서 빠졌다.** 도메인 제한이 그 역할을 대신한다.

## 참고 자료

- [Kakao 지도 Web API 문서](https://apis.map.kakao.com/web/documentation/)
- [카카오 로컬 API — 카테고리 코드 및 응답 필드](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [카카오맵 API 무료 쿼터 정책 변경 공지](https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)
- [Geolocation API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Secure contexts — MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
