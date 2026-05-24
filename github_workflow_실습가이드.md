# GitHub 전체 워크플로우 실습 가이드
> Python 계산기 프로젝트 `gittest`로 배우는 실전 Git + GitHub

---

## 📁 프로젝트 구조

```
gittest/
├── calculator.py       # 핵심 계산기 모듈
├── test_calculator.py  # pytest 테스트
├── main.py             # 실행 진입점
├── README.md           # 프로젝트 설명
└── .gitignore          # Git 제외 파일 목록
```

---

## PHASE 1 — 로컬 Git 초기화 & 첫 Commit

```bash
# 1-1. 폴더로 이동
cd gittest

# 1-2. Git 초기화
git init

# 1-3. 사용자 정보 설정 (처음 한 번만)
git config user.name "홍길동"
git config user.email "your@email.com"

# 1-4. 현재 상태 확인
git status

# 1-5. 모든 파일 스테이징
git add .

# 1-6. 첫 번째 커밋
git commit -m "feat: 기본 계산기 프로젝트 초기 구성"

# 1-7. 커밋 확인
git log --oneline
```

---

## PHASE 2 — GitHub 원격 저장소 연결 & Push

```bash
# 2-1. GitHub에서 'gittest' 이름으로 새 repo 생성
#      → github.com → New repository → gittest → Create (README 없이)

# 2-2. 원격 저장소 연결
git remote add origin https://github.com/[본인계정]/gittest.git

# 2-3. 기본 브랜치 이름 설정
git branch -M main

# 2-4. 첫 Push
git push -u origin main

# 2-5. 연결 확인
git remote -v
```

---

## PHASE 3 — 기능 브랜치 작업 (Branch → Commit → Push)

> 새 기능: `power()` 제곱 함수 추가

```bash
# 3-1. 기능 브랜치 생성 & 이동
git checkout -b feature/add-power-function

# 3-2. calculator.py 에 코드 추가
```

`calculator.py` 하단에 아래 추가:
```python
def power(base, exp):
    """거듭제곱을 계산합니다."""
    return base ** exp
```

```bash
# 3-3. test_calculator.py 에 테스트 추가
```

`test_calculator.py` 하단에 아래 추가:
```python
def test_power():
    assert power(2, 3) == 8
    assert power(5, 0) == 1
```

`test_calculator.py` 상단 import 수정:
```python
from calculator import add, subtract, multiply, divide, power
```

```bash
# 3-4. 테스트 실행 확인
pytest test_calculator.py -v

# 3-5. 변경사항 스테이징
git add calculator.py test_calculator.py

# 3-6. 커밋
git commit -m "feat: power() 거듭제곱 함수 추가 및 테스트"

# 3-7. 브랜치 Push
git push -u origin feature/add-power-function
```

---

## PHASE 4 — Pull Request 생성

```bash
# 방법 A: GitHub 웹에서 생성
# → github.com/[계정]/gittest
# → "Compare & pull request" 버튼 클릭
# → Title: "feat: 거듭제곱 함수 추가"
# → Description 작성 후 "Create pull request"

# 방법 B: gh CLI로 생성 (터미널에서)
gh pr create \
  --title "feat: 거듭제곱 함수 추가" \
  --body "power() 함수와 테스트 코드를 추가했습니다." \
  --base main \
  --head feature/add-power-function

# PR 목록 확인
gh pr list

# PR 상세 확인
gh pr view
```

---

## PHASE 5 — 코드 리뷰 & 수정 반영

```bash
# 리뷰어가 "음수 지수도 처리해야 함" 코멘트를 남겼다고 가정

# 5-1. 같은 브랜치에서 코드 수정
```

`calculator.py`의 `power()` 함수 수정:
```python
def power(base, exp):
    """거듭제곱을 계산합니다. 음수 지수도 지원."""
    if not isinstance(exp, int):
        raise TypeError("지수는 정수여야 합니다.")
    return base ** exp
```

```bash
# 5-2. 추가 커밋
git add calculator.py
git commit -m "fix: power() 타입 검증 추가"

# 5-3. 같은 PR에 자동 반영 (같은 브랜치라 Push만 하면 됨)
git push
```

---

## PHASE 6 — Merge & 정리

```bash
# 6-1. PR Merge (GitHub 웹 또는 CLI)
gh pr merge --squash --delete-branch

# 6-2. 로컬 main 최신화
git checkout main
git pull origin main

# 6-3. 로컬 기능 브랜치 삭제
git branch -d feature/add-power-function

# 6-4. 최종 로그 확인
git log --oneline --graph
```

---

## PHASE 7 — Issue 트래킹 연동 (보너스)

```bash
# 7-1. 이슈 생성 (버그 발견 시)
gh issue create \
  --title "divide() 소수점 결과 포맷 개선 필요" \
  --body "10/3 결과가 3.3333... 으로 나옴. 소수점 2자리로 제한 필요"

# 7-2. 이슈 번호 확인 후 브랜치명에 반영
git checkout -b fix/issue-1-divide-format

# 7-3. 수정 후 커밋 메시지에 이슈 번호 포함
git commit -m "fix: divide() 소수점 2자리 반올림 처리 closes #1"
# → Merge 시 이슈 자동 닫힘
```

---

## Claude Code로 자동화하기 (GitHub MCP 연결 후)

```
# Claude Code 에서 자연어로 요청 가능

"현재 브랜치의 변경사항을 분석하고 PR 설명을 작성해줘"

"이슈 #1을 읽고 수정 코드를 작성해서 새 브랜치에 커밋해줘"

"main 브랜치와 현재 브랜치의 diff를 요약해줘"

"테스트가 실패하는 이유를 분석하고 수정해줘"
```

---

## 전체 워크플로우 요약

```
이슈 생성 → 브랜치 생성 → 코드 작성 → 테스트
    → Commit → Push → PR 생성 → 코드 리뷰
        → 수정 반영 → Merge → 브랜치 정리
```

---

## 자주 쓰는 Git 명령어 치트시트

| 명령어 | 설명 |
|--------|------|
| `git status` | 현재 변경사항 확인 |
| `git log --oneline --graph` | 커밋 히스토리 시각화 |
| `git diff` | 수정 내용 확인 |
| `git stash` | 작업 임시 저장 |
| `git stash pop` | 임시 저장 복구 |
| `git reset HEAD~1` | 마지막 커밋 취소 |
| `git checkout -- .` | 변경사항 전체 되돌리기 |
| `gh pr list` | PR 목록 |
| `gh issue list` | 이슈 목록 |
