/**
 * 전자상거래법(제10조, 제13조)상 사이버몰 필수 표시사항.
 * 푸터·약관 페이지가 이 값만 참조하므로, 사업자 정보가 확정/변경되면 여기 값만 바꾼다.
 * 아직 정해지지 않은 항목은 "[미정]"/"신고 예정"으로 둔다.
 */
export const BUSINESS_INFO = {
  /** 상호 */
  companyName: "테스톡",
  /** 대표자명 */
  ceoName: "유소령",
  /** 사업장 주소 */
  address: "서울특별시 강서구 화곡로 350",
  /** 전화번호 */
  phone: "010-9109-5524",
  /** 이메일 */
  email: "testalkadmin@gmail.com",
  /** 사업자등록번호 */
  businessRegistrationNumber: "789-55-00971",
  /** 통신판매업 신고번호 — 정부24 신고 완료 후 "제 0000-지역-0000 호" 형식으로 교체 */
  mailOrderSalesNumber: "신고 예정",
  /** 개인정보보호책임자 */
  privacyOfficer: "유소령",
  /** 개인정보보호책임자 연락처 */
  privacyOfficerEmail: "soryung00@gmail.com",
  /** 호스팅 서비스 제공자 */
  hostingProvider: "Amazon Web Services, Inc.",
} as const;
