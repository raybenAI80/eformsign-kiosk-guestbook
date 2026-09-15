/* 방명록 키오스크 설정 — 이 파일 한 곳만 고치면 된다.
 * URL 쿼리로 덮어쓰기: ?mode=thanks&sec=4&idle=30&abandon=180&countdown=5
 */
window.KIOSK_CONFIG = {
  // 이폼사인 회사 ID (회사 관리 > 회사 정보 > 기본 정보)
  companyId: '7095eb0672c246378eeb86cc90e6e1bd',

  // 국가 코드 (kr / jp / en …)
  countryCode: 'kr',

  // 템플릿 ID (템플릿 관리 > 설정 아이콘 클릭 후 URL의 form_id)
  templateId: '8844aae609b84078a59ef3118c64dab2',

  // 화면 상단에 띄울 이름/안내 (템플릿 이름과 별개로 자유 문구)
  title: '방문자 기록부',
  subtitle: '방문 정보를 입력하고 서명한 뒤 전송을 눌러 주세요.',

  // 외부 작성자(로그인하지 않은 방문자)로 열 때 쓰는 표시 이름
  visitorName: '방문자',

  // 'immediate' = 제출 즉시 새 작성 화면 / 'thanks' = 감사 화면 N초 후 새 작성 화면
  mode: 'thanks',

  // mode:'thanks' 일 때 감사 화면을 보여 줄 시간(초)
  thanksSeconds: 5,
  thanksMessage: '작성해 주셔서 감사합니다.',
  thanksSubMessage: '잠시 후 처음 화면으로 돌아갑니다.',

  // 무응답 리셋 — 두 기준을 따로 둔다. (idleResetSeconds: 0 이면 리셋 자체를 끔)
  //  · idleResetSeconds    : 아직 아무도 작성 프레임을 건드리지 않은 세션(= 빈 화면 방치) 기준.
  //  · abandonResetSeconds : 방문자가 작성 프레임에 한 번이라도 포커스를 준 뒤 기준.
  //    🔴 작성 프레임은 cross-origin iframe 이라 그 안의 터치·키 입력이 부모 창에 보이지 않는다.
  //       포커스가 프레임 안에 머무는 동안은 활동으로 간주해 카운트하지 않고,
  //       포커스가 프레임 밖으로 나간 시간만 abandon 으로 센다.
  //  두 경우 모두 리셋 countdownSeconds 초 전에 경고가 뜨고, 터치하면 취소된다.
  //  · countdownSeconds     : 리셋 직전 "계속 작성하시겠습니까?" 복귀 카운트다운 시간(초).
  idleResetSeconds: 120,
  abandonResetSeconds: 180,
  countdownSeconds: 5,

  // 이폼사인 화면 언어
  langCode: 'ko',

  // 임베딩 화면의 이폼사인 기본 헤더 노출 여부.
  // false 로 두면 '전송' 버튼이 사라지므로 별도 버튼을 직접 만들어야 한다 → 기본 true 권장.
  showHeader: true,

  // 전송 시 확인 팝업(메시지 입력) 숨김. 키오스크에서는 true 권장.
  hideRequestPopup: true,

  // 작성 화면에 미리 채워 둘 값(임베딩 prefill.fields). value 가 '@today' 면 오늘 날짜로 치환된다.
  // 🔴 방문일시는 OZR 날짜 컴포넌트가 스스로 오늘을 채우므로(OnInitialize SetDateTime) 비워 둔다.
  //    래퍼 prefill 로 날짜를 넣으면 "텍스트에 문자열 주입"이 되어 컴포넌트 기본값이 아니다.
  prefill: [],

  // 진단용 로그 패널 표시
  debug: false,
};
