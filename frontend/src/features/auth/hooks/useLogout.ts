import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

export const useLogout = () =>
  useMutation({ mutationFn: authApi.signOut });
