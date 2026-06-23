export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
} as const;
