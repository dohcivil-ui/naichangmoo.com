import type { NextConfig } from "next";

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGIN ? [process.env.NEXT_ALLOWED_DEV_ORIGIN] : [];
const isHostingerTarget = process.env.DEPLOY_TARGET === "hostinger";

const nextConfig: NextConfig = {
  ...(isHostingerTarget ? { output: "standalone" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins
};

export default nextConfig;
