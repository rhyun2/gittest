# archive — 중단된 iOS 네이티브 시도

`내 주변 관광지·맛집` 앱을 처음에 SwiftUI 네이티브로 만들다가, 개발 진입 장벽(Xcode·Swift·서명·심사)이 높아 **모바일 웹앱으로 전환하면서 중단**했다.

- `ios-nearby-places-design.md` — iOS 기준 설계 검토 문서
- `ios-nearby-places/` — SwiftUI 1단계 앱 (빌드 검증은 하지 못했다)

제품 목표와 데이터 소스 선택(카카오)은 웹 버전에도 그대로 이어졌고, 위치 획득 규칙·좌표 재사용 규칙·폴백 처리 같은 로직도 `web/`으로 옮겼다. 두 버전의 구조 대응표는 [기술 설계 문서 2절](../docs/web-nearby-places-design.md#2-ios-네이티브에서-무엇이-어떻게-바뀌었나)에 있다.

**이 코드는 나중에 되살아났다.** 웹앱이 자리를 잡은 뒤 `ios/NearbyPlaces/` 로 옮겨 다시 만들었다.
다만 데이터 소스가 바뀌었다 — 카카오 REST를 직접 부르는 대신 웹앱이 배포한 `places.json` 을 받아 쓴다.
그래서 새 앱에는 API 키가 필요 없고, `AppSecrets.swift` 와 `Secrets.xcconfig` 도 사라졌다.

이 폴더는 그 전환 과정을 남긴 기록이다. 참고용이며 유지보수하지 않는다.
