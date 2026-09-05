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
      {
        source: "/produto/:family-1000gb-recondicionado",
        destination: "/produto/:family-1024gb-recondicionado",
        permanent: true,
      },
      {
        source: "/produto/ipad-pro-2021-8gb-recondicionado",
        destination: "/produto/ipad-pro-2021-256gb-recondicionado",
        permanent: true,
      },
      {
        source: "/produto/ipad-pro-2022-8gb-recondicionado",
        destination: "/produto/ipad-pro-2022-recondicionado",
        permanent: true,
      },
      {
        source: "/produto/ipad-pro-2021-2000gb-recondicionado",
        destination: "/tablets",
        permanent: true,
      },
      {
        source: "/produto/iphone-17-pro-max-2000gb-recondicionado",
        destination: "/marca/apple",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
