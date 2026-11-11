import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { AdminShell } from './admin-shell';
import { ProvidersPage } from '../features/providers/providers-page';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { element: <AdminShell />, children: [
    { path: '/providers', element: <ProvidersPage /> },
    { path: '/providers/:id', element: <ProvidersPage /> },
    { path: '*', element: <Navigate to="/providers" replace /> },
  ] },
]);
