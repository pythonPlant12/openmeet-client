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
  REGISTERING = 'registering',
  REGISTRATION_FAILED = 'registrationFailed',
}

export enum AuthEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  RETRY = 'RETRY',
  CHECK_SESSION = 'CHECK_SESSION',
  REGISTER = 'REGISTER',
  GO_TO_LOGIN = 'GO_TO_LOGIN',
  GO_TO_REGISTER = 'GO_TO_REGISTER',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface AuthContext {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  router?: Router;
}

export type AuthEvents =
  | { type: AuthEventType.LOGIN; email: string; password: string }
  | { type: AuthEventType.REGISTER; email: string; name: string; password: string }
  | { type: AuthEventType.LOGOUT }
  | { type: AuthEventType.REFRESH_TOKEN }
  | { type: AuthEventType.RETRY }
  | { type: AuthEventType.CHECK_SESSION }
  | { type: AuthEventType.GO_TO_LOGIN }
  | { type: AuthEventType.GO_TO_REGISTER };

export interface AuthInput {
  initialAccessToken?: string | null;
  initialRefreshToken?: string | null;
  router?: Router;
}
