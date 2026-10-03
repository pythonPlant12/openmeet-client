<script setup lang="ts">
import { Database, Picker } from 'emoji-picker-element';
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url';
import { Smile } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { nextTick, onBeforeUnmount, ref } from 'vue';

import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';

const props = defineProps<{ prefersReducedMotion: boolean; composer: HTMLTextAreaElement | null }>();

const content = defineModel<string>({ required: true });
const control = ref<HTMLElement | null>(null);
const popover = ref<HTMLElement | null>(null);
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
  isOpen.value = false;

  void nextTick(() => {
    const cursor = start + emoji.length;
    composer?.focus();
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

function toggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) void nextTick(ensurePicker);
}

function closeOnOutsideClick(event: PointerEvent) {
  if (!isOpen.value) return;
  const path = event.composedPath();
  if ((control.value && path.includes(control.value)) || (popover.value && path.includes(popover.value))) return;
  isOpen.value = false;
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isOpen.value) return;
  isOpen.value = false;
  control.value?.querySelector<HTMLButtonElement>('button')?.focus();
}

document.addEventListener('pointerdown', closeOnOutsideClick, true);
document.addEventListener('keydown', closeOnEscape);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick, true);
  document.removeEventListener('keydown', closeOnEscape);
  picker?.removeEventListener('emoji-click', insertEmoji);
  picker?.remove();
  void database?.close().catch((cause) => console.error('[EmojiPickerButton] Failed to close emoji database:', cause));
});
</script>

<template>
  <span ref="control" class="relative shrink-0">
    <Button
      type="button"
      size="icon"
      variant="ghost"
      class="harbor-ghost-action size-11 rounded-xl text-[#0B7A75]"
      :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isOpen }"
      :aria-expanded="isOpen"
      aria-controls="emoji-picker"
      aria-label="Choose emoji"
      title="Choose emoji"
      @click="toggle"
    >
      <Smile class="size-5" />
    </Button>
    <AnimatePresence>
      <motion.div
        v-if="isOpen"
        id="emoji-picker"
        ref="popover"
        :initial="prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="prefersReducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.96 }"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }"
        class="fixed inset-x-3 bottom-20 z-30 overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white p-1 shadow-[0_18px_48px_rgba(16,47,53,0.18)] md:absolute md:inset-x-auto md:bottom-full md:right-0 md:mb-2 md:w-[min(22rem,calc(100vw-2rem))]"
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
          class="max-h-[min(26rem,55dvh)] overflow-y-auto [&>emoji-picker]:w-full"
          :class="{ hidden: isLoading || error }"
        />
      </motion.div>
    </AnimatePresence>
  </span>
</template>
