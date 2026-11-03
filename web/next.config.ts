import type { NextConfig } from "next";

// Static export for Cloudflare Pages.
const config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };
export default config;
