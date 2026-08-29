/**
 * 브라우저 Geolocation을 Promise로 감싼다.
 *
 * Geolocation은 보안 컨텍스트(HTTPS)에서만 동작한다. http://localhost 는 예외로
 * 허용되므로 로컬 개발은 그대로 되지만, 배포는 반드시 HTTPS여야 한다.
 */

/** 위치 실패 사유. UI가 이 값으로 어떤 안내를 띄울지 고른다. */
export const GeoErrorKind = {
  UNSUPPORTED: "unsupported",
  INSECURE: "insecure",
  DENIED: "denied",
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
};

export class GeoError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "GeoError";
    this.kind = kind;
  }
}

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // 1분 안에 잡아둔 좌표가 있으면 재사용한다. 목록을 다시 열 때 GPS를 또 켜지 않는다.
  maximumAge: 60_000,
};

/**
 * 현재 좌표를 한 번 가져온다.
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export function getCurrentPosition(options = {}) {
  if (!("geolocation" in navigator)) {
    return Promise.reject(
      new GeoError(GeoErrorKind.UNSUPPORTED, "이 브라우저는 위치 기능을 지원하지 않습니다.")
    );
  }

  // HTTPS가 아니면 브라우저가 조용히 거부하거나 권한 거부로 위장된 에러를 준다.
  // 원인을 헷갈리지 않도록 미리 걸러낸다.
  if (!window.isSecureContext) {
    return Promise.reject(
      new GeoError(GeoErrorKind.INSECURE, "HTTPS 또는 localhost에서만 위치를 사용할 수 있습니다.")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({ lat: latitude, lng: longitude, accuracy });
      },
      (error) => reject(toGeoError(error)),
      { ...DEFAULT_OPTIONS, ...options }
    );
  });
}

function toGeoError(error) {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return new GeoError(GeoErrorKind.DENIED, "위치 권한이 거부되었습니다.");
    case 2: // POSITION_UNAVAILABLE
      return new GeoError(GeoErrorKind.UNAVAILABLE, "현재 위치를 확인할 수 없습니다.");
    case 3: // TIMEOUT
      return new GeoError(GeoErrorKind.TIMEOUT, "위치 확인에 시간이 너무 오래 걸립니다.");
    default:
      return new GeoError(GeoErrorKind.UNAVAILABLE, error.message || "위치 확인에 실패했습니다.");
  }
}

/** 두 좌표 사이의 직선거리(미터). 하버사인. */
export function distanceBetween(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
