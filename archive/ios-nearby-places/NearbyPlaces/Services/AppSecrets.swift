import Foundation

/// API 키를 Info.plist를 거쳐 읽는다.
///
/// 키는 소스에 하드코딩하지 않고 `Config/Secrets.xcconfig`(gitignore 대상)에 두고,
/// `Config/Info.plist`의 `$(KAKAO_REST_API_KEY)`로 주입한다.
/// 키가 없으면 크래시 대신 nil을 돌려주고, 앱이 설정 안내 화면을 띄운다.
enum AppSecrets {
    /// `Secrets.xcconfig.example`에 들어 있는 자리표시자. 이대로 두면 키가 없는 것으로 취급한다.
    private static let placeholder = "여기에_REST_API_키를_넣으세요"

    static var kakaoRestAPIKey: String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "KakaoRestAPIKey") as? String else {
            return nil
        }
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        // xcconfig에 값이 없으면 빈 문자열로, 파일 자체가 없으면 치환되지 않은 채로 남을 수 있다.
        guard !key.isEmpty, key != placeholder, !key.hasPrefix("$(") else { return nil }
        return key
    }
}
