import type { NextConfig } from "next";

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGIN ? [process.env.NEXT_ALLOWED_DEV_ORIGIN] : [];
const isHostingerTarget = process.env.DEPLOY_TARGET === "hostinger";

const nextConfig: NextConfig = {
  ...(isHostingerTarget ? { output: "standalone" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins,
  images: {
    /**
     * Google serves a member's avatar from this host. Listing it lets the image go through Next's
     * optimizer, which means our server fetches it and the member's browser never announces itself
     * to Google on every page of ours that they open. One host, one purpose — anything else added
     * here is a new party learning when our pages are viewed.
     */
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" }]
  }
};

export default nextConfig;
