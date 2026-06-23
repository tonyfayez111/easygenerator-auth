import { createFileRoute } from '@tanstack/react-router';
import DashboardPage from '../../features/user/components/DashboardPage';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});
