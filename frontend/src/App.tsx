import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { QuickAddProvider } from "@/lib/quickadd";

const Analytics = lazy(() => import("@/pages/Analytics"));
const Budgets = lazy(() => import("@/pages/Budgets"));
const Chat = lazy(() => import("@/pages/Chat"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Login = lazy(() => import("@/pages/Login"));
const Settings = lazy(() => import("@/pages/Settings"));

function PageLoading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoading />;

  if (!user) return <Suspense fallback={<PageLoading />}><Login /></Suspense>;

  return (
    <Suspense fallback={<PageLoading />}>
      <QuickAddProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </QuickAddProvider>
    </Suspense>
  );
}
