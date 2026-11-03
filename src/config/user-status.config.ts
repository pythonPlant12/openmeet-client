import { Ban, CircleCheck, Clock3, MinusCircle, Moon } from 'lucide-vue-next';
import type { Component } from 'vue';

import type { UserStatus } from '@/services/social-api';

export interface UserStatusOption {
  value: UserStatus;
  label: string;
  icon: Component;
  /** Background of the presence dot shown beside avatars while the user is online. */
  dotClass: string;
  borderClass: string;
  chipClass: string;
}

// One place for status names and colours, so menus, dots, and profile chips always agree.
export const USER_STATUS_OPTIONS: UserStatusOption[] = [
  {
    value: 'available',
    label: 'Online',
    icon: CircleCheck,
    dotClass: 'bg-[#2DA58F]',
    borderClass: 'border-[#2DA58F]',
    chipClass: 'bg-harbor-hover text-harbor-accent-hover',
  },
  {
    value: 'away',
    label: 'Away',
    icon: Clock3,
    dotClass: 'bg-[#D9A441]',
    borderClass: 'border-[#D9A441]',
    chipClass: 'bg-[#FFF8E8] text-[#80601D]',
  },
  {
    value: 'doNotDisturb',
    label: 'Do not disturb',
    icon: MinusCircle,
    dotClass: 'bg-harbor-danger',
    borderClass: 'border-harbor-danger',
    chipClass: 'bg-harbor-danger-soft text-harbor-danger-strong',
  },
  {
    value: 'sleeping',
    label: 'Sleeping',
    icon: Moon,
    dotClass: 'bg-[#6B7BC4]',
    borderClass: 'border-[#6B7BC4]',
    chipClass: 'bg-[#EEF0FA] text-[#3E4B8A]',
  },
  {
    value: 'offline',
    label: 'Appear offline',
    icon: Ban,
    dotClass: 'bg-harbor-waveform',
    borderClass: 'border-harbor-waveform',
    chipClass: 'bg-harbor-hover text-harbor-muted',
  },
];

export function userStatusOption(status: UserStatus | null | undefined) {
  return USER_STATUS_OPTIONS.find((option) => option.value === status) ?? USER_STATUS_OPTIONS[0]!;
}
