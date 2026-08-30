#!/usr/bin/env python3
"""씨드 파일의 장소명으로 좌표를 찾아 그 자리에 채워 넣는다.

    KAKAO_REST_API_KEY=xxx python3 scripts/geocode_seeds.py --dry-run   # 먼저 확인
    KAKAO_REST_API_KEY=xxx python3 scripts/geocode_seeds.py             # 실제로 채우기

카카오 로컬 "키워드로 장소 검색"을 쓴다. TourAPI보다 국내 음식점·카페 커버리지가
훨씬 좋아서, 이름만 적어 둔 씨드를 채우는 데는 이쪽이 맞다.

브라우저가 아니라 이 PC에서 도는 스크립트라 CORS 제약이 없다.

주의: 여기 쓰는 키는 **REST API 키**다. 웹앱이 쓰는 JavaScript 키와 다르고,
도메인 제한이 걸리지 않으므로 진짜 비밀이다. 환경변수로만 넘기고 절대 커밋하지 않는다.
발급: 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키 > REST API 키
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# 같은 폴더의 build_places.py에서 씨드 파싱 규칙을 그대로 가져다 쓴다.
from build_places import CATEGORY_CODES, LINKS_FILE, SEED_DIR, _parse_coords, link_key, load_links

KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# 씨드 파일 맨 위에 둘 수 있는 지시자
#   #! region: 제주        → 검색어 앞에 붙여 동명이인을 줄인다
#   #! bbox: 33.1,126.1,33.6,127.0   → 이 범위 밖 결과는 거르고 다음 후보를 본다
META_PREFIX = "#!"


class GeocodeError(Exception):
    pass


def read_meta(lines):
    """씨드 파일 상단의 #! 지시자를 읽는다."""
    meta = {"region": "", "bbox": None}
    for raw in lines:
        line = raw.strip()
        if not line.startswith(META_PREFIX):
            continue
        body = line[len(META_PREFIX) :].strip()
        key, _, value = body.partition(":")
        key, value = key.strip().lower(), value.strip()

        if key == "region":
            meta["region"] = value
        elif key == "bbox":
            parts = [p.strip() for p in value.split(",")]
            if len(parts) != 4:
                raise GeocodeError(f"bbox 는 'minLat,minLng,maxLat,maxLng' 네 값이어야 합니다: {value!r}")
            try:
                meta["bbox"] = tuple(float(p) for p in parts)
            except ValueError:
                raise GeocodeError(f"bbox 값을 숫자로 읽을 수 없습니다: {value!r}")
    return meta


def in_bbox(lat, lng, bbox):
    if not bbox:
        return True
    min_lat, min_lng, max_lat, max_lng = bbox
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng


def search(name, category, region, api_key, use_category_filter=True):
    """카카오 키워드 검색. 후보 목록을 정확도 순으로 돌려준다."""
    params = {"query": f"{region} {name}".strip(), "size": "10"}
    if use_category_filter and category in CATEGORY_CODES:
        params["category_group_code"] = CATEGORY_CODES[category]

    request = urllib.request.Request(
        f"{KEYWORD_URL}?{urllib.parse.urlencode(params)}",
        headers={"Authorization": f"KakaoAK {api_key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise GeocodeError(
                "401 Unauthorized — REST API 키가 아니거나 카카오맵이 비활성화 상태입니다. "
                "JavaScript 키를 넣지 않았는지 확인하세요."
            )
        if error.code == 429:
            raise GeocodeError("429 — 호출 한도를 넘었습니다. 잠시 후 다시 시도하세요.")
        raise GeocodeError(f"HTTP {error.code}")

    return data.get("documents", [])


def pick(candidates, bbox):
    """bbox 안에 드는 첫 후보를 고른다.

    돌려주는 두 번째 값은 그때까지 범위 밖이라 건너뛴 후보 이름들이다.
    고르지 못했을 때(첫 값이 None) 실패 사유를 설명하는 데 쓴다.
    """
    outside = []
    for item in candidates:
        try:
            lng, lat = float(item["x"]), float(item["y"])
        except (KeyError, TypeError, ValueError):
            continue
        if in_bbox(lat, lng, bbox):
            return {
                "lat": lat,
                "lng": lng,
                "name": item.get("place_name", ""),
                "address": item.get("road_address_name") or item.get("address_name") or "",
                # 카카오맵 장소 상세 페이지. 사진·리뷰·영업시간이 있어 좌표 링크보다 낫다.
                "placeUrl": (item.get("place_url") or "").strip(),
            }, outside
        outside.append(item.get("place_name", "?"))
    return None, outside


def geocode_file(path, api_key, args, links):
    """파일 한 개를 처리하고 (새 줄 목록, 통계)를 돌려준다."""
    lines = path.read_text(encoding="utf-8").splitlines()
    meta = read_meta(lines)
    if meta["region"]:
        print(f"  지역 힌트: {meta['region']}")
    if meta["bbox"]:
        print(f"  좌표 범위: {meta['bbox']}")

    output = []
    category = None
    stats = {"filled": 0, "kept": 0, "failed": 0, "linked": 0}

    for raw in lines:
        line = raw.strip()

        if not line or line.startswith("#"):
            output.append(raw)
            continue

        if line.startswith("[") and line.endswith("]"):
            category = line[1:-1].strip()
            output.append(raw)
            continue

        fields = [f.strip() for f in line.split("|")]
        # 항상 네 칸으로 맞춘다. 뒤 칸이 없던 줄도 형식이 통일된다.
        fields += [""] * (4 - len(fields))
        name = fields[0]

        if not name or category not in CATEGORY_CODES:
            output.append(raw)
            continue

        existing, _ = _parse_coords(fields[1])
        key = link_key(category, name)

        # 좌표가 이미 있어도 카카오맵 링크가 없으면 한 번 더 조회한다.
        # 그래야 좌표만 채워 둔 기존 씨드에 링크가 뒤늦게 붙는다.
        needs_coords = existing is None or args.overwrite
        needs_link = key not in links or args.overwrite
        if not needs_coords and not needs_link:
            stats["kept"] += 1
            output.append(raw)
            continue

        try:
            candidates = search(name, category, meta["region"], api_key)
            match, outside = pick(candidates, meta["bbox"])

            # 카테고리로 좁혔더니 아무것도 안 나오면 조건을 풀고 한 번 더 본다.
            if match is None and not outside:
                candidates = search(name, category, meta["region"], api_key, use_category_filter=False)
                match, outside = pick(candidates, meta["bbox"])
        except GeocodeError as error:
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"    ✗ {name}: {error}", file=sys.stderr)
            stats["failed"] += 1
            output.append(raw)
            continue
        finally:
            time.sleep(args.delay)

        if match is None:
            reason = f"범위 밖 후보만 있음 ({', '.join(outside[:3])})" if outside else "검색 결과 없음"
            print(f"    ✗ {name}: {reason}", file=sys.stderr)
            stats["failed"] += 1
            output.append(raw)
            continue

        if match.get("placeUrl"):
            links[key] = {"placeUrl": match["placeUrl"], "matchedName": match["name"]}
            stats["linked"] += 1

        if not needs_coords:
            # 링크만 얻으러 온 경우다. 씨드 줄은 손대지 않는다.
            stats["kept"] += 1
            output.append(raw)
            continue

        fields[1] = f"{match['lat']:.6f},{match['lng']:.6f}"
        flag = "" if match["name"] == name else f"  ← '{match['name']}' 로 매칭"
        print(f"    ✓ {name:12} {fields[1]}  {match['address']}{flag}")
        stats["filled"] += 1
        output.append(" | ".join(fields).rstrip())

    return output, stats


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="씨드 파일의 장소명으로 좌표를 찾아 채운다 (카카오 키워드 검색)"
    )
    parser.add_argument("--dry-run", action="store_true", help="파일을 고치지 않고 결과만 보여준다")
    parser.add_argument(
        "--overwrite", action="store_true", help="이미 적힌 좌표도 검색 결과로 덮어쓴다"
    )
    parser.add_argument("--seed", type=Path, help="특정 씨드 파일 하나만 처리한다")
    parser.add_argument("--delay", type=float, default=0.15, help="호출 사이 간격(초). 기본 0.15")
    args = parser.parse_args(argv)

    api_key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    if not api_key:
        print(
            "오류: KAKAO_REST_API_KEY 환경변수가 없습니다.\n"
            "  카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키 > 'REST API 키' 를 복사해\n"
            "  KAKAO_REST_API_KEY=키값 python3 scripts/geocode_seeds.py 처럼 넘기세요.\n"
            "  (웹앱이 쓰는 JavaScript 키와 다른 키입니다. 이 키는 커밋하면 안 됩니다)",
            file=sys.stderr,
        )
        return 1

    seed_files = [args.seed] if args.seed else sorted(SEED_DIR.glob("*.txt"))
    if not seed_files:
        print(f"오류: 씨드 파일이 없습니다: {SEED_DIR}", file=sys.stderr)
        return 1

    links = load_links()
    total = {"filled": 0, "kept": 0, "failed": 0, "linked": 0}
    for path in seed_files:
        if not path.is_file():
            print(f"오류: 파일이 없습니다: {path}", file=sys.stderr)
            return 1

        print(f"\n{path.name}")
        try:
            output, stats = geocode_file(path, api_key, args, links)
        except GeocodeError as error:
            print(f"오류: {error}", file=sys.stderr)
            return 1

        for key in total:
            total[key] += stats[key]

        if args.dry_run:
            print(f"  (--dry-run 이라 파일은 그대로 둡니다)")
        elif stats["filled"]:
            path.write_text("\n".join(output) + "\n", encoding="utf-8")
            print(f"  {path.name} 갱신")

    if not args.dry_run and total["linked"]:
        LINKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        LINKS_FILE.write_text(
            json.dumps(links, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(f"\n{LINKS_FILE.relative_to(LINKS_FILE.parent.parent)} 갱신 — 총 {len(links)}곳")

    print(
        f"\n좌표 채움 {total['filled']}곳 · 이미 있어 건너뜀 {total['kept']}곳 · "
        f"실패 {total['failed']}곳 · 카카오맵 링크 {total['linked']}곳"
    )
    if total["failed"]:
        print("실패한 장소는 씨드 파일에 좌표를 직접 적어 주세요.", file=sys.stderr)
    if total["filled"] and not args.dry_run:
        print("이어서 python3 scripts/build_places.py 를 돌리면 places.json 이 갱신됩니다.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
