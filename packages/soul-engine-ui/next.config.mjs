/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/s/opensouls/reggie/:path*",
        destination: "https://reggie-is-regex-opensouls.vercel.app/:path*",
      },
      {
        source: "/s/opensouls/cranky/:path*",
        destination: "https://cranky-opensouls.vercel.app/:path*",
      },
      {
        source: "/s/opensouls/thinking-meme/:path*",
        destination: "https://thinking-meme-opensouls.vercel.app/:path*",
      },
      {
        source: "/s/opensouls/mischief/:path*",
        destination: "https://yellow-guy.vercel.app/:path*",
      },
      {
        source: "/s/opensouls/milton-is-trapped/:path*",
        destination: "https://milton-opensouls.vercel.app/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'souls.chat',
        port: '',
        pathname: '/s/**',
      },
    ],
  },
};

export default nextConfig;
