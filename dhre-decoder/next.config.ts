import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "Set-Cookie",
            value: "Path=/; SameSite=None; Secure",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
