import { Center, Loader, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { useSlidingSession } from './features/auth/hooks';
import { queryClient } from './lib/queryClient';
import { router } from './lib/router';

function SessionManager() {
  useSlidingSession();
  return null;
}

function InnerApp() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications position="top-right" />
        <AuthProvider>
          <SessionManager />
          <InnerApp />
        </AuthProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
