/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the whole app (site + API + AI) ships as ONE container.
  // `next dev` still works normally for local development.
  output: "export",
};

module.exports = nextConfig;
