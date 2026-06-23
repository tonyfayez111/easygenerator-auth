import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Checkbox,
  Container,
  Group,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { getApiErrorMessage } from "../api/authApi";
import { useSignIn } from "../hooks/useSignIn";
import { useAuth } from "../../../context/useAuth";
import { signInSchema } from "../types/auth";
import type { SignInFormData } from "../types/auth";

export default function SignInPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const signIn = useSignIn();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = (data: SignInFormData) => {
    signIn.mutate(data, {
      onSuccess: ({ access_token }) => {
        login(access_token);
        notifications.show({
          color: "green",
          title: "Welcome back!",
          message: "You have been signed in successfully.",
          autoClose: 3000,
        });
        navigate({ to: "/dashboard" });
      },
      onError: (error) => {
        notifications.show({
          color: "red",
          title: "Sign in failed",
          message: getApiErrorMessage(error, "Invalid email or password."),
          autoClose: 5000,
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Container size={420} w="100%">
        <Title ta="center" fw={900} mb={30}>
          Welcome back
        </Title>

        <Paper withBorder shadow="md" p={30} radius="md">
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              required
              mb="md"
              {...register("email")}
              error={errors.email?.message}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              mb="md"
              {...register("password")}
              error={errors.password?.message}
            />
            <Controller
              name="rememberMe"
              control={control}
              render={({ field }) => (
                <Checkbox
                  label="Remember me"
                  mb="xl"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Group justify="space-between" align="center">
              <Button type="submit" loading={signIn.isPending}>
                Sign in
              </Button>
              <Text c="dimmed" size="sm">
                Don&apos;t have an account?{" "}
                <Link
                  to="/signup"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign up
                </Link>
              </Text>
            </Group>
          </Box>
        </Paper>
      </Container>
    </div>
  );
}
