import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. There's a stray package-lock.json sitting in the
  // home directory (~/package-lock.json), and with multiple lockfiles in the
  // tree Turbopack was inferring ~ as the project root instead of this repo.
  // That widens file tracing to the whole home directory and can pull the
  // wrong node_modules, so we state the root explicitly.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
