import { ApiClient } from '../../../api/axios';
import type { AuthResponse, SignInFormData, SignUpPayload } from '../types/auth';

export const authApi = {
  signUp: (payload: SignUpPayload) =>
    ApiClient.post<AuthResponse>('/auth/signup', payload),

  signIn: (payload: SignInFormData) =>
    ApiClient.post<AuthResponse>('/auth/signin', payload),

  refreshToken: () =>
    ApiClient.post<AuthResponse>('/auth/refresh'),

  signOut: () =>
    ApiClient.post('/auth/logout'),
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as {
    response?: { data?: { message?: unknown; error?: unknown } };
    message?: string;
  };
  const message =
    axiosError?.response?.data?.message ||
    axiosError?.response?.data?.error ||
    axiosError?.message ||
    fallback;

  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return fallback;
}
