import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Pre-render routes for SEO - static HTML generation at build time
// Canonical list lives in scripts/prerender.js; this copy is for reference only.
const prerenderRoutes = [
  "/",
  "/blog",
  "/ai-stock-rank",
  "/ai-stock-analysis",
  "/ai-stock-analysis-guide",
  "/market-opportunities",
  "/portfolio-simulator",
  "/pricing",
  "/about",
  "/stocks",
  "/disclaimer",
  "/privacy",
  "/terms",
];

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // SSR-like prerendering is handled by the post-build scripts in scripts/
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('aws-amplify') || id.includes('@aws-amplify')) return 'vendor-amplify';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
              if (id.includes('@radix-ui')) return 'vendor-radix';
              if (id.includes('react-router')) return 'vendor-router';
              if (id.includes('@tanstack')) return 'vendor-query';
            }
          },
        },
      },
    },
    // Expose prerender routes for build scripts
    __prerenderRoutes: prerenderRoutes,
  };
});
