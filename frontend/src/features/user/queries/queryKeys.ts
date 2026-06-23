export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  byId: (id: string) => [...userKeys.all, id] as const,
};
