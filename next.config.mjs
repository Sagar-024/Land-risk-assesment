/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/assess",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
