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
    }))
    .filter((place) => place.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** 테스트에서 캐시를 비운다. */
export function _resetCache() {
  loadPromise = null;
}
