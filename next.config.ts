import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Photographs are fetched by lib/card-texture, not by `<Image>`, so nothing
   * else in the stack gives them a cache policy: they are served as plain
   * static files, which means one conditional request each on a repeat visit.
   * Eight hundred round trips to be told nothing changed is slower on a phone
   * than the bytes would have been on a fast connection.
   *
   * A month fresh, then served from cache while it is refreshed in the
   * background. `immutable` would be simpler and is what a content-hashed
   * filename would deserve, but these names are stable — cover.jpg stays
   * cover.jpg when a better photograph replaces it — and immutable means a
   * reader who has already seen the old one never gets the new one.
   *
   * Skipped in development, where the whole point is that re-importing a
   * photograph shows up on the next reload.
   */
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=31536000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
