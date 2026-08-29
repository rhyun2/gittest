# 내 주변 — 관광지 · 맛집 웹앱

현재 위치 주변의 관광지·맛집·카페를 **가까운 순으로** 보여주는 모바일 웹앱.

- [제품 요구사항(PRD)](../docs/prd.md) · [기술 설계](../docs/web-nearby-places-design.md)
- 빌드 없음. npm·node 불필요. `index.html` + ES 모듈 4개가 전부다.

## 실행 방법

### 1. 카카오 JavaScript 앱키 발급

1. [카카오 개발자 콘솔](https://developers.kakao.com) → **내 애플리케이션** → 앱 생성
2. **앱 키** 탭에서 **`JavaScript 키`** 복사 — REST API 키가 아니다
3. **제품 설정 → 카카오맵**에서 카카오맵 API 활성화
4. **앱 설정 → 플랫폼 → Web → 사이트 도메인**에 아래 두 개 등록

   ```
   http://localhost:8000
   https://<사용자>.github.io
   ```

   이 등록이 키의 실제 방어선이다. 등록하지 않은 도메인에서는 키가 있어도 SDK가 동작하지 않는다.

### 2. 키 넣기

```bash
cp web/js/config.example.js web/js/config.js
# web/js/config.js 의 KAKAO_JS_KEY 값을 채운다
```

`config.js`는 `.gitignore` 대상이다. 키를 넣지 않아도 앱은 정상 실행되며 "앱키 설정이 필요해요" 화면이 뜬다.

### 3. 로컬 실행

```bash
python3 -m http.server 8000 -d web
# http://localhost:8000 접속
```

`http://localhost`는 브라우저가 보안 컨텍스트로 인정하므로 HTTPS 없이도 위치 기능이 동작한다. 다른 기기에서 접속하려면 HTTPS가 필요하다.

## 배포 (GitHub Pages)

`main`에 `web/` 변경이 푸시되면 `.github/workflows/deploy-pages.yml`이 자동 배포한다.

먼저 세 가지를 해둬야 한다.

1. 저장소 **Settings → Pages → Source**를 `GitHub Actions`로 변경
2. 저장소 **Settings → Secrets and variables → Actions**에 `KAKAO_JS_KEY` 등록
3. 카카오 콘솔 사이트 도메인에 배포 주소 등록 (위 1단계)

워크플로가 배포 직전 Secret으로 `config.js`를 만들어 넣는다.

> JavaScript 앱키는 어차피 브라우저에 노출된다. 이 Secret 방식은 공개 저장소에 키 문자열을 남기지 않으려는 조치일 뿐이고, 번거로우면 `config.js`를 그냥 커밋해도 실질적인 위험 차이는 없다. 도메인 등록이 실제 방어선이다.

## 구조

```
web/
├── index.html          레이아웃 + 목록/메시지 <template>
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

**HTML 주입 여지가 없다.** 장소 이름·주소는 외부 문자열이므로 `<template>` + `textContent`로만 렌더링한다. `innerHTML`은 한 곳도 쓰지 않는다.

## 검증

Chromium + Playwright로 6개 시나리오 22개 항목을 확인했다(목록 렌더링·정렬·좌표 순서, 카테고리/반경 전환 시 위치 재획득 안 함, 결과 0건, 권한 거부, 검색 실패, 앱키 미설정). 카카오 SDK는 스텁으로 대체했으므로 **실제 앱키로 실 데이터를 받는 경로는 로컬에서 한 번 확인**해야 한다.
