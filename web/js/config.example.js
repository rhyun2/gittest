// 이 파일을 같은 폴더에 config.js 로 복사한 뒤 카카오 JavaScript 앱키를 넣으세요.
//
// 키 발급: 카카오 개발자 콘솔(developers.kakao.com)
//   내 애플리케이션 > 앱 키 > "JavaScript 키"   ← REST API 키가 아닙니다
//   제품 설정 > 카카오맵에서 카카오맵 API 활성화
//   앱 설정 > 플랫폼 > Web > 사이트 도메인에 아래 두 개를 등록
//     http://localhost:8000        (로컬 개발용)
//     https://<사용자>.github.io    (배포용)
//
// JavaScript 앱키는 브라우저에 그대로 노출될 수밖에 없습니다. 실제 방어선은
// 위의 "사이트 도메인" 등록이며, 등록하지 않은 도메인에서는 키가 있어도 동작하지 않습니다.
// 그래서 이 키는 저장소에 커밋해도 큰 문제가 없습니다. 다만 기본 설정에서는
// config.js를 .gitignore로 빼두고, 배포 시 GitHub Actions가 저장소 Secret으로
// 이 파일을 만들어 넣습니다. 자세한 내용은 web/README.md 참고.

export const KAKAO_JS_KEY = "여기에_JavaScript_앱키를_넣으세요";
