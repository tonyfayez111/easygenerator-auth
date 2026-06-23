import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[a-zA-Z]/, 'Must contain at least one letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Must contain at least one special character');

export const signUpSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(3, 'Name must be at least 3 characters'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignUpPayload = Omit<SignUpFormData, 'confirmPassword'>;
export type SignInFormData = z.infer<typeof signInSchema>;

export interface AuthResponse {
  access_token: string;
}
