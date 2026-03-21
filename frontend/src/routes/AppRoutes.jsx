import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from '@/auth';
import AppShell from '@/layouts/AppShell';
import AuthLayout from '@/layouts/AuthLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import NewInspection from '@/pages/NewInspection';
import EditInspection from '@/pages/EditInspection';
import InspectionChecklist from '@/pages/InspectionChecklist';
import InspectionReview from '@/pages/InspectionReview';
import InspectionDetail from '@/pages/InspectionDetail';

/**
 * Definição central das rotas: área pública (login) vs área autenticada (shell + páginas).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
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
