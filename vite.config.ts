import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isProd = process.env.NODE_ENV === "production";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react({
      // 生产环境移除 React DevTools，减小 bundle
      babel: isProd ? { plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]] } : undefined,
    }),
    tailwindcss(),
  ],

  // 路径别名
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@domain": resolve(__dirname, "src/domain"),
      "@hooks": resolve(__dirname, "src/hooks"),
      "@pages": resolve(__dirname, "src/pages"),
    },
  },

  // ── 构建优化 ──
  build: {
    // 目标浏览器：Tauri WebView 支持现代特性
    target: "es2021",
    // 减小 sourcemap（生产环境不生成）
    sourcemap: !isProd,
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
    // CSS 代码分割
    cssCodeSplit: true,
    // Minification: 使用 terser 获得更好的压缩率
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: isProd,
        drop_debugger: isProd,
        pure_funcs: isProd ? ["console.log", "console.debug", "console.trace"] : [],
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    // 手动分包策略 — 优化缓存利用率
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心单独打包（缓存稳定）
          "vendor-react": ["react", "react-dom"],
          // 路由
          "vendor-router": ["react-router-dom"],
          // Tauri API
          "vendor-tauri": ["@tauri-apps/api"],
          // 图标库（体积较大，单独分包）
          "vendor-icons": ["lucide-react"],
        },
        // 使用 hash 命名实现长期缓存
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    // 资产内联阈值 (小于 4KB 的资源内联为 base64)
    assetsInlineLimit: 4096,
  },

  // ── 开发服务器优化 ──
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/node_modules/**", "**/.git/**"],
    },
    // 预热常用模块
    warmup: {
      clientFiles: [
        "src/App.tsx",
        "src/store/AppStore.tsx",
        "src/domain/actions.ts",
        "src/components/Layout.tsx",
      ],
    },
  },

  // ── 依赖预构建优化 ──
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "lucide-react",
    ],
    // 排除 Tauri 原生模块
    exclude: ["@tauri-apps/api", "@tauri-apps/plugin-notification", "@tauri-apps/plugin-opener"],
  },

  // ── CSS 优化 ──
  css: {
    devSourcemap: true,
  },
}));
