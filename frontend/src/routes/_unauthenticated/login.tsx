import { createFileRoute } from '@tanstack/react-router';
import SignInPage from '../../features/auth/components/SignInPage';

export const Route = createFileRoute('/_unauthenticated/login')({
  component: SignInPage,
});
