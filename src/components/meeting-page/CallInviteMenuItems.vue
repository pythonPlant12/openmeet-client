<script setup lang="ts">
import { CopyAnimated, Link2Animated, UserRoundPlusAnimated } from '@respeak/lucide-motion-vue';
import { Check } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';

// The invite and share items of a meeting, for any dropdown or submenu that offers them.
const props = defineProps<{
  meetingId: string;
  /** Inviting needs a session; conversation calls invite through their conversation instead. */
  inviteMode: 'enabled' | 'signedOut' | 'hidden';
}>();
const emit = defineEmits<{ (e: 'invite'): void }>();
const { t } = useI18n();

const copiedLink = ref(false);
const copiedId = ref(false);
const meetingLink = () => `${window.location.origin}/room/${props.meetingId}`;

function flash(flag: typeof copiedLink) {
  flag.value = true;
  setTimeout(() => {
    flag.value = false;
  }, 2000);
}

async function copyMeetingLink() {
  await navigator.clipboard.writeText(meetingLink());
  flash(copiedLink);
}

async function copyMeetingId() {
  await navigator.clipboard.writeText(props.meetingId);
  flash(copiedId);
}

function shareOnWhatsApp() {
  const text = t('meeting.controls.shareText', { link: meetingLink() });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnTelegram() {
  const text = t('meeting.controls.shareTitle');
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(meetingLink())}&text=${encodeURIComponent(text)}`,
    '_blank',
  );
}
</script>

<template>
  <template v-if="inviteMode !== 'hidden'">
    <DropdownMenuItem
      data-invite-people
      :disabled="inviteMode !== 'enabled'"
      class="data-[disabled]:cursor-not-allowed"
      @select="emit('invite')"
    >
      <LiquidMenuIcon class="mr-2" :animated="UserRoundPlusAnimated" />
      <span class="min-w-0">
        <span class="block">{{ t('meeting.controls.invitePeople') }}</span>
        <span v-if="inviteMode === 'signedOut'" class="block text-xs font-normal text-harbor-muted">{{
          t('meeting.controls.inviteSignIn')
        }}</span>
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </template>
  <DropdownMenuItem @click="copyMeetingLink">
    <LiquidMenuIcon class="mr-2" :animated="Link2Animated" />
    <span>{{ copiedLink ? t('meeting.controls.linkCopied') : t('meeting.controls.copyLink') }}</span>
    <Check v-if="copiedLink" class="ml-auto h-4 w-4 text-harbor-ink" />
  </DropdownMenuItem>
  <DropdownMenuItem @click="copyMeetingId">
    <LiquidMenuIcon class="mr-2" :animated="CopyAnimated" />
    <span>{{ copiedId ? t('meeting.controls.idCopied') : t('meeting.controls.copyId') }}</span>
    <Check v-if="copiedId" class="ml-auto h-4 w-4 text-harbor-ink" />
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem @click="shareOnWhatsApp">
    <img src="/icons/social-media/whatsapp.svg" class="mr-2 h-4 w-4" :alt="t('meeting.controls.shareWhatsApp')" />
    <span>{{ t('meeting.controls.shareWhatsApp') }}</span>
  </DropdownMenuItem>
  <DropdownMenuItem @click="shareOnTelegram">
    <img src="/icons/social-media/telegram.svg" class="mr-2 h-4 w-4" :alt="t('meeting.controls.shareTelegram')" />
    <span>{{ t('meeting.controls.shareTelegram') }}</span>
  </DropdownMenuItem>
</template>
