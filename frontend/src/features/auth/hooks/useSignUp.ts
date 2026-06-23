import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

export const useSignUp = () =>
  useMutation({ mutationFn: authApi.signUp });
