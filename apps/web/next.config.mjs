/** @type {import('next').NextConfig} */
const nextConfig = {
  // 모노레포 내 packages/shared를 트랜스파일해서 그대로 사용
  transpilePackages: ["@testalk/shared"],
  // Amplify Hosting 배포 시 루트 node_modules 전체를 옮기지 않도록, 실행에 필요한
  // 의존성만 추적해서 .next/standalone에 모은다 (모노레포 배포 아티팩트 최소화).
  //
  // ⚠️ 로컬(Windows)에서는 pnpm의 심볼릭 링크 기반 node_modules 구조를 standalone
  // 산출물로 복사하는 과정(next build의 파일 추적 단계)이 EPERM으로 실패할 수 있다 —
  // Windows가 심볼릭 링크 생성에 관리자 권한/개발자 모드를 요구하기 때문이다.
  // Amplify의 빌드 환경은 Linux라 이 제약이 없어 정상 동작할 것으로 예상되지만,
  // 로컬에서 최종 검증은 못 했다 — 실제 Amplify 빌드 로그에서 꼭 확인할 것.
  output: "standalone",
};

export default nextConfig;
