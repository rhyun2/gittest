#!/usr/bin/env python3
"""씨드 파일을 읽어 web/data/places.json 을 만든다.

    python3 scripts/build_places.py                    # 씨드에 적힌 값만으로 생성
    TOUR_API_KEY=xxx python3 scripts/build_places.py   # 사진·요약·좌표를 TourAPI로 보강

브라우저가 아니라 이 PC에서 도는 스크립트이므로 CORS 제약이 없고,
TourAPI 키는 여기서만 쓰이며 결과 JSON에는 들어가지 않는다.

표준 라이브러리만 쓴다. pip install 이 필요 없다.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = REPO_ROOT / "data" / "seeds"
OUTPUT = REPO_ROOT / "web" / "data" / "places.json"

# geocode_seeds.py 가 만들어 두는 파일. 장소별 카카오맵 상세 페이지 주소가 들어 있다.
# 씨드는 사람이 손으로 고치는 파일이라 URL 같은 긴 값으로 지저분해지지 않게 따로 뒀다.
LINKS_FILE = REPO_ROOT / "data" / "kakao-links.json"

TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2"

# 씨드의 카테고리 이름 -> 앱이 쓰는 카카오 카테고리 코드.
# 큐레이션 결과와 카카오 실시간 결과가 같은 탭에서 섞일 수 있게 코드를 맞춰 둔다.
CATEGORY_CODES = {
    "관광지": "AT4",
    "맛집": "FD6",
    "카페": "CE7",
}

# TourAPI 콘텐츠 타입. 검색 결과가 여러 건일 때 카테고리에 맞는 것을 고르는 데 쓴다.
CONTENT_TYPE_IDS = {
    "관광지": "12",
    "맛집": "39",
    "카페": "39",
}

SUMMARY_MAX_LEN = 120


class SeedError(Exception):
    pass


def link_key(category, name):
    """카카오 링크 파일의 키. 카테고리가 다르면 같은 상호도 다른 곳이다."""
    return f"{category}|{name}"


def load_links():
    """geocode_seeds.py 가 저장해 둔 카카오맵 링크. 없으면 빈 값으로 넘어간다."""
    if not LINKS_FILE.is_file():
        return {}
    try:
        data = json.loads(LINKS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"경고: {LINKS_FILE.name} 를 읽을 수 없어 무시합니다.", file=sys.stderr)
        return {}
    return data if isinstance(data, dict) else {}


def parse_seed(text, source_name):
    """씨드 텍스트를 항목 목록으로 바꾼다. 형식이 틀린 줄은 경고로 모아 함께 돌려준다."""
    entries = []
    warnings = []
    category = None

    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("[") and line.endswith("]"):
            category = line[1:-1].strip()
            if category not in CATEGORY_CODES:
                warnings.append(
                    f"{source_name}:{lineno} 알 수 없는 카테고리 [{category}] "
                    f"— 쓸 수 있는 값: {', '.join(CATEGORY_CODES)}"
                )
                category = None
            continue

        if category is None:
            warnings.append(f"{source_name}:{lineno} 카테고리 밖의 줄이라 건너뜁니다: {line}")
            continue

        fields = [f.strip() for f in line.split("|")]
        name = fields[0]
        if not name:
            warnings.append(f"{source_name}:{lineno} 장소명이 비어 있어 건너뜁니다")
            continue

        coords, coord_warning = _parse_coords(fields[1] if len(fields) > 1 else "")
        if coord_warning:
            warnings.append(f"{source_name}:{lineno} {coord_warning}")

        rating, rating_warning = _parse_rating(fields[2] if len(fields) > 2 else "")
        if rating_warning:
            warnings.append(f"{source_name}:{lineno} {rating_warning}")

        entries.append(
            {
                "name": name,
                "category": category,
                "lat": coords[0] if coords else None,
                "lng": coords[1] if coords else None,
                "rating": rating,
                "note": fields[3].strip() if len(fields) > 3 else "",
            }
        )

    return entries, warnings


def _parse_coords(value):
    """'33.4580,126.9427' -> (33.458, 126.9427). 비어 있으면 (None, None-경고없음)."""
    if not value:
        return None, None

    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 2:
        return None, f"좌표 형식이 '위도,경도' 가 아닙니다: {value!r}"

    try:
        lat, lng = float(parts[0]), float(parts[1])
    except ValueError:
        return None, f"좌표를 숫자로 읽을 수 없습니다: {value!r}"

    # 위도와 경도를 뒤집어 적는 실수가 잦다. 한국 범위를 벗어나면 짚어 준다.
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return None, f"좌표 범위를 벗어났습니다: {value!r}"
    if not (33 <= lat <= 39) or not (124 <= lng <= 132):
        return (lat, lng), f"좌표가 한국 밖을 가리킵니다. 위도·경도 순서를 확인하세요: {value!r}"

    return (lat, lng), None


def _parse_rating(value):
    if not value:
        return None, None
    try:
        rating = float(value)
    except ValueError:
        return None, f"평점을 숫자로 읽을 수 없습니다: {value!r}"
    if not (0 <= rating <= 5):
        return None, f"평점은 0~5 사이여야 합니다: {value!r}"
    return round(rating, 1), None


def load_seeds():
    if not SEED_DIR.is_dir():
        raise SeedError(f"씨드 폴더가 없습니다: {SEED_DIR}")

    seed_files = sorted(SEED_DIR.glob("*.txt"))
    if not seed_files:
        raise SeedError(f"씨드 파일(*.txt)이 없습니다: {SEED_DIR}")

    entries, warnings = [], []
    for path in seed_files:
        parsed, file_warnings = parse_seed(path.read_text(encoding="utf-8"), path.name)
        entries.extend(parsed)
        warnings.extend(file_warnings)
    return entries, warnings


# ── TourAPI ────────────────────────────────────────────────────────────────


def _request_json(path, params, api_key):
    query = urllib.parse.urlencode(
        {
            "serviceKey": api_key,
            "MobileOS": "ETC",
            "MobileApp": "NearbyPlaces",
            "_type": "json",
            **params,
        },
        safe="",
    )
    url = f"{TOUR_API_BASE}/{path}?{query}"
    with urllib.request.urlopen(url, timeout=15) as response:
        payload = response.read().decode("utf-8")

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        # 키가 잘못되면 JSON 대신 XML 에러 문서가 돌아온다.
        raise RuntimeError("TourAPI가 JSON이 아닌 응답을 보냈습니다. 서비스키를 확인하세요.")

    body = data.get("response", {}).get("body", {})
    items = body.get("items")
    if not items:  # 검색 결과가 없으면 items 가 빈 문자열로 온다
        return []
    item = items.get("item", [])
    return item if isinstance(item, list) else [item]


def _https(url):
    """TourAPI 이미지 URL은 http:// 로 오는 경우가 있다.

    배포 페이지가 HTTPS라 그대로 두면 혼합 콘텐츠로 차단돼 사진이 안 뜬다.
    visitkorea 이미지 서버는 https를 지원하므로 스킴만 올려 준다.
    """
    url = (url or "").strip()
    return "https://" + url[len("http://") :] if url.startswith("http://") else url


def _strip_html(text):
    """overview 에 <br> 같은 태그가 섞여 오므로 걷어내고 길이를 자른다."""
    plain = re.sub(r"<[^>]+>", " ", text or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) > SUMMARY_MAX_LEN:
        plain = plain[: SUMMARY_MAX_LEN - 1].rstrip() + "…"
    return plain


def enrich(entry, api_key):
    """TourAPI에서 좌표·사진·주소·요약을 찾아 채운다. 씨드에 적힌 값이 우선이다."""
    content_type = CONTENT_TYPE_IDS.get(entry["category"], "")
    items = _request_json(
        "searchKeyword2",
        {"keyword": entry["name"], "numOfRows": "5", "pageNo": "1", "arrange": "A"},
        api_key,
    )
    if not items:
        return False

    # 카테고리가 맞는 항목을 우선 고르고, 없으면 첫 번째를 쓴다.
    match = next((i for i in items if str(i.get("contenttypeid")) == content_type), items[0])

    # TourAPI도 카카오와 같은 함정이 있다: mapx가 경도, mapy가 위도다.
    if entry["lat"] is None or entry["lng"] is None:
        try:
            entry["lng"] = float(match["mapx"])
            entry["lat"] = float(match["mapy"])
        except (KeyError, TypeError, ValueError):
            pass

    if not entry.get("address"):
        entry["address"] = (match.get("addr1") or "").strip()
    if not entry.get("image"):
        entry["image"] = _https(match.get("firstimage"))

    content_id = match.get("contentid")
    if content_id and not entry.get("summary"):
        details = _request_json(
            "detailCommon2", {"contentId": content_id, "numOfRows": "1", "pageNo": "1"}, api_key
        )
        if details:
            entry["summary"] = _strip_html(details[0].get("overview", ""))

    return True


# ── 출력 ───────────────────────────────────────────────────────────────────


def to_record(entry, links=None):
    """앱이 읽는 형태로 바꾼다. 빈 값은 아예 넣지 않아 JSON을 가볍게 유지한다."""
    links = links or {}
    record = {
        "id": f"curated-{entry['category']}-{entry['name']}",
        "name": entry["name"],
        "category": entry["category"],
        "categoryCode": CATEGORY_CODES[entry["category"]],
        "lat": entry["lat"],
        "lng": entry["lng"],
    }
    for key in ("address", "image", "summary", "note"):
        value = (entry.get(key) or "").strip()
        if value:
            record[key] = value
    if entry.get("rating") is not None:
        record["rating"] = entry["rating"]

    # 카카오맵 상세 페이지 주소가 있으면 넣는다. 앱은 이 값이 있으면 좌표 링크 대신 쓴다.
    link = links.get(link_key(entry["category"], entry["name"]), {})
    place_url = _https(link.get("placeUrl", ""))
    if place_url:
        record["placeUrl"] = place_url
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description="씨드 파일로 web/data/places.json 을 만든다")
    parser.add_argument(
        "--skip-api", action="store_true", help="TOUR_API_KEY가 있어도 API 호출을 건너뛴다"
    )
    parser.add_argument(
        "--delay", type=float, default=0.2, help="API 호출 사이 간격(초). 기본 0.2"
    )
    args = parser.parse_args(argv)

    try:
        entries, warnings = load_seeds()
    except SeedError as error:
        print(f"오류: {error}", file=sys.stderr)
        return 1

    api_key = "" if args.skip_api else os.environ.get("TOUR_API_KEY", "").strip()

    if api_key:
        print(f"TourAPI로 {len(entries)}개 항목을 보강합니다…")
        failures = []
        for index, entry in enumerate(entries, 1):
            try:
                if not enrich(entry, api_key):
                    failures.append(entry["name"])
            except (urllib.error.URLError, RuntimeError, TimeoutError) as error:
                failures.append(f"{entry['name']} ({error})")
            if index % 10 == 0:
                print(f"  {index}/{len(entries)}")
            time.sleep(args.delay)
        if failures:
            warnings.append(
                f"TourAPI에서 찾지 못한 장소 {len(failures)}건: {', '.join(failures[:10])}"
                + (" …" if len(failures) > 10 else "")
            )
    else:
        print("TOUR_API_KEY가 없어 씨드에 적힌 값만으로 만듭니다. (사진·요약은 비어 있습니다)")

    # 좌표가 없으면 거리 계산을 할 수 없으므로 목록에서 뺀다.
    usable = [e for e in entries if e["lat"] is not None and e["lng"] is not None]
    missing = [e["name"] for e in entries if e["lat"] is None or e["lng"] is None]

    links = load_links()
    records = [to_record(e, links) for e in usable]
    records.sort(key=lambda r: (r["category"], r["name"]))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"places": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"\n{OUTPUT.relative_to(REPO_ROOT)} 생성 — {len(records)}곳")
    counts = {}
    for record in records:
        counts[record["category"]] = counts.get(record["category"], 0) + 1
    for category, count in sorted(counts.items()):
        with_image = sum(1 for r in records if r["category"] == category and r.get("image"))
        with_link = sum(1 for r in records if r["category"] == category and r.get("placeUrl"))
        print(f"  {category} {count}곳 (사진 {with_image}곳 · 카카오맵 링크 {with_link}곳)")

    for warning in warnings:
        print(f"경고: {warning}", file=sys.stderr)

    if missing:
        print(
            f"\n좌표가 없어 제외된 장소 {len(missing)}곳: {', '.join(missing[:10])}"
            + (" …" if len(missing) > 10 else ""),
            file=sys.stderr,
        )
        print(
            "  TOUR_API_KEY를 설정하고 다시 돌리거나, 씨드 파일에 좌표를 직접 적어 주세요.",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
