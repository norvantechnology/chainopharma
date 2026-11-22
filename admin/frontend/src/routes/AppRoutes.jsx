import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import AdminLoginPage from "../pages/AdminLoginPage.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import UsersPage from "../pages/UsersPage.jsx";
import NoticeBarPage from "../pages/NoticeBarPage.jsx";
import { onAuthChanged, readAuth } from "../services/authStorage.js";

export function AppRoutes() {
  const [authed, setAuthed] = useState(Boolean(readAuth()?.refreshToken));

  useEffect(() => {
    return onAuthChanged(() => setAuthed(Boolean(readAuth()?.refreshToken)));
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={authed ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={authed ? <Navigate to="/dashboard" replace /> : <AdminLoginPage />} />
      <Route path="/dashboard" element={authed ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/users" element={authed ? <UsersPage /> : <Navigate to="/login" replace />} />
      <Route path="/notice-bar" element={authed ? <NoticeBarPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

