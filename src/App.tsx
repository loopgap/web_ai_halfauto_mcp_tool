import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppStoreProvider } from "./store/AppStore";
import { ToastProvider } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { SkeletonList } from "./components/Skeleton";
import Layout from "./components/Layout";

// §50 Suspense/Fallback — 异步加载页面组件
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const WorkflowsPage = lazy(() => import("./pages/WorkflowsPage"));
const ConsolePage = lazy(() => import("./pages/ConsolePage"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const TargetsPage = lazy(() => import("./pages/TargetsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

/** §50 加载骨架屏 */
function PageFallback() {
  return (
    <div className="p-6">
      <SkeletonList count={4} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary fallbackMessage="应用发生了全局异常，请刷新重试">
      <AppStoreProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><Dashboard /></Suspense></ErrorBoundary>} />
                <Route path="/skills" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><SkillsPage /></Suspense></ErrorBoundary>} />
                <Route path="/workflows" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><WorkflowsPage /></Suspense></ErrorBoundary>} />
                <Route path="/console" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><ConsolePage /></Suspense></ErrorBoundary>} />
                <Route path="/archive" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><ArchivePage /></Suspense></ErrorBoundary>} />
                <Route path="/targets" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><TargetsPage /></Suspense></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><Suspense fallback={<PageFallback />}><SettingsPage /></Suspense></ErrorBoundary>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
