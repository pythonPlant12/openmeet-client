<script setup lang="ts">
import { Database, Picker } from 'emoji-picker-element';
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url';
import { Smile } from 'lucide-vue-next';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';

const props = defineProps<{
  prefersReducedMotion: boolean;
  composer: HTMLTextAreaElement | null;
  disabled?: boolean;
}>();

const content = defineModel<string>({ required: true });
const mount = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const isLoading = ref(false);
const error = ref('');
let picker: Picker | null = null;
let database: Database | null = null;
let loadPromise: Promise<void> | null = null;

function insertEmoji(event: CustomEvent<{ unicode?: string }>) {
  const emoji = event.detail.unicode;
  if (!emoji) return;

  const composer = props.composer;
  const start = composer?.selectionStart ?? content.value.length;
  const end = composer?.selectionEnd ?? content.value.length;
  content.value = `${content.value.slice(0, start)}${emoji}${content.value.slice(end)}`;

  // The picker stays open for several picks; touch devices skip focusing so the keyboard does not cover it.
  void nextTick(() => {
    const cursor = start + emoji.length;
    if (window.matchMedia?.('(hover: hover)').matches) composer?.focus();
    composer?.setSelectionRange(cursor, cursor);
  });
}

async function ensurePicker() {
  if (!mount.value) return;
  if (picker) {
    if (picker.parentElement !== mount.value) mount.value.append(picker);
    return;
  }
  if (loadPromise) return loadPromise;

  isLoading.value = true;
  error.value = '';
  loadPromise = (async () => {
    try {
      database ??= new Database({ dataSource: emojiDataUrl, locale: 'en' });
      await database.ready();
      if (!mount.value) return;

      picker = new Picker({ dataSource: emojiDataUrl, locale: 'en' });
      picker.addEventListener('emoji-click', insertEmoji);
      mount.value.append(picker);
    } catch (cause) {
      console.error('[EmojiPickerButton] Failed to load emoji picker:', cause);
      error.value = 'Emoji data could not load. Check storage access, then retry.';
      await database
        ?.close()
        .catch((closeError) => console.error('[EmojiPickerButton] Failed to close emoji database:', closeError));
      database = null;
    } finally {
      isLoading.value = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

watch(isOpen, (open) => {
  if (open) void nextTick(ensurePicker);
});

onBeforeUnmount(() => {
  picker?.removeEventListener('emoji-click', insertEmoji);
  picker?.remove();
  void database?.close().catch((cause) => console.error('[EmojiPickerButton] Failed to close emoji database:', cause));
});
</script>

<template>
  <!-- A portalled popover, like the app's menus: it stays on top of everything and inside the viewport. -->
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="harbor-ghost-action size-11 shrink-0 rounded-xl text-[#0B7A75]"
        :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isOpen }"
        aria-label="Choose emoji"
        title="Choose emoji"
        :disabled="disabled"
      >
        <Smile class="size-5" />
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <!-- Picking an emoji focuses the composer on pointer devices; that must not close the picker. -->
      <PopoverContent
        id="emoji-picker"
        side="top"
        align="end"
        :side-offset="8"
        :collision-padding="12"
        class="z-[2000] flex max-h-[var(--reka-popover-content-available-height)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white p-1 shadow-[0_18px_48px_rgba(16,47,53,0.18)] focus:outline-none"
        :class="
          prefersReducedMotion
            ? ''
            : 'origin-[var(--reka-popover-content-transform-origin)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=closed]:duration-150'
        "
        @open-auto-focus.prevent
        @focus-outside.prevent
      >
        <div v-if="isLoading" class="flex min-h-64 items-center justify-center">
          <LoadingRipple class="size-6 text-[#0B7A75]" />
        </div>
        <div v-else-if="error" class="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center">
          <p class="text-sm leading-5 text-[#9D4636]">{{ error }}</p>
          <Button
            type="button"
            variant="outline"
            class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
            @click="ensurePicker"
          >
            Retry
          </Button>
        </div>
        <div
          ref="mount"
          class="max-h-[min(26rem,55dvh)] min-h-0 flex-1 overflow-y-auto [&>emoji-picker]:w-full"
          :class="{ hidden: isLoading || error }"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
