import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import DocumentsPage from "./pages/DocumentsPage";
import UsersPage from "./pages/UsersPage";
import Sidebar from "./components/Sidebar";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f3ee]">
      <Sidebar
        onNewChat={() => setRefreshKey((k) => k + 1)}
        refreshKey={refreshKey}
      />
      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route
            path="/chat"
            element={<ChatPage onSessionCreated={() => setRefreshKey((k) => k + 1)} />}
          />
          <Route
            path="/chat/:sessionId"
            element={<ChatPage onSessionCreated={() => setRefreshKey((k) => k + 1)} />}
          />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="grain">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
