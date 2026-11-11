import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { AdminShell } from './admin-shell';
import { ProvidersPage } from '../features/providers/providers-page';
import { AnnouncementsPage } from '../features/announcements/announcements-page';
import { AnnouncementDetailPage } from '../features/announcements/announcement-detail-page';
import { AnnouncementEditorPage } from '../features/announcements/announcement-editor-page';
import { FeedbackPage, FeedbackDetailPage } from '../features/feedback/feedback-page';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AdminShell />,
    children: [
      { path: '/providers', element: <ProvidersPage /> },
      { path: '/providers/:id', element: <ProvidersPage /> },
      { path: '/announcements', element: <AnnouncementsPage /> },
      { path: '/announcements/new', element: <AnnouncementEditorPage /> },
      { path: '/announcements/:id', element: <AnnouncementDetailPage /> },
      { path: '/announcements/:id/edit', element: <AnnouncementEditorPage /> },
      { path: '/feedbacks', element: <FeedbackPage /> },
      { path: '/feedbacks/:id', element: <FeedbackDetailPage /> },
      { path: '*', element: <Navigate to="/providers" replace /> },
    ],
  },
]);
