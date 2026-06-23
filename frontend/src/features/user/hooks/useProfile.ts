import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/useAuth';
import { userApi } from '../api/userApi';
import { userKeys } from '../queries/queryKeys';

export const useProfile = () => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: userKeys.me(),
    queryFn: userApi.getMe,
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });
};
