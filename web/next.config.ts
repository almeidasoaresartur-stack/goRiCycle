import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/categoria/smartphones",
        destination: "/smartphones",
        permanent: true,
      },
      {
        source: "/categoria/tablets",
        destination: "/tablets",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
