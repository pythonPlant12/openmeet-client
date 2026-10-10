import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { userStatusOption } from '@/config/user-status.config';
import { type UserStatus, socialApi } from '@/services/social-api';

// The signed-in user's avatar, nickname, and status, shared by every account entry point. Each instance
// reloads on `openmeet:profile-updated`, so a change made through one stays in sync everywhere.
export function useOwnProfile() {
  const { accessToken, isAuthenticated, isCheckingSession } = useAuth();
  const avatarUrl = ref<string | null>(null);
  const nickname = ref<string | null>(null);
  const ownStatus = ref<UserStatus | null>(null);
  const ownStatusOption = computed(() => userStatusOption(ownStatus.value));
  const isNicknameCopied = ref(false);
  let nicknameCopiedTimer: number | undefined;
  let avatarObjectUrl: string | null = null;
  let avatarRequest = 0;

  async function loadProfile() {
    const token = accessToken.value;
    const request = ++avatarRequest;
    if (!token || !isAuthenticated.value) {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      avatarObjectUrl = null;
      avatarUrl.value = null;
      nickname.value = null;
      ownStatus.value = null;
      return;
    }

    try {
      const profile = await socialApi.getCurrentUserProfile(token);
      if (request !== avatarRequest) return;
      nickname.value = profile.nickname;
      ownStatus.value = profile.status;
      if (!profile.avatarUrl) return;
      const objectUrl = URL.createObjectURL(await socialApi.loadAvatar(token, profile.avatarUrl));
      if (request !== avatarRequest) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      avatarObjectUrl = objectUrl;
      avatarUrl.value = objectUrl;
    } catch (error) {
      console.error('[useOwnProfile] Failed to load profile:', error);
    }
  }

  // Status changes show immediately and roll back if the server rejects them.
  async function setOwnStatus(status: UserStatus) {
    const token = accessToken.value;
    const previous = ownStatus.value;
    if (!token || status === previous) return;
    ownStatus.value = status;
    try {
      await socialApi.updateCurrentUserStatus(token, status);
      window.dispatchEvent(new Event('openmeet:profile-updated'));
    } catch (error) {
      console.error('[useOwnProfile] Failed to update status:', error);
      ownStatus.value = previous;
    }
  }

  async function copyNickname() {
    if (!nickname.value) return;
    try {
      await navigator.clipboard.writeText(nickname.value);
      isNicknameCopied.value = true;
      window.clearTimeout(nicknameCopiedTimer);
      nicknameCopiedTimer = window.setTimeout(() => (isNicknameCopied.value = false), 2_000);
    } catch (error) {
      console.error('[useOwnProfile] Failed to copy nickname:', error);
    }
  }

  const handleProfileUpdated = () => void loadProfile();

  onMounted(() => {
    window.addEventListener('openmeet:profile-updated', handleProfileUpdated);
    void loadProfile();
  });

  onUnmounted(() => {
    window.removeEventListener('openmeet:profile-updated', handleProfileUpdated);
    window.clearTimeout(nicknameCopiedTimer);
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
  });

  watch([accessToken, isAuthenticated, isCheckingSession], () => void loadProfile());

  return { avatarUrl, nickname, ownStatus, ownStatusOption, isNicknameCopied, setOwnStatus, copyNickname };
}

export type OwnProfile = ReturnType<typeof useOwnProfile>;
