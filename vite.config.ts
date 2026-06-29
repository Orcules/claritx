import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
//import { componentTagger } from "lovable-tagger";

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
export default defineConfig(({ mode }) => {
  // Ensure backend env values are injected consistently.
  // Prevents runtime crash: "supabaseUrl is required".
  const fileEnv = loadEnv(mode, process.cwd(), "");

  // In some hosted preview environments, values may exist in process.env instead of env files.
  const projectId = process.env.VITE_SUPABASE_PROJECT_ID ?? fileEnv.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ??
    fileEnv.VITE_SUPABASE_URL ??
    (projectId ? `https://${projectId}.supabase.co` : undefined);
  const publishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Only define values when present; avoid replacing with undefined.
  const defineEnv: Record<string, string> = {};
  if (supabaseUrl) {
    defineEnv["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(supabaseUrl);
  }
  if (publishableKey) {
    defineEnv["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] =
      JSON.stringify(publishableKey);
  }
  if (projectId) {
    defineEnv["import.meta.env.VITE_SUPABASE_PROJECT_ID"] = JSON.stringify(projectId);
  }

  // Build plugins array
  const plugins: any[] = [react()];

  // if (mode === "development") {
  //   plugins.push(componentTagger());
  // }

  // Add prerendering in production build
  if (mode === "production") {
    // Note: @prerenderer/rollup-plugin requires async import
    // This is configured via the build process
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    define: defineEnv,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // SSR-like prerendering configuration for production builds
    // The actual prerendering is handled by a post-build script
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
