import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PortalLayout from "./components/layout/PortalLayout.jsx";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Announcements from "./pages/Announcements.jsx";
import CampusFeed from "./pages/CampusFeed.jsx";
import DocumentQueue from "./pages/DocumentQueue.jsx";
import StudentEndorsement from "./pages/StudentEndorsement.jsx";
import DocumentRepository from "./pages/DocumentRepository.jsx";
import StudentLeaders from "./pages/StudentLeaders.jsx";
import SaaChat from "./pages/SaaChat.jsx";
import Settings from "./pages/Settings.jsx";

/**
 * ONE APP, ONE ACCOUNT TYPE.
 * Unlike the Student & Alumni Portal, every signed-in account here is the
 * same type (users.type='offices'), so there's no RequireType branching —
 * every route below is available to any authorized office once signed in.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PortalLayout />}>
          <Route index element={<Home />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="campus-feed" element={<CampusFeed />} />
          <Route path="document-queue" element={<DocumentQueue />} />
          <Route path="student-endorsement" element={<StudentEndorsement />} />
          <Route path="document-repository" element={<DocumentRepository />} />
          <Route path="student-leaders" element={<StudentLeaders />} />
          {/* FAQ now lives in the floating help box; keep old bookmarks working. */}
          <Route path="faq" element={<Navigate to="/" replace />} />
          <Route path="saa-chat" element={<SaaChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
