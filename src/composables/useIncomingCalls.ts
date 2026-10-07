import { type InjectionKey, type Ref, inject } from 'vue';

import type { CallInvitation, CallSessionNotification } from '@/services/social-api';

/** A call ringing for the current user: a legacy direct call or a call started from a conversation. */
export type IncomingCall =
  | { kind: 'invitation'; id: string; call: CallInvitation }
  | { kind: 'session'; id: string; call: CallSessionNotification };

export interface IncomingCalls {
  calls: Readonly<Ref<readonly IncomingCall[]>>;
  accept: (call: IncomingCall) => Promise<void>;
  decline: (call: IncomingCall) => Promise<void>;
}

// App.vue polls incoming calls and owns answering them; pages show the ringing calls.
export const incomingCallsKey: InjectionKey<IncomingCalls> = Symbol('incomingCalls');

export function useIncomingCalls() {
  const incomingCalls = inject(incomingCallsKey);
  if (!incomingCalls) throw new Error('useIncomingCalls must be used inside App');
  return incomingCalls;
}
