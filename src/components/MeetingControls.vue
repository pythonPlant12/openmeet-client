<script setup lang="ts">
import { Check, Copy, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-vue-next';
import { ref } from 'vue';

import { Button } from '@/components/ui/button';

interface Props {
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
}

interface Emits {
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'end-call'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const copied = ref(false);

const copyMeetingLink = async () => {
  const link = `${window.location.origin}/meet/${window.location.pathname.split('/').pop()}`;
  await navigator.clipboard.writeText(link);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <code class="text-xs text-muted-foreground font-mono">{{ meetingId }}</code>
        <Button variant="ghost" size="sm" @click="copyMeetingLink" class="h-8 w-8 p-0">
          <Check v-if="copied" class="h-4 w-4" />
          <Copy v-else class="h-4 w-4" />
        </Button>
      </div>

      <div class="flex items-center gap-3">
        <Button
          :variant="isMuted ? 'destructive' : 'secondary'"
          size="icon"
          @click="emit('toggle-mute')"
          class="h-12 w-12 rounded-full"
        >
          <MicOff v-if="isMuted" class="h-5 w-5" />
          <Mic v-else class="h-5 w-5" />
        </Button>

        <Button
          :variant="isVideoOff ? 'destructive' : 'secondary'"
          size="icon"
          @click="emit('toggle-video')"
          class="h-12 w-12 rounded-full"
        >
          <VideoOff v-if="isVideoOff" class="h-5 w-5" />
          <Video v-else class="h-5 w-5" />
        </Button>

        <Button variant="destructive" size="icon" @click="emit('end-call')" class="h-12 w-12 rounded-full">
          <PhoneOff class="h-5 w-5" />
        </Button>
      </div>

      <div class="w-[120px]"></div>
    </div>
  </div>
</template>
