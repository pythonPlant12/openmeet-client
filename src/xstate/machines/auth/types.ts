export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface AuthContext {
  user: User | null;
  token: string | null;
  error: string | null;
}

export type AuthEvents =
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN' }
  | { type: 'RETRY' }
  | { type: 'CHECK_SESSION' };

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface AuthInput {
  initialToken?: string | null;
}
