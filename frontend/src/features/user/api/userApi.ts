import { ApiClient } from '../../../api/axios';
import type { UserProfile } from '../types/user';

export const userApi = {
  getMe: () =>
    ApiClient.get<UserProfile>('/users/me'),

  getById: (id: string) =>
    ApiClient.get<UserProfile>(`/users/${id}`),
};
