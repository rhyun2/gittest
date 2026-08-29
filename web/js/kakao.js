/**
 * 카카오맵 JavaScript SDK 래퍼.
 *
 * 카카오 REST API(dapi.kakao.com/v2/local/...)는 브라우저에서 CORS로 막혀 있어
 * 웹앱에서 직접 부를 수 없다. 대신 JS SDK의 services 라이브러리를 쓰면
 * 같은 데이터를 CORS 없이 받을 수 있다.
 */

const SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js";

/** 카카오 카테고리 그룹 코드. */
export const CATEGORIES = [
  { code: "AT4", label: "관광지", empty: "이 반경 안에 등록된 관광지가 없어요." },
  { code: "FD6", label: "맛집", empty: "이 반경 안에 등록된 음식점이 없어요." },
  { code: "CE7", label: "카페", empty: "이 반경 안에 등록된 카페가 없어요." },
];

/** 카카오 radius 상한(미터). */
export const MAX_RADIUS = 20_000;
/** 카카오 size 상한. */
const PAGE_SIZE = 15;

export const PlacesErrorKind = {
  MISSING_KEY: "missing-key",
  SDK_LOAD_FAILED: "sdk-load-failed",
  SEARCH_FAILED: "search-failed",
};

export class PlacesError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "PlacesError";
    this.kind = kind;
  }
}

let sdkPromise = null;

/**
 * SDK를 한 번만 로드한다. autoload=false로 받아 kakao.maps.load()로 명시 초기화한다.
 * @param {string} appKey
 */
function loadSdk(appKey) {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    // 테스트에서 window.kakao를 미리 넣어둔 경우 네트워크를 타지 않는다.
    if (window.kakao?.maps?.services) {
      resolve(window.kakao);
      return;
    }

    const script = document.createElement("script");
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new PlacesError(PlacesErrorKind.SDK_LOAD_FAILED, "카카오 SDK를 초기화하지 못했습니다."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => {
      // 키가 틀렸거나 도메인이 등록되지 않은 경우가 대부분이다.
      reject(
        new PlacesError(
          PlacesErrorKind.SDK_LOAD_FAILED,
          "카카오 SDK를 불러오지 못했습니다. 앱키와 사이트 도메인 등록을 확인해 주세요."
        )
      );
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

/**
 * 현재 위치 주변 장소를 가까운 순으로 가져온다.
 *
 * 정렬은 앱에서 하지 않는다. sort: DISTANCE를 넘기면 카카오가 거리순으로 정렬하고
 * 각 항목에 distance(미터)까지 채워 준다.
 *
 * @param {{appKey: string, lat: number, lng: number, category: string, radius: number}} params
 * @returns {Promise<Array<object>>} 정규화된 장소 배열
 */
export async function searchNearby({ appKey, lat, lng, category, radius }) {
  if (!appKey || appKey.startsWith("여기에")) {
    throw new PlacesError(PlacesErrorKind.MISSING_KEY, "카카오 JavaScript 앱키가 설정되지 않았습니다.");
  }

  const kakao = await loadSdk(appKey);
  const places = new kakao.maps.services.Places();

  const data = await new Promise((resolve, reject) => {
    places.categorySearch(
      category,
      (result, status) => {
        const { OK, ZERO_RESULT } = kakao.maps.services.Status;
        if (status === OK) resolve(result);
        else if (status === ZERO_RESULT) resolve([]);
        else reject(new PlacesError(PlacesErrorKind.SEARCH_FAILED, "장소 정보를 가져오지 못했습니다."));
      },
      {
        // LatLng 생성자는 (위도, 경도) 순서다.
        // 반면 아래 결과 항목의 x는 경도, y는 위도로 순서가 반대다. 헷갈리기 쉬운 지점이라
        // 좌표 변환은 이 파일 바깥으로 새지 않게 여기서만 한다.
        location: new kakao.maps.LatLng(lat, lng),
        radius: Math.min(Math.max(radius, 0), MAX_RADIUS),
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: PAGE_SIZE,
      }
    );
  });

  return data.map(normalize).filter(Boolean);
}

/** SDK 응답 한 건을 화면에서 쓰는 형태로 바꾼다. 값이 깨진 항목은 null로 버린다. */
function normalize(item) {
  const lng = Number(item.x);
  const lat = Number(item.y);
  const distanceMeters = Number(item.distance);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(distanceMeters)) {
    return null;
  }

  return {
    id: item.id,
    name: item.place_name,
    // "음식점 > 한식 > 육류,고기" 중 가장 구체적인 마지막 조각만 쓴다.
    category: (item.category_name || "").split(">").pop().trim(),
    // 도로명 주소가 비어 있는 장소가 종종 있어 지번 주소로 폴백한다.
    address: item.road_address_name || item.address_name || "",
    phone: item.phone || "",
    lat,
    lng,
    distanceMeters,
    placeUrl: item.place_url || "",
  };
}

/** 1km 미만은 미터, 그 이상은 소수 첫째 자리 킬로미터. */
export function formatDistance(meters) {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

/** 테스트에서 SDK 로드 캐시를 비운다. */
export function _resetSdkCache() {
  sdkPromise = null;
}
