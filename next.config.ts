import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Photographs are fetched by lib/card-texture, not by `<Image>`, so nothing
   * else in the stack gives them a cache policy: they are served as plain
   * static files, which means one conditional request each on a repeat visit.
   * Eight hundred round trips to be told nothing changed is slower on a phone
   * than the bytes would have been on a fast connection.
   *
   * `immutable`, because a request now carries its month's version stamp
   * (lib/photo-edition.ts) and a replaced photograph therefore arrives at a
   * URL nothing has seen. Without the stamp this was actively wrong: the
   * filenames are stable — cover.jpg stays cover.jpg when a better photograph
   * replaces it — so a phone that had loaded the placeholder plates went on
   * drawing them for a month after the real photographs shipped.
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
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
