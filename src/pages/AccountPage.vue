<script setup lang="ts">
import { ArrowLeft, Camera } from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { socialApi } from '@/services/social-api';

const router = useRouter();
const { t } = useI18n();
const { accessToken, currentUser, isAuthenticated, isCheckingSession } = useAuth();

const name = ref('');
const nickname = ref('');
const email = ref('');
const statusMessage = ref('');
const avatarUrl = ref<string | null>(null);
const isLoadingProfile = ref(false);
const isSaving = ref(false);
const profileError = ref('');
let profileRequest = 0;
let avatarObjectUrl: string | null = null;

const initials = computed(
  () =>
    name.value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?',
);

watch(
  [currentUser, accessToken, isAuthenticated, isCheckingSession],
  ([user, token, authenticated, checking]) => {
    if (!checking && !authenticated) {
      void router.replace('/login');
      return;
    }
    if (!user || !token) return;

    name.value = user.name;
    nickname.value = user.nickname;
    email.value = user.email;
    profileError.value = '';
    const request = ++profileRequest;
    isLoadingProfile.value = true;

    void socialApi
      .getCurrentUserProfile(token)
      .then((profile) => {
        if (request !== profileRequest) return;
        name.value = profile.name;
        email.value = profile.email;
        nickname.value = profile.nickname;
        void loadAvatar(profile.avatarUrl);
        statusMessage.value = profile.statusMessage;
      })
      .catch((error) => {
        console.error('[Account] Failed to load profile:', error);
        if (request === profileRequest) profileError.value = t('account.profileUnavailable');
      })
      .finally(() => {
        if (request === profileRequest) isLoadingProfile.value = false;
      });
  },
  { immediate: true },
);

async function handleProfileSave() {
  if (!accessToken.value) return;
  isSaving.value = true;
  profileError.value = '';
  try {
    const profile = await socialApi.updateCurrentUserProfile(accessToken.value, {
      name: name.value,
      nickname: nickname.value,
      statusMessage: statusMessage.value,
    });
    name.value = profile.name;
    nickname.value = profile.nickname;
    statusMessage.value = profile.statusMessage;
    window.dispatchEvent(new Event('openmeet:profile-updated'));
  } catch (error) {
    console.error('[Account] Failed to update profile:', error);
    profileError.value = error instanceof Error ? error.message : t('account.profileUnavailable');
  } finally {
    isSaving.value = false;
  }
}

async function loadAvatar(path: string | null) {
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
  avatarObjectUrl = null;
  avatarUrl.value = null;
  if (!path || !accessToken.value) return;

  try {
    avatarObjectUrl = URL.createObjectURL(await socialApi.loadAvatar(accessToken.value, path));
    avatarUrl.value = avatarObjectUrl;
  } catch (error) {
    console.error('[Account] Failed to load avatar:', error);
  }
}

async function handleAvatarChange(event: Event) {
  const avatar = (event.target as HTMLInputElement).files?.[0];
  if (!avatar || !accessToken.value) return;
  isSaving.value = true;
  profileError.value = '';
  try {
    const profile = await socialApi.uploadCurrentUserAvatar(accessToken.value, avatar);
    await loadAvatar(profile.avatarUrl);
    window.dispatchEvent(new Event('openmeet:profile-updated'));
  } catch (error) {
    console.error('[Account] Failed to upload avatar:', error);
    profileError.value = error instanceof Error ? error.message : t('account.profileUnavailable');
  } finally {
    isSaving.value = false;
    (event.target as HTMLInputElement).value = '';
  }
}

onBeforeUnmount(() => {
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
});
</script>

<template>
  <main class="marketing-font min-h-[calc(100dvh-84px)] bg-[#FBFCF8] px-4 pb-10 pt-3 text-[#102F35] sm:px-6 sm:pt-6">
    <div v-if="isCheckingSession" class="flex min-h-[calc(100dvh-132px)] items-center justify-center">
      <LoadingRipple class="size-8 text-[#0B7A75]" />
      <span class="sr-only">{{ t('common.loading') }}</span>
    </div>

    <motion.section
      v-else-if="isAuthenticated"
      :initial="{ opacity: 0, y: 12 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }"
      class="mx-auto max-w-5xl"
    >
      <button
        type="button"
        class="harbor-ghost-action inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
        @click="router.push('/dashboard')"
      >
        <ArrowLeft class="size-4" />
        {{ t('account.backToDashboard') }}
      </button>

      <div
        class="mt-6 overflow-hidden rounded-[2rem] border border-[#D8E7E3] bg-white shadow-[0_24px_70px_rgba(16,47,53,0.09)]"
      >
        <section class="relative overflow-hidden border-b border-[#D8E7E3] bg-[#EAF7F4] px-6 py-8 sm:px-10 sm:py-10">
          <div class="absolute right-0 top-0 size-48 -translate-y-1/2 translate-x-1/3 rounded-full bg-[#D8E7E3]/70" />
          <div class="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <label
              class="relative block size-28 shrink-0 cursor-pointer overflow-hidden rounded-[2rem] bg-[#0B7A75] text-3xl font-semibold text-white shadow-[0_16px_32px_rgba(11,122,117,0.2)]"
            >
              <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" />
              <span v-else class="flex size-full items-center justify-center">{{ initials }}</span>
              <span
                class="absolute inset-0 flex items-center justify-center bg-[#102F35]/60 opacity-0 transition-opacity hover:opacity-100"
              >
                <Camera class="size-5" />
              </span>
              <input
                class="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                @change="handleAvatarChange"
              />
            </label>
            <div class="min-w-0">
              <h1 class="truncate text-4xl font-semibold tracking-[-0.05em] text-[#102F35] sm:text-5xl">
                {{ name || nickname || email }}
              </h1>
              <p class="mt-2 truncate text-lg font-semibold text-[#0B7A75]">@{{ nickname || 'nickname' }}</p>
            </div>
          </div>
        </section>

        <section class="p-6 sm:p-10">
          <p v-if="isLoadingProfile" class="mb-5 text-sm text-[#61777B]">{{ t('common.loading') }}</p>
          <form class="space-y-6" @submit.prevent="handleProfileSave">
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="account-name" class="text-[#27595D]">{{ t('account.name') }}</Label>
                <Input
                  id="account-name"
                  v-model="name"
                  :disabled="isSaving"
                  class="h-11 rounded-xl border-[#D8E7E3] bg-[#F6FAF8] px-4 text-[#4E6B70] shadow-none"
                />
              </div>
              <div class="space-y-2">
                <Label for="account-nickname" class="text-[#27595D]">{{ t('account.nickname') }}</Label>
                <Input
                  id="account-nickname"
                  v-model="nickname"
                  :disabled="isSaving"
                  class="h-11 rounded-xl border-[#D8E7E3] bg-[#F6FAF8] px-4 text-[#4E6B70] shadow-none"
                />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="account-email" class="text-[#27595D]">{{ t('account.email') }}</Label>
              <Input
                id="account-email"
                v-model="email"
                type="email"
                disabled
                class="h-11 rounded-xl border-[#D8E7E3] bg-[#F6FAF8] px-4 text-[#4E6B70] shadow-none"
              />
            </div>

            <div class="space-y-2">
              <Label for="account-status-message" class="text-[#27595D]">{{ t('account.statusMessage') }}</Label>
              <Input
                id="account-status-message"
                v-model="statusMessage"
                :disabled="isSaving"
                :placeholder="t('account.statusMessagePlaceholder')"
                class="h-11 rounded-xl border-[#D8E7E3] bg-[#F6FAF8] px-4 text-[#4E6B70] shadow-none placeholder:text-[#8AA0A2]"
              />
            </div>

            <p v-if="profileError" role="status" class="text-sm text-[#9D4636]">{{ profileError }}</p>
            <div class="flex justify-end border-t border-[#E5EFEC] pt-6">
              <Button
                type="submit"
                :disabled="isSaving"
                class="harbor-primary-action h-11 rounded-full bg-[#0B7A75] px-6 text-white"
              >
                {{ isSaving ? t('common.loading') : t('account.save') }}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </motion.section>
  </main>
</template>
