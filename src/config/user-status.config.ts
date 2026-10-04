import { Ban, CircleCheck, Clock3, MinusCircle, Moon } from 'lucide-vue-next';
import type { Component } from 'vue';

import type { UserStatus } from '@/services/social-api';

export interface UserStatusOption {
  value: UserStatus;
  label: string;
  icon: Component;
  /** Background of the presence dot shown beside avatars while the user is online. */
  dotClass: string;
  chipClass: string;
}

// One place for status names and colours, so menus, dots, and profile chips always agree.
export const USER_STATUS_OPTIONS: UserStatusOption[] = [
  {
    value: 'available',
    label: 'Online',
    icon: CircleCheck,
    dotClass: 'bg-[#2DA58F]',
    chipClass: 'bg-[#EAF7F4] text-[#17645F]',
  },
  {
    value: 'away',
    label: 'Away',
    icon: Clock3,
    dotClass: 'bg-[#D9A441]',
    chipClass: 'bg-[#FFF8E8] text-[#80601D]',
  },
  {
    value: 'doNotDisturb',
    label: 'Do not disturb',
    icon: MinusCircle,
    dotClass: 'bg-[#C4513D]',
    chipClass: 'bg-[#FFF0EA] text-[#9D4636]',
  },
  {
    value: 'sleeping',
    label: 'Sleeping',
    icon: Moon,
    dotClass: 'bg-[#6B7BC4]',
    chipClass: 'bg-[#EEF0FA] text-[#3E4B8A]',
  },
  {
    value: 'offline',
    label: 'Appear offline',
    icon: Ban,
    dotClass: 'bg-[#B8C6C5]',
    chipClass: 'bg-[#F0F4F3] text-[#61777B]',
  },
];

export function userStatusOption(status: UserStatus | null | undefined) {
  return USER_STATUS_OPTIONS.find((option) => option.value === status) ?? USER_STATUS_OPTIONS[0]!;
}
