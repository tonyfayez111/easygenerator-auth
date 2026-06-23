import { IconLogout } from "@tabler/icons-react";
import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../../context/useAuth";
import { useLogout } from "../../auth/hooks/useLogout";
import { useProfile } from "../hooks/useProfile";

export default function DashboardPage() {
  const { logout: clearAuth } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const { data: profile, isLoading, error } = useProfile();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: async () => {
        await clearAuth();
        notifications.show({
          color: "blue",
          title: "Logged out",
          message: "You have been logged out successfully.",
        });
        navigate({ to: "/login" });
      },
      onError: async () => {
        await clearAuth();
        navigate({ to: "/login" });
      },
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Container size={480}>
          <Paper withBorder shadow="md" p={40} radius="md" ta="center">
            <Title order={2} mb="sm">
              Error Loading Profile
            </Title>
            <Alert color="red" mb="xl">
              {error instanceof Error
                ? error.message
                : "Failed to load profile data"}
            </Alert>
            <Group justify="center">
              <Button
                variant="default"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<IconLogout size={16} />}
                loading={logout.isPending}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Group>
          </Paper>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Container size={480}>
        <Paper withBorder shadow="md" p={40} radius="md" ta="center">
          <Text c="dimmed" size="lg" mb="xs">
            Welcome to the application.
          </Text>
          {profile && (
            <Title order={1} mb="xl">
              {profile.name}
            </Title>
          )}
          <Group justify="center">
            <Button
              variant="light"
              color="red"
              leftSection={<IconLogout size={16} />}
              loading={logout.isPending}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Group>
        </Paper>
      </Container>
    </div>
  );
}
