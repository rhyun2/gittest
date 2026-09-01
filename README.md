# gittest

Claude Code + GitHub 워크플로우 실습 저장소. 현재 세 가지가 들어 있다.

## 1. 내 주변 관광지·맛집 웹앱 (`web/`)

현재 위치 주변의 관광지·맛집·카페를 가까운 순으로 보여주는 모바일 웹앱.
빌드 없는 정적 페이지 + 카카오맵 JavaScript SDK. 서버 없음.

🔗 **https://rhyun2.github.io/gittest/** — 아이폰에서는 이 주소로 접속한다.

```bash
cp web/js/config.example.js web/js/config.js   # 카카오 JavaScript 앱키 입력
python3 -m http.server 8000 -d web
```

- [실행·배포 방법](./web/README.md)
- [제품 요구사항 (PRD)](./docs/prd.md)
- [기술 설계](./docs/web-nearby-places-design.md)

원래 아이폰 네이티브 앱으로 시작했다가 웹앱으로 전환했고, 이후 네이티브 앱을 다시 만들었다(아래 2번). 중단됐던 첫 시도는 [`archive/`](./archive/)에 남아 있다.

## 2. 네이티브 iOS 앱 (`ios/NearbyPlaces/`)

같은 큐레이션 데이터를 쓰는 SwiftUI 앱. 웹앱이 배포한 `places.json` 을 내려받으므로 **API 키가 필요 없다.**
카카오 실시간 검색은 하지 않아 등록된 장소만 보여준다.

- [개발환경 구축 · 실행 방법](./ios/NearbyPlaces/README.md)

Mac과 Xcode가 필요하다. 아직 컴파일 검증은 되지 않았다.

## 3. Python 계산기 (`calculator.py`)

GitHub 워크플로우 실습용 샘플.

```bash
python main.py
pytest test_calculator.py -v
```

- [GitHub 워크플로우 실습 가이드](./github_workflow_실습가이드.md)
