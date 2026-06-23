export interface AuthResponse {
  access_token: string;
}

export interface UserProfile {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SignUpPayload {
  email: string;
  name: string;
  password: string;
}

export interface SignInPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}
