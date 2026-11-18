import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite driver must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
