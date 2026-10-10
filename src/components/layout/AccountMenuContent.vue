<script setup lang="ts">
import { Check, Copy, LogOut } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { USER_STATUS_OPTIONS, userStatusOption } from '@/config/user-status.config';
import type { UserStatus } from '@/services/social-api';
import { AuthEventType } from '@/xstate/machines/auth/types';

// The signed-in user's account menu, shared by the navbar avatar and the dashboard account card.
const props = withDefaults(
  defineProps<{
    nickname: string | null;
    ownStatus: UserStatus | null;
    isNicknameCopied: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  }>(),
  { side: 'bottom', align: 'end' },
);
const emit = defineEmits<{
  (event: 'copy-nickname'): void;
  (event: 'set-status', status: UserStatus): void;
}>();

const { t } = useI18n();
const router = useRouter();
const { currentUser, isAuthenticating, isRegistering, isCheckingSession, state, send } = useAuth();
// The menu leads with the person's name, above their @nickname.
const accountName = computed(() => currentUser.value?.name?.trim() || t('nav.accountInformation'));
const ownStatusOption = computed(() => userStatusOption(props.ownStatus));
const isLoggingOut = computed(() => state.value.value === 'loggingOut');
const isAuthBusy = computed(
  () => isAuthenticating.value || isRegistering.value || isCheckingSession.value || isLoggingOut.value,
);
</script>

<template>
  <DropdownMenuContent
    :side="side"
    :align="align"
    :side-offset="12"
    class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
  >
    <DropdownMenuItem
      class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
      @select="router.push('/account')"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold">{{ accountName }}</span>
        <button
          v-if="nickname"
          type="button"
          tabindex="-1"
          data-copy-nickname
          class="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-md text-xs font-medium text-[#27595D] hover:text-[#08635F]"
          :aria-label="isNicknameCopied ? t('nav.nicknameCopied') : t('nav.copyNickname', { nickname: `@${nickname}` })"
          :title="isNicknameCopied ? t('nav.nicknameCopied') : undefined"
          @click.stop="emit('copy-nickname')"
        >
          <span class="truncate">@{{ nickname }}</span>
          <Check v-if="isNicknameCopied" class="size-3 shrink-0" />
          <Copy v-else class="size-3 shrink-0" />
        </button>
      </span>
    </DropdownMenuItem>
    <DropdownMenuItem
      class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
      @select="router.push('/dashboard')"
    >
      {{ t('common.dashboard') }}
    </DropdownMenuItem>
    <DropdownMenuItem
      class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
      @select="router.push({ path: '/dashboard', query: { panel: 'friends' } })"
    >
      {{ t('nav.friends') }}
    </DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        data-status-submenu
        class="harbor-floating-menu-item cursor-pointer gap-2 rounded-xl px-3 py-2.5"
      >
        <span class="size-2.5 shrink-0 rounded-full" :class="ownStatusOption.dotClass" />
        <span class="flex-1">{{ t('nav.status') }}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        class="harbor-action-menu min-w-56 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
      >
        <DropdownMenuItem
          v-for="option in USER_STATUS_OPTIONS"
          :key="option.value"
          :data-status-option="option.value"
          class="harbor-floating-menu-item cursor-pointer gap-3 rounded-xl px-3 py-2.5"
          @select="emit('set-status', option.value)"
        >
          <span class="size-2.5 shrink-0 rounded-full" :class="option.dotClass" />
          <span class="min-w-0 flex-1 font-semibold">{{ option.label }}</span>
          <Check v-if="option.value === ownStatus" class="size-4 text-[#0B7A75]" />
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSeparator class="my-1 bg-[#E5EFEC]" />
    <DropdownMenuItem
      class="cursor-pointer rounded-xl px-3 py-2.5 text-[#9D4636] focus:bg-[#FFF0EA] focus:text-[#9D4636]"
      :disabled="isAuthBusy"
      @select="send({ type: AuthEventType.LOGOUT })"
    >
      <LoadingRipple v-if="isLoggingOut" size="sm" />
      <LogOut v-else class="size-4" />
      {{ t('common.logOut') }}
    </DropdownMenuItem>
  </DropdownMenuContent>
</template>
