import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
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
import { useForm, useWatch } from "react-hook-form";
import { getApiErrorMessage } from "../api/authApi";
import { useAuth } from "../../../context/useAuth";
import { useSignUp } from "../hooks/useSignUp";
import { signUpSchema } from "../types/auth";
import type { SignUpFormData } from "../types/auth";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const signUp = useSignUp();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema) });

  const password = useWatch({ control, name: "password", defaultValue: "" });

  const onSubmit = ({ email, name, password }: SignUpFormData) => {
    signUp.mutate({ email, name, password }, {
      onSuccess: ({ access_token }) => {
        login(access_token);
        notifications.show({
          color: "green",
          title: "Account created!",
          message: "Your account has been created successfully. Welcome!",
        });
        navigate({ to: "/dashboard" });
      },
      onError: (error) => {
        notifications.show({
          color: "red",
          title: "Sign up failed",
          message: getApiErrorMessage(
            error,
            "Something went wrong. Please try again.",
          ),
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Container size={420} w="100%">
        <Title ta="center" fw={900} mb={30}>
          Create an account
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
            <TextInput
              label="Name"
              placeholder="Your name"
              required
              mb="md"
              {...register("name")}
              error={errors.name?.message}
            />
            <PasswordInput
              label="Password"
              placeholder="Min 8 chars, letter, number, special"
              required
              mb={4}
              {...register("password")}
              error={errors.password?.message}
            />
            <PasswordStrengthMeter password={password} />
            <PasswordInput
              label="Confirm password"
              placeholder="Repeat your password"
              required
              mt="md"
              mb="xl"
              {...register("confirmPassword")}
              error={errors.confirmPassword?.message}
            />
            <Group justify="center" align="center">
              <Text c="dimmed" size="sm">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in
                </Link>
              </Text>
              <Button type="submit" loading={signUp.isPending}>
                Create account
              </Button>
            </Group>
          </Box>
        </Paper>
      </Container>
    </div>
  );
}
