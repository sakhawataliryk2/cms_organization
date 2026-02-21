import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // pdfjs-dist is client-only (react-pdf). Server PDF text extraction uses unpdf (serverless-safe).
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // Allow document uploads up to 10MB (must match backend multer limit)
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/auth/login',
        permanent: true,
      },
      {
        source: '/dashboard/jobs-direct-hire/add',
        destination: '/dashboard/jobs/add/direct-hire',
        permanent: true,
      },
      {
        source: '/dashboard/jobs-executive-search/add',
        destination: '/dashboard/jobs/add/executive-search',
        permanent: true,
      },
      // Redirect old jobs/add?type=contract to jobs/add/contract (query params preserved)
      {
        source: '/dashboard/jobs/add',
        destination: '/dashboard/jobs/add/contract',
        permanent: false,
        has: [{ type: 'query', key: 'type', value: 'contract' }],
      },
    ];
  },
};

export default nextConfig;