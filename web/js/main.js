/**
 * 상태 관리와 조립.
 *
 * 흐름: 위치 획득 → 카카오 카테고리 검색 → 거리순 목록 렌더링.
 * 상태는 평범한 객체 하나이고, 바뀔 때마다 run()이 화면을 다시 그린다.
 */
import { CATEGORIES, PlacesError, PlacesErrorKind, searchNearby } from "./kakao.js";
import { findNearbyCurated } from "./curated.js";
import { GeoError, GeoErrorKind, distanceBetween, getCurrentPosition } from "./geo.js";
import { buildTabs, formatRadius, renderLoading, renderMessage, renderPlaces, syncTabs } from "./ui.js";

const RADIUS_OPTIONS = [500, 1000, 3000, 5000];

/** 이만큼도 안 움직였으면 좌표를 갱신하지 않는다. 목록 순서가 미세하게 흔들리는 걸 막는다. */
const COORD_REFRESH_THRESHOLD_M = 200;

const state = {
  category: CATEGORIES[0].code,
  radius: 1000,
  /** @type {{lat: number, lng: number} | null} */
  coords: null,
  appKey: null,
  /** 늦게 끝난 응답이 최신 결과를 덮어쓰지 않도록 하는 카운터. */
  requestId: 0,
};

/**
 * config.js는 .gitignore 대상이라 없을 수 있다. 정적 import면 모듈 전체가
 * 죽어버리므로 동적 import로 받아 없으면 안내 화면을 띄운다.
 */
async function loadAppKey() {
  try {
    const module = await import("./config.js");
    return module.KAKAO_JS_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {{refreshLocation: boolean}} options
 */
async function run({ refreshLocation }) {
  const requestId = ++state.requestId;
  const isStale = () => requestId !== state.requestId;

  renderLoading(state.coords ? "주변을 찾는 중…" : "현재 위치를 확인하는 중…");

  try {
    if (refreshLocation || !state.coords) {
      const fresh = await getCurrentPosition();
      if (isStale()) return;

      // 200m 미만 이동이면 기존 좌표를 유지한다.
      const moved =
        !state.coords || distanceBetween(state.coords, fresh) >= COORD_REFRESH_THRESHOLD_M;
      if (moved) state.coords = { lat: fresh.lat, lng: fresh.lng };
    }

    renderLoading("주변을 찾는 중…");

    // 직접 정리해 둔 장소를 먼저 본다. 사진·평점·한줄평이 붙어 있어 화면이 훨씬 낫다.
    // 그 지역 데이터가 없으면(제주 밖 등) 카카오 실시간 검색으로 넘어간다.
    const query = {
      lat: state.coords.lat,
      lng: state.coords.lng,
      category: state.category,
      radius: state.radius,
    };

    let places = await findNearbyCurated(query);
    let source = "curated";
    if (isStale()) return;

    if (places.length === 0) {
      places = await searchNearby({ appKey: state.appKey, ...query });
      source = "kakao";
    }
    if (isStale()) return;

    if (places.length === 0) renderEmpty();
    else renderPlaces(places, { source });
  } catch (error) {
    if (isStale()) return;
    renderError(error);
  }
}

function renderEmpty() {
  const category = CATEGORIES.find((c) => c.code === state.category);
  const wider = RADIUS_OPTIONS.find((meters) => meters > state.radius);

  renderMessage({
    icon: "🔍",
    title: "주변에 결과가 없어요",
    body: category.empty,
    actions: wider
      ? [
          {
            label: `${formatRadius(wider)}까지 넓혀보기`,
            onClick: () => setRadius(wider),
          },
        ]
      : [],
  });
}

function renderError(error) {
  const retry = { label: "다시 시도", onClick: () => run({ refreshLocation: true }) };

  if (error instanceof GeoError) {
    switch (error.kind) {
      case GeoErrorKind.DENIED:
        return renderMessage({
          icon: "📍",
          title: "위치 권한이 필요해요",
          // iOS Safari는 웹에서 설정 앱으로 딥링크할 수 없어 경로를 글로 안내하는 수밖에 없다.
          body: "아이폰: 설정 → Safari → 위치 → '허용'으로 바꾼 뒤 페이지를 새로고침해 주세요. 주소창 왼쪽 아이콘에서 바로 바꿀 수도 있습니다.",
          actions: [retry],
        });
      case GeoErrorKind.INSECURE:
        return renderMessage({
          icon: "🔒",
          title: "HTTPS에서만 동작해요",
          body: "브라우저 정책상 위치 기능은 HTTPS 또는 localhost에서만 쓸 수 있습니다.",
          actions: [],
        });
      case GeoErrorKind.TIMEOUT:
        return renderMessage({
          icon: "⏱",
          title: "위치 확인이 오래 걸려요",
          body: "실내에서는 위치가 잘 안 잡힐 수 있어요. 창가나 실외에서 다시 시도해 주세요.",
          actions: [retry],
        });
      default:
        return renderMessage({
          icon: "📍",
          title: "위치를 확인할 수 없어요",
          body: error.message,
          actions: [retry],
        });
    }
  }

  if (error instanceof PlacesError && error.kind === PlacesErrorKind.MISSING_KEY) {
    return renderMessage({
      icon: "🔑",
      title: "앱키 설정이 필요해요",
      body: "web/js/config.example.js를 config.js로 복사하고 카카오 JavaScript 앱키를 넣어 주세요.",
      actions: [],
    });
  }

  renderMessage({
    icon: "⚠️",
    title: "불러오지 못했어요",
    body: error.message || "네트워크 연결을 확인해 주세요.",
    actions: [retry],
  });
}

function setCategory(code) {
  if (state.category === code) return;
  state.category = code;
  syncTabs(state);
  // 카테고리만 바뀐 것이므로 위치는 다시 잡지 않는다.
  run({ refreshLocation: false });
}

function setRadius(meters) {
  if (state.radius === meters) return;
  state.radius = meters;
  syncTabs(state);
  run({ refreshLocation: false });
}

async function init() {
  buildTabs({
    radiusOptions: RADIUS_OPTIONS,
    onCategoryChange: setCategory,
    onRadiusChange: setRadius,
  });
  syncTabs(state);

  document
    .getElementById("refresh")
    .addEventListener("click", () => run({ refreshLocation: true }));

  state.appKey = await loadAppKey();
  run({ refreshLocation: true });
}

init();
