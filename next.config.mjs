import withPWAInit from "@ducanh2912/next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ request, url }) =>
          request.mode === "navigate" &&
          (url.pathname.startsWith("/dashboard") ||
            url.pathname.startsWith("/transactions") ||
            url.pathname.startsWith("/budgets")),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages-cache",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
}

export default withPWA(nextConfig)
