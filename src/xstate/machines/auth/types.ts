import type { Router } from 'vue-router';

export enum AuthState {
  CHECKING_SESSION = 'checkingSession',
  VALIDATING_SESSION = 'validatingSession',
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATION_FAILED = 'authenticationFailed',
  AUTHENTICATED = 'authenticated',
  REFRESHING_TOKEN = 'refreshingToken',
  LOGGING_OUT = 'loggingOut',
}

export enum AuthEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  RETRY = 'RETRY',
  CHECK_SESSION = 'CHECK_SESSION',
}

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
  router?: Router; // Vue Router
}

export type AuthEvents =
  | { type: AuthEventType.LOGIN; email: string; password: string }
  | { type: AuthEventType.LOGOUT }
  | { type: AuthEventType.REFRESH_TOKEN }
  | { type: AuthEventType.RETRY }
  | { type: AuthEventType.CHECK_SESSION };

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
  router?: Router; // Vue Router
}
