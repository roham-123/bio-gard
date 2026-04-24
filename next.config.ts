import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Recipe labels accept up to 50MB (see uploadRecipeLabelAction in actions.ts).
      // Note: Vercel's platform body-size limit per plan still applies on top of this.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
