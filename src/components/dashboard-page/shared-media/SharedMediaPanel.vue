<script setup lang="ts">
import { useIntersectionObserver, useResizeObserver } from '@vueuse/core';
import { Download, FileText, ImageIcon, Play } from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';

import FilePreview from '@/components/dashboard-page/chat/FilePreview.vue';
import VoiceMessagePlayer from '@/components/dashboard-page/chat/VoiceMessagePlayer.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { useAttachmentCache } from '@/composables/useAttachmentCache';
import { splitMessageLinks } from '@/lib/message-links';
import {
  type ConversationMessageAttachment,
  type SharedMediaCounts,
  type SharedMediaItem,
  type SharedMediaKind,
  socialApi,
} from '@/services/social-api';

import SharedLinkRow from './SharedLinkRow.vue';

// What a conversation has shared, by kind, as on a messenger profile. Tabs with nothing in them stay hidden.
const props = defineProps<{
  conversationId: string | null;
  accessToken?: string;
  /** Scopes the attachment cache to the signed-in account. */
  userId?: string | null;
}>();

interface Tab {
  kind: SharedMediaKind;
  label: string;
}
interface KindState {
  items: SharedMediaItem[];
  nextBefore: number | null;
  loading: boolean;
  error: boolean;
  loaded: boolean;
}

const TABS: Tab[] = [
  { kind: 'media', label: 'Media' },
  { kind: 'files', label: 'Files' },
  { kind: 'voice', label: 'Voice' },
  { kind: 'links', label: 'Links' },
  { kind: 'gifs', label: 'GIFs' },
];
// Same limit as the chat: larger videos load only when opened.
const MAX_AUTO_LOAD_BYTES = 10 * 1024 * 1024;

const counts = ref<SharedMediaCounts | null>(null);
const countsLoading = ref(false);
const countsError = ref(false);
const activeKind = ref<SharedMediaKind>('media');
const kinds = ref<Partial<Record<SharedMediaKind, KindState>>>({});
const previewAttachments = ref<ConversationMessageAttachment[]>([]);
const previewIndex = ref(0);
const tabButtons = ref<Record<string, HTMLElement | null>>({});
const tablist = ref<HTMLElement | null>(null);
const thumb = ref({ left: 0, width: 0 });
const sentinel = ref<HTMLElement | null>(null);
let requestGeneration = 0;

const cache = useAttachmentCache(
  () => props.userId,
  (path) => socialApi.loadConversationAttachment(props.accessToken ?? '', path),
);

const visibleTabs = computed(() => TABS.filter((tab) => (counts.value?.[tab.kind] ?? 0) > 0));
const active = computed(() => kinds.value[activeKind.value]);
const items = computed(() => active.value?.items ?? []);
const visualAttachments = computed(() => items.value.flatMap((item) => (item.attachment ? [item.attachment] : [])));
const linkRows = computed(() =>
  items.value.flatMap((item) =>
    splitMessageLinks(item.content ?? '').flatMap((segment, index) =>
      segment.kind === 'link'
        ? [{ key: `${item.sequence}-${index}`, href: segment.href, text: segment.text, item }]
        : [],
    ),
  ),
);

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}
function formatFileSize(byteSize: number) {
  if (byteSize < 1024 * 1024) return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(byteSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
function fileExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  return extension && extension !== fileName ? extension.slice(0, 4).toUpperCase() : 'FILE';
}
function isVideo(attachment: ConversationMessageAttachment) {
  return attachment.contentType.startsWith('video/');
}
function meta(item: SharedMediaItem) {
  return `${item.senderName} · ${formatDate(item.createdAt)}`;
}

function emptyState(): KindState {
  return { items: [], nextBefore: null, loading: false, error: false, loaded: false };
}

async function loadCounts() {
  const conversationId = props.conversationId;
  const token = props.accessToken;
  const generation = ++requestGeneration;
  counts.value = null;
  kinds.value = {};
  countsError.value = false;
  if (!conversationId || !token) return;
  countsLoading.value = true;
  try {
    const loaded = await socialApi.getSharedMediaCounts(token, conversationId);
    if (generation !== requestGeneration) return;
    counts.value = loaded;
    const first = TABS.find((tab) => loaded[tab.kind] > 0);
    if (first) await selectKind(first.kind);
  } catch (error) {
    console.error('[SharedMediaPanel] Failed to load shared media counts:', error);
    if (generation === requestGeneration) countsError.value = true;
  } finally {
    if (generation === requestGeneration) countsLoading.value = false;
  }
}

async function loadPage(kind: SharedMediaKind) {
  const conversationId = props.conversationId;
  const token = props.accessToken;
  const state = kinds.value[kind] ?? emptyState();
  if (!conversationId || !token || state.loading || (state.loaded && state.nextBefore === null)) return;
  const generation = requestGeneration;
  kinds.value = { ...kinds.value, [kind]: { ...state, loading: true, error: false } };
  try {
    const page = await socialApi.listSharedMedia(token, conversationId, kind, state.nextBefore ?? undefined);
    if (generation !== requestGeneration) return;
    const current = kinds.value[kind] ?? emptyState();
    kinds.value = {
      ...kinds.value,
      [kind]: {
        items: [...current.items, ...page.items],
        nextBefore: page.nextBefore ?? null,
        loading: false,
        error: false,
        loaded: true,
      },
    };
    if (kind === 'media' || kind === 'gifs') {
      void cache.ensure(
        page.items.flatMap((item) =>
          item.attachment && item.attachment.byteSize <= MAX_AUTO_LOAD_BYTES ? [item.attachment.url] : [],
        ),
      );
    }
  } catch (error) {
    console.error('[SharedMediaPanel] Failed to load shared media:', error);
    if (generation !== requestGeneration) return;
    const current = kinds.value[kind] ?? emptyState();
    kinds.value = { ...kinds.value, [kind]: { ...current, loading: false, error: true } };
  }
}

async function selectKind(kind: SharedMediaKind) {
  activeKind.value = kind;
  await nextTick();
  moveThumb();
  if (!kinds.value[kind]?.loaded) await loadPage(kind);
}

function moveThumb() {
  const button = tabButtons.value[activeKind.value];
  thumb.value = button ? { left: button.offsetLeft, width: button.offsetWidth } : { left: 0, width: 0 };
}

// Arrow keys move between tabs, as in a native segmented control.
function handleTabKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const tabs = visibleTabs.value;
  const index = tabs.findIndex((tab) => tab.kind === activeKind.value);
  const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  if (!next) return;
  void selectKind(next.kind);
  void nextTick(() => tabButtons.value[next.kind]?.focus());
}

function openPreview(attachment: ConversationMessageAttachment) {
  previewAttachments.value = visualAttachments.value;
  previewIndex.value = Math.max(0, visualAttachments.value.indexOf(attachment));
  void cache.ensure([attachment.url]);
}

watch(previewIndex, (index) => {
  const attachment = previewAttachments.value[index];
  if (attachment) void cache.ensure([attachment.url]);
});

async function downloadFile(attachment: ConversationMessageAttachment) {
  await cache.ensure([attachment.url]);
  const url = cache.urls.value[attachment.url];
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.fileName;
  link.click();
}

// Loads the next page whenever the end of the list is in view. A short page leaves the end visible without
// a new intersection, so the check also runs after every load and tab change.
const sentinelVisible = ref(false);
useIntersectionObserver(sentinel, ([entry]) => {
  sentinelVisible.value = entry?.isIntersecting ?? false;
});
watch(
  () => [sentinelVisible.value, activeKind.value, active.value?.nextBefore, active.value?.loading] as const,
  ([visible, kind, nextBefore, loading]) => {
    if (visible && nextBefore && !loading && !active.value?.error) void loadPage(kind);
  },
);

watch(() => [props.conversationId, props.accessToken] as const, loadCounts, { immediate: true });
watch(visibleTabs, () => void nextTick(moveThumb));
// The dialog lays out after it opens, so the thumb is measured again whenever the tabs change size.
useResizeObserver(tablist, moveThumb);
</script>

<template>
  <section data-shared-media aria-labelledby="shared-media-title" class="min-w-0">
    <h3 id="shared-media-title" class="mb-3 text-sm font-semibold">Shared media</h3>
    <div v-if="countsLoading" class="flex min-h-24 items-center justify-center">
      <LoadingRipple class="size-6 text-harbor-accent" />
    </div>
    <div
      v-else-if="countsError"
      class="flex items-center justify-between gap-3 rounded-2xl border border-harbor-line bg-white px-4 py-3 text-sm text-harbor-muted"
    >
      Could not load shared media.
      <button
        type="button"
        class="harbor-ghost-action rounded-full px-3 py-1 font-semibold text-harbor-accent"
        @click="loadCounts"
      >
        Retry
      </button>
    </div>
    <p
      v-else-if="!visibleTabs.length"
      class="rounded-2xl border border-harbor-line bg-white px-4 py-6 text-center text-sm text-harbor-muted"
    >
      Photos, files, voice messages, and links sent in this chat appear here.
    </p>
    <template v-else>
      <!-- The tabs stay in reach while a long grid or list scrolls in the dialog. -->
      <div class="sticky top-0 z-10 -mx-1 overflow-x-auto bg-harbor-surface px-1 py-1 [scrollbar-width:none]">
        <div
          ref="tablist"
          role="tablist"
          aria-label="Shared media types"
          class="relative inline-flex min-w-full rounded-full bg-harbor-hover p-1"
          @keydown="handleTabKeydown"
        >
          <span
            class="pointer-events-none absolute inset-y-1 rounded-full bg-white shadow-harbor-soft transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            :style="{ left: `${thumb.left}px`, width: `${thumb.width}px` }"
            aria-hidden="true"
          />
          <button
            v-for="tab in visibleTabs"
            :key="tab.kind"
            :ref="(element) => (tabButtons[tab.kind] = element as HTMLElement | null)"
            type="button"
            role="tab"
            :data-shared-tab="tab.kind"
            :aria-selected="activeKind === tab.kind"
            :tabindex="activeKind === tab.kind ? 0 : -1"
            aria-controls="shared-media-panel"
            class="relative z-10 flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
            :class="
              activeKind === tab.kind
                ? 'text-harbor-ink'
                : 'text-harbor-muted [@media(hover:hover)]:hover:text-harbor-ink'
            "
            @click="selectKind(tab.kind)"
          >
            {{ tab.label }}<span class="ml-1.5 text-xs font-medium text-harbor-muted">{{ counts?.[tab.kind] }}</span>
          </button>
        </div>
      </div>

      <div id="shared-media-panel" role="tabpanel" :aria-label="activeKind" class="mt-2 min-h-72">
        <div
          v-if="activeKind === 'media' || activeKind === 'gifs'"
          class="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl sm:grid-cols-4"
        >
          <button
            v-for="attachment in visualAttachments"
            :key="attachment.id"
            type="button"
            data-shared-visual
            class="group relative aspect-square overflow-hidden bg-harbor-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-harbor-subtle"
            :aria-label="`Open ${attachment.fileName}`"
            @click="openPreview(attachment)"
          >
            <template v-if="cache.urls.value[attachment.url]">
              <video
                v-if="isVideo(attachment)"
                :src="`${cache.urls.value[attachment.url]}#t=0.1`"
                muted
                playsinline
                preload="metadata"
                class="size-full object-cover"
              />
              <img
                v-else
                :src="cache.urls.value[attachment.url]"
                alt=""
                class="size-full object-cover transition-transform duration-300 [@media(hover:hover)]:group-hover:scale-105"
              />
            </template>
            <LoadingRipple
              v-else-if="cache.isLoading(attachment.url)"
              class="absolute inset-0 m-auto size-5 text-harbor-icon"
            />
            <ImageIcon v-else class="absolute inset-0 m-auto size-6 text-harbor-subtle" />
            <span
              v-if="isVideo(attachment)"
              class="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-harbor-ink/45 text-white backdrop-blur-sm"
              aria-hidden="true"
              ><Play class="ml-0.5 size-3.5 fill-current"
            /></span>
          </button>
        </div>

        <ul v-else-if="activeKind === 'files'" class="space-y-0.5">
          <li v-for="item in items" :key="item.attachment!.id">
            <button
              type="button"
              data-shared-file
              class="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle [@media(hover:hover)]:hover:bg-harbor-hover"
              :aria-label="`Download ${item.attachment!.fileName}`"
              @click="downloadFile(item.attachment!)"
            >
              <span
                class="flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-harbor-accent text-white"
                ><FileText class="size-4" /><span class="text-[0.5625rem] font-bold leading-none">{{
                  fileExtension(item.attachment!.fileName)
                }}</span></span
              >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-harbor-ink">{{
                  item.attachment!.fileName
                }}</span>
                <span class="block truncate text-xs text-harbor-muted"
                  >{{ formatFileSize(item.attachment!.byteSize) }} · {{ meta(item) }}</span
                >
              </span>
              <LoadingRipple v-if="cache.isLoading(item.attachment!.url)" class="size-4 shrink-0 text-harbor-icon" />
              <Download v-else class="size-4 shrink-0 text-harbor-icon" />
            </button>
          </li>
        </ul>

        <ul v-else-if="activeKind === 'voice'" class="space-y-1">
          <li
            v-for="item in items"
            :key="item.attachment!.id"
            data-shared-voice
            class="rounded-2xl bg-harbor-hover px-2 pt-1.5"
          >
            <!-- One row per message: the sender and day sit where the chat shows the time. -->
            <VoiceMessagePlayer
              fill
              :attachment="item.attachment!"
              :url="cache.urls.value[item.attachment!.url]"
              :loading="cache.isLoading(item.attachment!.url)"
              :error="cache.hasError(item.attachment!.url)"
              :sent-at="item.createdAt"
              :format-time="() => meta(item)"
              @load="cache.ensure([item.attachment!.url])"
            />
          </li>
        </ul>

        <ul v-else class="space-y-0.5">
          <li v-for="row in linkRows" :key="row.key">
            <SharedLinkRow :href="row.href" :text="row.text" :meta="meta(row.item)" />
          </li>
        </ul>

        <div v-if="active?.loading" class="flex justify-center py-4">
          <LoadingRipple class="size-5 text-harbor-icon" />
        </div>
        <div v-else-if="active?.error" class="flex justify-center py-3">
          <button
            type="button"
            class="harbor-ghost-action rounded-full px-4 py-1.5 text-sm font-semibold text-harbor-accent"
            @click="loadPage(activeKind)"
          >
            Retry loading
          </button>
        </div>
        <div ref="sentinel" class="h-px" aria-hidden="true" />
      </div>
    </template>

    <FilePreview
      v-if="previewAttachments.length"
      elevated
      :attachments="previewAttachments"
      v-model:active-index="previewIndex"
      :attachment-urls="cache.urls.value"
      @close="previewAttachments = []"
    />
  </section>
</template>
