import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { getAccessToken } from '../api/axios';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    if (!getAccessToken()) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <Outlet />,
});
