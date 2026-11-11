import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginShell } from './login-shell';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginShell /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
