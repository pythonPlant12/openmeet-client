<script setup lang="ts">
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Link2,
  MailPlus,
  PhoneCall,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import DashboardActionMenu from '@/components/dashboard-page/DashboardActionMenu.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';
import {
  type SystemNotificationPermission,
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
} from '@/services/notifications';
import {
  type CallInvitation,
  type Friend,
  type FriendRequest,
  type RecentMeeting,
  socialApi,
} from '@/services/social-api';

const router = useRouter();
const { t } = useI18n();
const { createMeeting, joinMeeting: navigateToMeeting } = useMeetingNavigation();
const { currentUser, isCheckingSession, isAuthenticated, accessToken } = useAuth();

const meetingReference = ref('');
const meetingReferenceError = ref('');
const friendEmail = ref('');
const friends = ref<Friend[]>([]);
const incomingRequests = ref<FriendRequest[]>([]);
const incomingCalls = ref<CallInvitation[]>([]);
const recentMeetings = ref<RecentMeeting[]>([]);
const isLoading = ref(true);
const isAddingFriend = ref(false);
const callingFriendId = ref<string | null>(null);
const actionError = ref('');
const actionMessage = ref('');
const hasStartedDashboard = ref(false);
const notificationPermission = ref<SystemNotificationPermission>(getSystemNotificationPermission());
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const entranceInitial = prefersReducedMotion ? false : { opacity: 0, y: 12 };
let friendPollTimer: ReturnType<typeof setInterval> | undefined;
let isRefreshingFriends = false;

const firstName = computed(() => currentUser.value?.name?.trim().split(/\s+/)[0] || t('meeting.fallbackUser'));
const onlineFriends = computed(() => friends.value.filter((friend) => friend.isOnline).length);
const today = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());

function userInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatMeetingDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function clearFeedback() {
  actionError.value = '';
  actionMessage.value = '';
}

async function loadSocialData() {
  const token = accessToken.value;
  if (!token) return;

  try {
    const [friendData, meetings, calls] = await Promise.all([
      socialApi.listFriends(token),
      socialApi.listMeetings(token),
      socialApi.listIncomingCalls(token),
    ]);
    friends.value = friendData.friends;
    incomingRequests.value = friendData.incomingRequests;
    recentMeetings.value = meetings;
    incomingCalls.value = calls;
    actionError.value = '';
  } catch (error) {
    console.error('[Dashboard] Failed to load dashboard:', error);
    actionError.value = t('dashboard.loadError');
  } finally {
    isLoading.value = false;
  }
}

async function refreshFriends() {
  const token = accessToken.value;
  if (!token || isRefreshingFriends) return;
  isRefreshingFriends = true;
  try {
    const data = await socialApi.listFriends(token);
    friends.value = data.friends;
    incomingRequests.value = data.incomingRequests;
  } finally {
    isRefreshingFriends = false;
  }
}

async function pollIncomingCalls() {
  const token = accessToken.value;
  if (!token) return;
  try {
    incomingCalls.value = await socialApi.listIncomingCalls(token);
  } catch (error) {
    console.error('[Dashboard] Failed to poll calls:', error);
  }
}

function startDashboard() {
  if (hasStartedDashboard.value || !accessToken.value) return;
  hasStartedDashboard.value = true;
  loadSocialData();
  friendPollTimer = setInterval(() => {
    refreshFriends().catch((error) => console.error('[Dashboard] Failed to refresh friends:', error));
  }, 5_000);
}

watch(
  [isCheckingSession, isAuthenticated, accessToken],
  ([checking, authenticated]) => {
    if (!checking && !authenticated) {
      router.push('/login');
      return;
    }
    if (authenticated) startDashboard();
  },
  { immediate: true },
);

function handleIncomingCallsUpdated(event: Event) {
  incomingCalls.value = (event as CustomEvent<CallInvitation[]>).detail;
}

async function enableNotifications() {
  notificationPermission.value = await requestSystemNotificationPermission();
  clearFeedback();
  if (notificationPermission.value === 'granted') actionMessage.value = t('notifications.enabled');
  else if (notificationPermission.value === 'denied') actionError.value = t('notifications.blocked');
  else if (notificationPermission.value === 'unsupported') actionError.value = t('notifications.unsupported');
}

onMounted(() => window.addEventListener('openmeet:incoming-calls-updated', handleIncomingCallsUpdated));

onUnmounted(() => {
  if (friendPollTimer) clearInterval(friendPollTimer);
  window.removeEventListener('openmeet:incoming-calls-updated', handleIncomingCallsUpdated);
});

function joinMeeting() {
  clearFeedback();
  if (navigateToMeeting(meetingReference.value)) return;
  meetingReferenceError.value = t('dashboard.invalidMeeting');
}

async function addFriend() {
  const token = accessToken.value;
  if (!token || !friendEmail.value.trim()) return;
  clearFeedback();
  isAddingFriend.value = true;
  try {
    await socialApi.addFriend(token, friendEmail.value.trim());
    friendEmail.value = '';
    actionMessage.value = t('dashboard.friendRequestSent');
  } catch (error) {
    console.error('[Dashboard] Failed to add friend:', error);
    actionError.value = error instanceof Error ? error.message : t('dashboard.friendRequestError');
  } finally {
    isAddingFriend.value = false;
  }
}

async function answerFriendRequest(requestId: string, accept: boolean) {
  const token = accessToken.value;
  if (!token) return;
  clearFeedback();
  try {
    if (accept) await socialApi.acceptFriend(token, requestId);
    else await socialApi.declineFriend(token, requestId);
    await refreshFriends();
  } catch (error) {
    console.error('[Dashboard] Failed to answer friend request:', error);
    actionError.value = t('dashboard.friendRequestError');
  }
}

async function callFriend(friend: Friend) {
  const token = accessToken.value;
  if (!token || callingFriendId.value) return;
  clearFeedback();
  callingFriendId.value = friend.id;
  try {
    const invitation = await socialApi.createCall(token, friend.id);
    await router.push({ name: 'meeting', params: { id: invitation.roomId } });
  } catch (error) {
    console.error('[Dashboard] Failed to call friend:', error);
    actionError.value = t('dashboard.callError');
    callingFriendId.value = null;
  }
}

async function answerCall(invitation: CallInvitation, accept: boolean) {
  const token = accessToken.value;
  if (!token) return;
  clearFeedback();
  try {
    const response = await socialApi.respondToCall(token, invitation.id, accept);
    incomingCalls.value = incomingCalls.value.filter((call) => call.id !== invitation.id);
    window.dispatchEvent(new CustomEvent<string>('openmeet:incoming-call-resolved', { detail: invitation.id }));
    if (accept) await router.push({ name: 'meeting', params: { id: response.roomId } });
  } catch (error) {
    console.error('[Dashboard] Failed to answer call:', error);
    actionError.value = t('dashboard.callExpired');
    await pollIncomingCalls();
  }
}

function rejoinMeeting(meeting: RecentMeeting) {
  router.push({ name: 'meeting', params: { id: meeting.roomId } });
}

async function removeMeeting(meeting: RecentMeeting) {
  const token = accessToken.value;
  if (!token) return;
  try {
    await socialApi.deleteMeeting(token, meeting.id);
    recentMeetings.value = recentMeetings.value.filter((item) => item.id !== meeting.id);
  } catch (error) {
    console.error('[Dashboard] Failed to remove meeting:', error);
    actionError.value = t('dashboard.removeMeetingError');
  }
}
</script>

<template>
  <div v-if="isCheckingSession" class="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#F6FAF7]">
    <LoadingRipple class="size-8 text-[#0B7A75]" />
  </div>

  <main v-else-if="isAuthenticated" class="marketing-font min-h-[calc(100vh-80px)] bg-[#F6FAF7] text-[#102F35]">
    <div class="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <DashboardActionMenu
        context
        :friends="friends"
        :calling-friend-id="callingFriendId"
        :is-loading="isLoading"
        @create-meeting="createMeeting"
        @call-friend="callFriend"
      >
        <motion.header
          :initial="entranceInitial"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.45 }"
          class="flex flex-col justify-between gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] md:flex-row md:items-end"
          tabindex="0"
          :aria-label="t('dashboard.actions.workspace')"
        >
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
              {{ t('dashboard.workspace') }}
            </p>
            <h1 class="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {{ t('dashboard.greeting', { name: firstName }) }}
            </h1>
            <p class="mt-3 text-[#61777B]">{{ today }}</p>
          </div>
          <div class="flex max-w-full flex-wrap items-center gap-3 self-start md:self-auto md:justify-end">
            <DashboardActionMenu
              :friends="friends"
              :calling-friend-id="callingFriendId"
              :is-loading="isLoading"
              @create-meeting="createMeeting"
              @call-friend="callFriend"
            />
            <Button
              v-if="notificationPermission === 'default'"
              variant="outline"
              class="h-11 rounded-full border-[#9BCFC7] bg-[#E6F4F1] px-4 text-[#0B7A75] hover:bg-[#D8ECE8]"
              @contextmenu.stop
              @pointerdown.stop
              @click="enableNotifications"
            >
              <BellRing class="size-4" />
              {{ t('notifications.enable') }}
            </Button>
            <div
              class="flex max-w-full items-center gap-3 rounded-full bg-white py-2 pl-2 pr-4 shadow-[0_8px_30px_rgba(16,47,53,0.07)]"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full bg-[#E6F4F1] font-semibold text-[#0B7A75]"
              >
                {{ userInitials(currentUser?.name || firstName) }}
              </span>
              <span class="min-w-0">
                <strong class="block truncate text-sm">{{ currentUser?.name }}</strong>
                <span class="block max-w-48 truncate text-xs text-[#61777B]">{{ currentUser?.email }}</span>
              </span>
            </div>
          </div>
        </motion.header>
      </DashboardActionMenu>

      <div v-if="actionError || actionMessage" class="mt-6" aria-live="polite">
        <p
          v-if="actionError"
          role="alert"
          class="rounded-2xl border border-[#F2C7BE] bg-[#FFF4F0] px-4 py-3 text-sm text-[#9D4636]"
        >
          {{ actionError }}
        </p>
        <p v-else class="rounded-2xl border border-[#BBDDD6] bg-[#EDF8F5] px-4 py-3 text-sm text-[#17645F]">
          {{ actionMessage }}
        </p>
      </div>

      <motion.section
        v-if="incomingCalls.length"
        :initial="false"
        :animate="
          prefersReducedMotion ? { backgroundColor: '#DDF1ED' } : { backgroundColor: ['#CDECE6', '#E8F6F3', '#CDECE6'] }
        "
        :transition="{ duration: 2.8, repeat: prefersReducedMotion ? 0 : Infinity, ease: 'easeInOut' }"
        class="mt-7 flex flex-col gap-4 rounded-[1.75rem] border border-[#9BCFC7] p-5 text-[#102F35] shadow-[0_14px_40px_rgba(11,122,117,0.1)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-live="assertive"
      >
        <div class="flex items-center gap-4">
          <motion.span
            :animate="
              prefersReducedMotion ? { rotate: 0, y: 0 } : { rotate: [0, -9, 9, -9, 9, 0], y: [0, -2, 0, -2, 0, 0] }
            "
            :transition="{
              duration: 0.75,
              repeat: prefersReducedMotion ? 0 : Infinity,
              repeatDelay: 0.65,
              ease: 'easeInOut',
            }"
            class="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0B7A75] text-white shadow-[0_8px_22px_rgba(11,122,117,0.28)]"
          >
            <PhoneCall class="size-5" />
          </motion.span>
          <div>
            <p class="text-sm font-semibold text-[#0B7A75]">{{ t('dashboard.incomingCall') }}</p>
            <h2 class="text-xl font-semibold tracking-[-0.025em]">
              {{ t('dashboard.isCalling', { name: incomingCalls[0]?.caller?.name || t('meeting.fallbackUser') }) }}
            </h2>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            class="w-full rounded-full border-[#9BCFC7] bg-transparent hover:bg-white/70 sm:w-auto"
            @click="answerCall(incomingCalls[0]!, false)"
          >
            {{ t('dashboard.decline') }}
          </Button>
          <Button
            class="w-full rounded-full bg-[#0B7A75] text-white hover:bg-[#08635F] sm:w-auto"
            @click="answerCall(incomingCalls[0]!, true)"
          >
            <PhoneCall class="size-4" />
            {{ t('dashboard.answer') }}
          </Button>
        </div>
      </motion.section>

      <div class="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
        <div class="min-w-0 space-y-8">
          <motion.section
            :initial="entranceInitial"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.5, delay: 0.08 }"
            class="relative overflow-hidden rounded-[2rem] bg-[#102F35] px-6 py-8 text-white shadow-[0_28px_70px_rgba(16,47,53,0.18)] sm:px-9 sm:py-10"
          >
            <div
              class="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full border-[50px] border-[#1C4A4F]"
            />
            <div
              class="pointer-events-none absolute -bottom-24 right-28 size-52 rounded-full bg-[#0B7A75]/25 blur-3xl"
            />
            <div class="relative max-w-xl">
              <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-[#B8DDD7]">
                <span class="size-2 rounded-full bg-[#64D3C4]" />
                {{ t('dashboard.roomReady') }}
              </span>
              <h2 class="mt-6 text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                {{ t('dashboard.startConversation') }}
              </h2>
              <p class="mt-4 max-w-lg leading-7 text-[#B8C9CB]">{{ t('dashboard.startConversationDescription') }}</p>
              <motion.div
                class="mt-7 inline-flex"
                :whileHover="prefersReducedMotion ? undefined : { scale: 1.025 }"
                :whilePress="prefersReducedMotion ? undefined : { scale: 0.98 }"
              >
                <Button
                  size="lg"
                  class="h-12 rounded-full bg-[#EAF7F4] px-6 text-[#102F35] hover:bg-white"
                  @click="createMeeting"
                >
                  <Video class="size-4" />
                  {{ t('dashboard.newMeeting') }}
                  <ArrowRight class="size-4" />
                </Button>
              </motion.div>
            </div>
          </motion.section>

          <motion.section
            :initial="entranceInitial"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.45, delay: 0.16 }"
            class="flex flex-col gap-5 rounded-[1.75rem] border border-[#D8E7E3] bg-white p-5 sm:p-6 md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center"
          >
            <div class="flex items-center gap-4">
              <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0EA] text-[#C65A45]">
                <Link2 class="size-5" />
              </span>
              <div>
                <h2 class="font-semibold">{{ t('dashboard.haveInvite') }}</h2>
                <p class="mt-1 text-sm text-[#61777B]">{{ t('dashboard.joinDescription') }}</p>
              </div>
            </div>
            <form class="w-full md:max-w-md md:justify-self-end" @submit.prevent="joinMeeting">
              <div class="flex flex-col gap-2 min-[380px]:flex-row">
                <Input
                  v-model="meetingReference"
                  :aria-label="t('dashboard.joinPlaceholder')"
                  :aria-invalid="!!meetingReferenceError"
                  :placeholder="t('dashboard.joinPlaceholder')"
                  class="h-11 rounded-full border-[#D8E7E3] bg-[#F8FAF8] px-4 focus-visible:border-[#0B7A75] focus-visible:ring-2 focus-visible:ring-[#9BCFC7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAF8]"
                  @input="meetingReferenceError = ''"
                />
                <Button
                  type="submit"
                  class="h-11 w-full shrink-0 rounded-full bg-[#0B7A75] px-5 text-white hover:bg-[#08635F] min-[380px]:w-auto"
                >
                  {{ t('dashboard.join') }}
                </Button>
              </div>
              <p v-if="meetingReferenceError" role="alert" class="mt-2 px-3 text-xs text-[#B44D3A]">
                {{ meetingReferenceError }}
              </p>
            </form>
          </motion.section>

          <motion.section
            :initial="entranceInitial"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.45, delay: 0.24 }"
          >
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#0B7A75]">
                  {{ t('dashboard.history') }}
                </p>
                <h2 class="mt-2 text-2xl font-semibold tracking-[-0.035em]">{{ t('dashboard.recentMeetings') }}</h2>
              </div>
              <span v-if="recentMeetings.length" class="shrink-0 whitespace-nowrap text-sm text-[#61777B]">
                {{ t('dashboard.savedRooms', { count: recentMeetings.length }) }}
              </span>
            </div>

            <div
              v-if="isLoading"
              class="mt-5 flex min-h-36 items-center justify-center rounded-[1.75rem] border border-[#D8E7E3] bg-white"
            >
              <LoadingRipple class="size-6 text-[#0B7A75]" />
            </div>
            <div
              v-else-if="!recentMeetings.length"
              class="mt-5 flex min-h-40 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[#C8DCD7] bg-white/60 px-5 text-center"
            >
              <CalendarClock class="size-7 text-[#8AA7A5]" />
              <p class="mt-3 font-semibold">{{ t('dashboard.noRecentMeetings') }}</p>
              <p class="mt-1 text-sm text-[#61777B]">{{ t('dashboard.noRecentMeetingsDescription') }}</p>
            </div>
            <div
              v-else
              class="mt-5 divide-y divide-[#E5EFEC] overflow-hidden rounded-[1.75rem] border border-[#D8E7E3] bg-white"
            >
              <motion.article
                v-for="(meeting, index) in recentMeetings"
                :key="meeting.id"
                :initial="entranceInitial"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ duration: 0.35, delay: 0.28 + index * 0.045 }"
                class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-[#F8FBF9] sm:flex sm:gap-4 sm:px-5"
              >
                <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#E6F4F1] text-[#0B7A75]">
                  <Clock3 class="size-5" />
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-semibold">
                    {{ t('dashboard.roomName', { id: meeting.roomId.slice(0, 8) }) }}
                  </h3>
                  <p class="mt-1 truncate text-sm text-[#61777B]">
                    {{ formatMeetingDate(meeting.lastJoinedAt) }} · {{ meeting.roomId }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  :aria-label="t('dashboard.removeMeeting')"
                  class="rounded-full text-[#809697] hover:bg-[#FFF0EA] hover:text-[#B44D3A]"
                  @click="removeMeeting(meeting)"
                >
                  <Trash2 class="size-4" />
                </Button>
                <Button
                  class="col-span-3 w-full rounded-full border border-[#9BCFC7] bg-[#E6F4F1] text-[#0B7A75] shadow-none hover:bg-[#CDE9E4] hover:text-[#08635F] sm:w-auto"
                  @click="rejoinMeeting(meeting)"
                >
                  {{ t('dashboard.rejoin') }}
                  <ArrowRight class="size-4" />
                </Button>
              </motion.article>
            </div>
          </motion.section>
        </div>

        <motion.aside
          :initial="entranceInitial"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.5, delay: 0.18 }"
          class="h-fit min-w-0 rounded-[2rem] border border-[#D8E7E3] bg-white p-5 shadow-[0_18px_55px_rgba(16,47,53,0.07)] sm:p-6 xl:sticky xl:top-24"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#0B7A75]">
                {{ t('dashboard.people') }}
              </p>
              <h2 class="mt-2 text-2xl font-semibold tracking-[-0.035em]">{{ t('dashboard.friends') }}</h2>
            </div>
            <span
              class="flex items-center gap-2 rounded-full bg-[#EDF8F5] px-3 py-1.5 text-xs font-semibold text-[#17645F]"
            >
              <span class="size-2 rounded-full bg-[#29A899]" />
              {{ t('dashboard.onlineCount', { count: onlineFriends }) }}
            </span>
          </div>

          <form class="mt-5" @submit.prevent="addFriend">
            <label for="friend-email" class="text-sm font-semibold">{{ t('dashboard.addFriend') }}</label>
            <div class="mt-2 flex gap-2">
              <div class="relative min-w-0 flex-1">
                <MailPlus class="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[#809697]" />
                <Input
                  id="friend-email"
                  v-model="friendEmail"
                  type="email"
                  :placeholder="t('dashboard.friendEmailPlaceholder')"
                  class="h-11 rounded-full border-[#D8E7E3] bg-[#F8FAF8] pl-10 pr-4 focus-visible:border-[#0B7A75] focus-visible:ring-2 focus-visible:ring-[#9BCFC7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAF8]"
                  required
                  @input="clearFeedback"
                />
              </div>
              <Button
                type="submit"
                size="icon"
                :disabled="isAddingFriend || !friendEmail.trim()"
                :aria-label="t('dashboard.sendFriendRequest')"
                class="size-11 shrink-0 rounded-full bg-[#102F35] text-white hover:bg-[#1C4A4F]"
              >
                <LoadingRipple v-if="isAddingFriend" size="sm" />
                <UserPlus v-else class="size-4" />
              </Button>
            </div>
            <p class="mt-2 text-xs leading-5 text-[#809697]">{{ t('dashboard.registeredOnly') }}</p>
          </form>

          <section v-if="incomingRequests.length" class="mt-6 border-t border-[#E5EFEC] pt-5">
            <h3 class="flex items-center gap-2 text-sm font-semibold">
              <Users class="size-4 text-[#0B7A75]" />
              {{ t('dashboard.friendRequests') }}
              <span class="rounded-full bg-[#FFF0EA] px-2 py-0.5 text-xs text-[#B44D3A]">{{
                incomingRequests.length
              }}</span>
            </h3>
            <div class="mt-3 space-y-2">
              <div
                v-for="request in incomingRequests"
                :key="request.id"
                class="flex items-center gap-3 rounded-2xl bg-[#F8FAF8] p-3"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-xs font-semibold text-[#0B7A75]"
                >
                  {{ userInitials(request.user.name) }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ request.user.name }}</p>
                  <p class="truncate text-xs text-[#809697]">{{ request.user.email }}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  :aria-label="t('dashboard.declineRequest')"
                  class="size-8 rounded-full text-[#B44D3A] hover:bg-[#FFF0EA]"
                  @click="answerFriendRequest(request.id, false)"
                >
                  <X class="size-4" />
                </Button>
                <Button
                  size="icon"
                  :aria-label="t('dashboard.acceptRequest')"
                  class="size-8 rounded-full bg-[#0B7A75] text-white hover:bg-[#08635F]"
                  @click="answerFriendRequest(request.id, true)"
                >
                  <Check class="size-4" />
                </Button>
              </div>
            </div>
          </section>

          <section class="mt-6 border-t border-[#E5EFEC] pt-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">{{ t('dashboard.yourFriends') }}</h3>
              <span class="text-xs text-[#809697]">{{ friends.length }}</span>
            </div>

            <div v-if="isLoading" class="flex min-h-36 items-center justify-center">
              <LoadingRipple class="size-5 text-[#0B7A75]" />
            </div>
            <div
              v-else-if="!friends.length"
              class="flex min-h-44 flex-col items-center justify-center px-4 text-center"
            >
              <span class="flex size-12 items-center justify-center rounded-full bg-[#EDF3F2] text-[#61777B]">
                <Users class="size-5" />
              </span>
              <p class="mt-3 text-sm font-semibold">{{ t('dashboard.noFriends') }}</p>
              <p class="mt-1 text-xs leading-5 text-[#809697]">{{ t('dashboard.noFriendsDescription') }}</p>
            </div>
            <div v-else class="mt-3 space-y-1">
              <motion.div
                v-for="friend in friends"
                :key="friend.id"
                :whileHover="prefersReducedMotion ? undefined : { x: 3 }"
                class="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-[#F6FAF7]"
              >
                <span
                  class="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-sm font-semibold text-[#0B7A75]"
                >
                  {{ userInitials(friend.name) }}
                  <span
                    :class="[
                      'absolute bottom-0 right-0 size-3 rounded-full border-2 border-white',
                      friend.isOnline ? 'bg-[#29A899]' : 'bg-[#B8C6C5]',
                    ]"
                  />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ friend.name }}</p>
                  <p class="truncate text-xs text-[#809697]">
                    {{ friend.isOnline ? t('dashboard.online') : t('dashboard.offline') }}
                  </p>
                </div>
                <Button
                  size="icon"
                  :disabled="callingFriendId !== null"
                  :aria-label="t('dashboard.callFriend', { name: friend.name })"
                  class="size-9 rounded-full bg-[#E6F4F1] text-[#0B7A75] hover:bg-[#0B7A75] hover:text-white"
                  @click="callFriend(friend)"
                >
                  <LoadingRipple v-if="callingFriendId === friend.id" size="sm" />
                  <PhoneCall v-else class="size-4" />
                </Button>
              </motion.div>
            </div>
          </section>

          <div class="mt-6 flex items-center gap-3 rounded-2xl bg-[#102F35] p-4 text-white">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Plus class="size-4" />
            </span>
            <p class="text-xs leading-5 text-[#B8C9CB]">
              <strong class="block text-sm text-white">{{ t('dashboard.openByDesign') }}</strong>
              {{ t('dashboard.guestsStillWelcome') }}
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  </main>
</template>
