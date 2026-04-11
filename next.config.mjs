import withPWAInit from "@ducanh2912/next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    cleanupOutdatedCaches: true,
    importScripts: ["sw-privacy-cleanup.js"],
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
            url.pathname.startsWith("/budgets") ||
            url.pathname.startsWith("/settings") ||
            url.pathname.startsWith("/banks")),
        handler: "NetworkOnly",
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
}

export default withPWA(nextConfig)
