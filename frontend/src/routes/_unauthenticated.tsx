import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { getAccessToken } from '../api/axios';

export const Route = createFileRoute('/_unauthenticated')({
  beforeLoad: () => {
    if (getAccessToken()) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: () => <Outlet />,
});
