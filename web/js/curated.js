/**
 * 미리 정리해 둔 장소 데이터.
 *
 * scripts/build_places.py 가 data/seeds/*.txt 를 읽어 만든 web/data/places.json 을
 * 그대로 읽는다. 수집은 빌드 시점에 끝났으므로 여기서는 네트워크 호출도, 키도 필요 없다.
 *
 * 카카오와 달리 거리 정렬을 서버가 해 주지 않으므로 이 파일에서 직접 계산한다.
 */
import { distanceBetween } from "./geo.js";

const DATA_URL = "./data/places.json";

/** 한 번 읽으면 재사용한다. 실패해도 빈 배열로 캐시해 매번 다시 시도하지 않는다. */
let loadPromise = null;

async function loadPlaces() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) return [];

      const data = await response.json();
      const places = Array.isArray(data?.places) ? data.places : [];
      // 좌표가 없는 항목은 거리를 잴 수 없다. 스크립트가 걸러 주지만 한 번 더 막는다.
      return places.filter(
        (place) => Number.isFinite(place?.lat) && Number.isFinite(place?.lng)
      );
    } catch {
      // places.json 이 없거나 깨졌어도 앱은 카카오 실시간 검색으로 계속 동작해야 한다.
      return [];
    }
  })();

  return loadPromise;
}

/**
 * 카카오맵에서 이 장소를 열어 주는 링크.
 *
 * 카카오 검색 결과는 장소 상세 페이지 URL(place_url)을 갖고 오지만, 큐레이션 장소는
 * 카카오 장소 ID가 없다. 대신 좌표로 지도를 여는 링크 형식을 쓴다. PC냐 모바일이냐에
 * 따라 카카오가 알아서 맞는 화면으로 보내 준다.
 */
function kakaoMapLink({ name, lat, lng }) {
  // 이름,위도,경도 를 쉼표로 구분하는 형식이라 이름 안의 쉼표는 형식을 깨뜨린다.
  const label = encodeURIComponent(String(name).replace(/,/g, " ").trim());
  return `https://map.kakao.com/link/map/${label},${lat},${lng}`;
}

/**
 * 큐레이션 목록에서 반경 안의 장소를 가까운 순으로 돌려준다.
 * @returns {Promise<Array<object>>} 없으면 빈 배열
 */
export async function findNearbyCurated({ lat, lng, category, radius }) {
  const places = await loadPlaces();
  const origin = { lat, lng };

  return places
    .filter((place) => place.categoryCode === category)
    .map((place) => ({
      ...place,
      distanceMeters: Math.round(distanceBetween(origin, { lat: place.lat, lng: place.lng })),
      // 나중에 씨드나 수집 스크립트가 실제 place_url 을 채워 주면 그쪽을 우선한다.
      placeUrl: place.placeUrl || kakaoMapLink(place),
    }))
    .filter((place) => place.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** 이 거리 안에서 이름이 겹치면 같은 곳으로 본다. */
const SAME_PLACE_RADIUS_M = 100;

/** 공백·중점을 걷어낸 비교용 이름. "제주 만장굴" 과 "제주만장굴" 을 같게 본다. */
function normalizeName(name) {
  return (name || "").replace(/[\s·]/g, "").toLowerCase();
}

function isSamePlace(a, b) {
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;

  // "만장굴" 과 "만장굴주차장" 처럼 한쪽이 다른 쪽을 품는 경우는
  // 가까이 있을 때만 같은 곳으로 친다. 이름만 보면 다른 가게를 지울 수 있다.
  const overlaps = nameA.includes(nameB) || nameB.includes(nameA);
  if (!overlaps) return false;
  return distanceBetween({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= SAME_PLACE_RADIUS_M;
}

/**
 * 큐레이션 목록에 이미 있는 장소를 카카오 결과에서 걸러낸다.
 * 같은 곳이 위아래로 두 번 나오는 것을 막는다.
 */
export function excludeDuplicates(places, curated) {
  if (curated.length === 0) return places;
  return places.filter((place) => !curated.some((item) => isSamePlace(item, place)));
}

/** 테스트에서 캐시를 비운다. */
export function _resetCache() {
  loadPromise = null;
}
