<script setup lang="ts">
import { Check, Link2, Mail, QrCode, Share } from 'lucide-vue-next';
import QRCode from 'qrcode';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { emailShareUrl, meetingLink, telegramShareUrl, whatsAppShareUrl } from '@/lib/meeting-share';

// The invite's row of share targets. Share opens the system share sheet and shows only where one exists.
const props = defineProps<{ meetingId: string }>();
const { t } = useI18n();

const link = () => meetingLink(props.meetingId);
const shareText = () => t('meeting.controls.shareText', { link: link() });
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const isCopied = ref(false);
const qrCode = ref<string | null>(null);
let copiedTimer: number | undefined;

async function shareLink() {
  try {
    await navigator.share({ title: t('meeting.controls.shareTitle'), text: shareText(), url: link() });
  } catch {
    // Closing the share sheet rejects; nothing was shared.
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(link());
  isCopied.value = true;
  window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => (isCopied.value = false), 2000);
}

async function toggleQrCode() {
  if (qrCode.value) {
    qrCode.value = null;
    return;
  }
  qrCode.value = await QRCode.toDataURL(link(), { margin: 1, width: 240 });
}

const openWhatsApp = () => window.open(whatsAppShareUrl(shareText()), '_blank');
const openTelegram = () => window.open(telegramShareUrl(link(), t('meeting.controls.shareTitle')), '_blank');
const emailUrl = () => emailShareUrl(t('meeting.controls.shareTitle'), shareText());
</script>

<template>
  <div class="space-y-3">
    <div class="flex gap-1 overflow-x-auto pb-1" data-share-row>
      <button v-if="canShare" type="button" class="call-share-target" data-share-target="share" @click="shareLink">
        <span class="call-share-icon"><Share /></span>{{ t('meeting.invite.share') }}
      </button>
      <button type="button" class="call-share-target" data-share-target="copy" @click="copyLink">
        <span class="call-share-icon"><Check v-if="isCopied" /><Link2 v-else /></span>
        {{ t(isCopied ? 'meeting.invite.copied' : 'meeting.invite.copyLink') }}
      </button>
      <button
        type="button"
        class="call-share-target"
        :aria-pressed="!!qrCode"
        data-share-target="qr"
        @click="toggleQrCode"
      >
        <span class="call-share-icon"><QrCode /></span>{{ t('meeting.invite.qrCode') }}
      </button>
      <button type="button" class="call-share-target" data-share-target="whatsapp" @click="openWhatsApp">
        <span class="call-share-icon"><img src="/icons/social-media/whatsapp.svg" alt="" /></span>WhatsApp
      </button>
      <button type="button" class="call-share-target" data-share-target="telegram" @click="openTelegram">
        <span class="call-share-icon"><img src="/icons/social-media/telegram.svg" alt="" /></span>Telegram
      </button>
      <a :href="emailUrl()" class="call-share-target" data-share-target="email">
        <span class="call-share-icon"><Mail /></span>{{ t('meeting.invite.email') }}
      </a>
    </div>
    <div v-if="qrCode" class="flex justify-center" data-share-qr>
      <img :src="qrCode" :alt="t('meeting.invite.qrAlt')" class="size-48 rounded-2xl bg-white p-2" />
    </div>
  </div>
</template>
