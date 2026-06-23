import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

export const useSignIn = () =>
  useMutation({ mutationFn: authApi.signIn });
