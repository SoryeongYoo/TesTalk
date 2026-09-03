import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모노레포 내 packages/shared를 트랜스파일해서 그대로 사용
  transpilePackages: ["@speaksim/shared"],
};

export default nextConfig;
