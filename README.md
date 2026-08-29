# gittest

Claude Code + GitHub 워크플로우 실습 저장소. 현재 두 가지가 들어 있다.

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

원래 아이폰 네이티브 앱으로 시작했다가 웹앱으로 전환했다. 중단된 SwiftUI 시도는 [`archive/`](./archive/)에 남아 있다.

## 2. Python 계산기 (`calculator.py`)

GitHub 워크플로우 실습용 샘플.

```bash
python main.py
pytest test_calculator.py -v
```

- [GitHub 워크플로우 실습 가이드](./github_workflow_실습가이드.md)
