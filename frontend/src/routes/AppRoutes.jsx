import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PageLoader from '@/components/PageLoader';
import { useAuth } from '@/auth';
import {
  RequireAuth,
  LoginRoute,
  RegisterRoute,
  ForgotPasswordRoute,
} from '@/auth/routeGuards';
import AppShell from '@/layouts/AppShell';
import Dashboard from '@/pages/Dashboard';
import NewInspection from '@/pages/NewInspection';
import EditInspection from '@/pages/EditInspection';
import InspectionChecklist from '@/pages/InspectionChecklist';
import InspectionReview from '@/pages/InspectionReview';
import InspectionDetail from '@/pages/InspectionDetail';

/**
 * Enquanto Firebase não resolve a sessão inicial, não montamos `<Routes>` — evita loops / ↔ /login.
 */
export function AppRoutes() {
  const { authReady } = useAuth();

  if (!authReady) {
    return <PageLoader label="A preparar sessão…" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />
      <Route path="/forgot-password" element={<ForgotPasswordRoute />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-inspection" element={<NewInspection />} />
          <Route path="/inspection/:id" element={<InspectionDetail />} />
          <Route path="/inspection/:id/edit" element={<EditInspection />} />
          <Route path="/inspection/:id/checklist" element={<InspectionChecklist />} />
          <Route path="/inspection/:id/review" element={<InspectionReview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
