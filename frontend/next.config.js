/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "a2.espncdn.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://rsms.me",
              "font-src 'self' https://rsms.me",
              // CHANGED: added a2.espncdn.com so images from that CDN aren't blocked
              // (it's already allowed for Next image optimization in remotePatterns above).
              "img-src 'self' data: https://flagcdn.com https://a.espncdn.com https://a2.espncdn.com",
              "media-src 'self' data: blob:",
              // CHANGED: added the deployed Azure backend origin so the browser is allowed to
              // call it. Without this, every API/RAG request to the backend is blocked by CSP.
              // localhost:8081 is kept so local dev still works.
              "connect-src 'self' https://sportscore-backend-ecaue6buc5bwf7at.northeurope-01.azurewebsites.net http://localhost:8081 https://site.api.espn.com https://sports.core.api.espn.com https://sportscore-sr1.service.signalr.net wss://sportscore-sr1.service.signalr.net",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;