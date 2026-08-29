# 내 주변 — 관광지 · 맛집 웹앱

현재 위치 주변의 관광지·맛집·카페를 **가까운 순으로** 보여주는 모바일 웹앱.

- [제품 요구사항(PRD)](../docs/prd.md) · [기술 설계](../docs/web-nearby-places-design.md)
- 빌드 없음. npm·node 불필요. `index.html` + ES 모듈 4개가 전부다.
- **아이폰 Safari에서 정상 동작한다.** HTTPS로 배포한 주소로 접속해 위치 권한을 허용하면 현재 위치 기준으로 조회된다. ([6단계](#6-아이폰-실기기에서-확인))

---

## 로컬 실행 절차

### 0. 사전 확인

```bash
git --version
python3 --version    # 3.7 이상 (윈도우는 py --version)
```

Python이 없으면 [python.org](https://www.python.org/downloads/)에서 설치한다. Node가 있다면 4단계에서 `npx serve`로 대체할 수 있다.

### 1. 코드 받기

처음 받는 경우:

```bash
git clone https://github.com/rhyun2/gittest.git
cd gittest
```

이미 클론해 둔 경우:

```bash
cd gittest
git checkout main
git pull origin main
```

확인:

```bash
ls web/js
# config.example.js  geo.js  kakao.js  main.js  ui.js
```

### 2. 카카오 JavaScript 키 발급

[developers.kakao.com](https://developers.kakao.com)에 카카오 계정으로 로그인한다.

**2-1. 앱 만들기**
**내 애플리케이션** → **애플리케이션 추가하기** → 앱 이름과 회사 이름을 입력하고 저장.

**2-2. JavaScript 키 복사**
만든 앱 → **앱 키** 탭 → **JavaScript 키** 복사.

> ⚠️ **REST API 키가 아니다.** 같은 화면에 네 종류 키가 나란히 있는데, 웹앱은 반드시 JavaScript 키를 쓴다. REST 키를 넣으면 SDK가 뜨지 않는다.

**2-3. 카카오맵 활성화** ← 가장 많이 빠뜨리는 단계
**제품 설정** → **카카오맵** → **활성화 설정**을 **ON**.

2024년 12월부터 생긴 설정이라 예전 블로그 글에는 없는 경우가 많다. 켜지 않으면 키가 맞아도 **401 Unauthorized**가 난다.

**2-4. 사이트 도메인 등록**
**앱 설정** → **플랫폼** → **Web 플랫폼 등록** → 사이트 도메인에 입력:

```
http://localhost:8000
```

배포까지 할 거라면 `https://<사용자>.github.io`도 함께 등록한다.

> 콘솔 개편으로 이 항목이 **플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인** 아래에 있는 계정도 있다. 두 경로 모두 같은 설정이다.

**포트까지 정확히 일치해야 한다.** `http://localhost`만 등록하고 8000 포트로 열면 동작하지 않는다. 4단계에서 8000 포트를 고정하는 이유다.

이 도메인 등록이 키의 실제 방어선이다. 등록하지 않은 도메인에서는 키가 있어도 SDK가 동작하지 않는다.

### 3. 키 넣기

저장소 루트에서:

```bash
cp web/js/config.example.js web/js/config.js
```

`web/js/config.js`의 마지막 줄을 2-2에서 복사한 키로 교체한다:

```js
export const KAKAO_JS_KEY = "발급받은_JavaScript_키";
```

`config.js`는 `.gitignore` 대상이라 커밋되지 않는다. `git status --short`에 아무것도 안 나오면 정상이다.

키를 넣지 않아도 앱은 실행되며 "앱키 설정이 필요해요" 화면이 뜬다.

### 4. 서버 실행

**반드시 저장소 루트에서** 실행한다.

```bash
python3 -m http.server 8000 -d web
```

윈도우는 `py -m http.server 8000 -d web`, Node를 쓴다면 `npx serve web -l 8000`.

> **`file://`로 열면 안 된다.** `index.html`을 더블클릭하면 ES 모듈이 CORS 정책에 막혀 흰 화면이 된다. 반드시 HTTP 서버를 거쳐야 한다.

### 5. 브라우저에서 확인

`http://localhost:8000` 접속 → 위치 권한 **허용**.

`http://localhost`는 브라우저가 보안 컨텍스트로 인정하므로 HTTPS 없이도 위치 기능이 동작한다.

**데스크톱에서는 위치를 강제로 지정하는 편이 낫다.** 노트북 위치는 IP·와이파이 기반이라 부정확하고, 해외 IP로 잡히면 결과가 0건이 된다.

Chrome 기준: `F12` → `Ctrl/Cmd+Shift+P` → `sensors` 입력 → **Show Sensors** → Location을 **Other...** 로 바꾸고 위도 `37.5796`, 경도 `126.9770`(경복궁) 입력 → 페이지 새로고침.

이어서 확인해 볼 것:

- **맛집 / 카페** 탭 전환 → 목록이 바뀌고 위치 권한을 다시 묻지 않음
- **반경 500m ↔ 5km** 전환 → 결과 개수 변화
- **거리 배지** → 1km 미만은 `231m`, 이상은 `1.2km`
- **항목 클릭** → 카카오맵 상세 페이지가 새 탭으로 열림
- **↻ 버튼** → 위치를 다시 잡아 재검색

### 6. 아이폰 실기기에서 확인

**아이폰에서 위치 정보는 정상적으로 쓸 수 있다.** HTTPS 주소로 접속하면 Safari가 위치 권한 팝업을 띄우고, 허용하면 현재 위치 기준으로 관광지가 조회된다.

웹 Geolocation도 iOS의 동일한 GPS·와이파이 측위를 쓴다. 전경에서 한 번 위치를 받아오는 이 앱의 용도로는 네이티브 앱과 정확도 차이가 사실상 없다. 웹이 못 하는 것은 백그라운드 위치 추적·지오펜싱·"항상 허용" 권한인데, 이 앱은 셋 다 쓰지 않는다.

판단 기준은 **접속 주소가 보안 컨텍스트인가** 하나뿐이다.

| 접속 주소 | 위치 | 비고 |
|---|---|---|
| `https://<사용자>.github.io/gittest/` | ✅ | 실제 사용 경로 |
| `https://xxx.trycloudflare.com` | ✅ | 임시 터널 (아래 B) |
| PC의 `http://localhost:8000` | ✅ | localhost는 예외적으로 보안 컨텍스트로 인정 |
| `http://192.168.x.x:8000` | ❌ | 개발 PC 서버에 LAN으로 접속 — **여기만 막힌다** |

마지막 행만 안 된다. 개발 PC에서 서버를 띄워놓고 같은 와이파이의 아이폰으로 붙는 방식인데, iOS Safari는 HTTPS가 아닌 출처에서 Geolocation을 차단하고 `localhost` 예외는 그 기기 자신에게만 적용되기 때문이다. 이때 앱은 🔒 "HTTPS에서만 동작해요" 화면을 띄운다.

**제품 제약이 아니라 개발 중 실기기 확인이라는 워크플로의 제약이다.** 우회 방법은 두 가지다.

**A. GitHub Pages 배포** — 아래 [배포](#배포-github-pages) 참고. 워크플로가 이미 준비돼 있다. 실제 사용 경로이므로 이쪽이 기본이다.

**B. 임시 HTTPS 터널** — 배포 없이 지금 당장 확인하고 싶을 때.

```bash
cloudflared tunnel --url http://localhost:8000
```

출력된 `https://....trycloudflare.com` 주소를 카카오 콘솔 사이트 도메인에 등록한 뒤 아이폰에서 접속한다. 주소가 매번 바뀌므로 그때마다 재등록해야 한다.

#### 아이폰에서 위치가 안 잡힌다면

권한이 두 단계라는 점을 알아두면 된다.

1. **iOS 전체 설정** — 설정 → 개인정보 보호 및 보안 → 위치 서비스 → **Safari 웹사이트**가 "앱을 사용하는 동안"인지 확인한다. 여기가 꺼져 있으면 어떤 웹사이트도 위치를 받지 못한다.
2. **사이트별 허용** — 접속 시 뜨는 팝업. 거부했다면 주소창 왼쪽 `ᴀA` 버튼 → 웹사이트 설정 → 위치에서 다시 바꾼다.

---

## 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| 🔑 "앱키 설정이 필요해요" | `config.js`가 없거나 키가 자리표시자 그대로. 3단계 확인 |
| 콘솔에 **401 Unauthorized** | ① 카카오맵 활성화 OFF(2-3) ② 사이트 도메인 미등록·포트 불일치(2-4) ③ REST 키를 넣음(2-2) 순으로 확인 |
| ⚠️ "불러오지 못했어요" | SDK는 떴는데 검색이 실패. 네트워크 또는 쿼터 확인 |
| 📍 "위치 권한이 필요해요" | 주소창 왼쪽 아이콘 → 위치 허용으로 변경 후 새로고침 |
| 🔒 "HTTPS에서만 동작해요" | `http://192.168.x.x` 같은 비보안 주소로 접속했다. 배포 주소(`https://...`)나 PC의 `http://localhost:8000`으로 접속하면 해결된다. 6단계 참고 |
| 🔍 결과 0건 | 위치가 한국 밖으로 잡힌 경우가 대부분. 5단계 DevTools 위치 지정 |
| 흰 화면 | `file://`로 열었거나 서버를 `web/` 안에서 실행했다. 루트에서 `-d web` |
| 거리가 지도 앱과 다름 | 정상이다. `distance`는 **직선거리**라 도보 경로와 차이가 난다 |

가장 흔한 실패는 **2-3(카카오맵 활성화) 누락**과 **REST 키를 넣는 것** 두 가지다. 401이 뜨면 이 둘부터 본다.

---

## 배포 (GitHub Pages)

`main`에 `web/` 변경이 푸시되면 `.github/workflows/deploy-pages.yml`이 자동 배포한다.

먼저 세 가지를 해둬야 한다.

1. 저장소 **Settings → Pages → Source**를 `GitHub Actions`로 변경
2. 저장소 **Settings → Secrets and variables → Actions**에 `KAKAO_JS_KEY` 등록
3. 카카오 콘솔 사이트 도메인에 배포 주소(`https://<사용자>.github.io`) 등록 (2-4 참고)

워크플로가 배포 직전 Secret으로 `config.js`를 만들어 넣는다.

> JavaScript 앱키는 어차피 브라우저에 노출된다. 이 Secret 방식은 공개 저장소에 키 문자열을 남기지 않으려는 조치일 뿐이고, 번거로우면 `config.js`를 그냥 커밋해도 실질적인 위험 차이는 없다. 도메인 등록이 실제 방어선이다.

---

## 구조

```
web/
├── index.html          레이아웃 + 목록/메시지 template
├── styles.css          다크 모드, safe-area 대응
└── js/
    ├── config.js       앱키 (gitignore)
    ├── kakao.js        SDK 로드 · 카테고리 검색 · 응답 정규화
    ├── geo.js          Geolocation Promise 래핑 · 에러 분류
    ├── ui.js           렌더링 (상태를 모름)
    └── main.js         상태 · 이벤트 · 조립
```

## 알아둘 점

**거리순 정렬을 앱에서 하지 않는다.** `sort: SortBy.DISTANCE`를 넘기면 카카오가 정렬하고 각 항목의 `distance`(미터)까지 채워 준다. 앱에는 비교 함수가 없다.

**좌표 순서가 입력과 출력에서 뒤집힌다.** `new kakao.maps.LatLng(위도, 경도)`인데 결과 항목의 `x`는 경도, `y`는 위도다. 헷갈리기 쉬워 변환은 `kakao.js` 안에서만 한다.

**REST API는 쓸 수 없다.** `dapi.kakao.com/v2/local/...`은 브라우저에서 CORS로 막힌다. 서버 없이 가려면 JS SDK가 유일한 길이다.

**카테고리·반경을 바꿔도 위치를 다시 잡지 않는다.** 저장된 좌표를 재사용한다. 새로고침 시에도 200m 미만 이동이면 좌표를 갱신하지 않아 목록 순서가 흔들리지 않는다.

**HTML 주입 여지가 없다.** 장소 이름·주소는 외부 문자열이므로 template 엘리먼트를 복제해 `textContent`로만 값을 넣는다. `innerHTML`은 한 곳도 쓰지 않는다.

## 검증

Chromium + Playwright로 6개 시나리오 22개 항목을 확인했다(목록 렌더링·정렬·좌표 순서, 카테고리/반경 전환 시 위치 재획득 안 함, 결과 0건, 권한 거부, 검색 실패, 앱키 미설정). 카카오 SDK는 스텁으로 대체했으므로 **실제 앱키로 실 데이터를 받는 경로는 로컬에서 한 번 확인**해야 한다.
