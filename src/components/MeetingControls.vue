<script setup lang="ts">
import { Check, Code, Copy, Link2, Mic, MicOff, PhoneOff, Share2, Video, VideoOff } from 'lucide-vue-next';
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  showStats: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
}

interface Emits {
  (e: 'toggle-stats'): void;
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'end-call'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const copiedLink = ref(false);
const copiedId = ref(false);

const copyMeetingLink = async () => {
  const link = `${window.location.origin}/meet/${props.meetingId}`;
  await navigator.clipboard.writeText(link);
  copiedLink.value = true;
  setTimeout(() => {
    copiedLink.value = false;
  }, 2000);
};

const copyMeetingId = async () => {
  await navigator.clipboard.writeText(props.meetingId);
  copiedId.value = true;
  setTimeout(() => {
    copiedId.value = false;
  }, 2000);
};

const shareOnWhatsApp = () => {
  const link = `${window.location.origin}/meet/${props.meetingId}`;
  const text = `Join my video call: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

const shareOnTelegram = () => {
  const link = `${window.location.origin}/meet/${props.meetingId}`;
  const text = `Join my video call`;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
};
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
    <div class="py-4 flex items-center justify-center">
      <div class="flex items-center justify-center gap-3">
        <!-- Stats Button -->
        <Button
          :variant="showStats ? 'ghost' : 'secondary'"
          size="icon"
          @click="emit('toggle-stats')"
          class="h-12 w-12 rounded-full"
        >
          <Code class="h-5 w-5" />
        </Button>

        <!-- Share Dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="icon" class="h-12 w-12 rounded-full">
              <Share2 class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" class="w-56">
            <DropdownMenuItem @click="copyMeetingLink" class="cursor-pointer">
              <Link2 class="mr-2 h-4 w-4" />
              <span>{{ copiedLink ? 'Link copied!' : 'Copy meeting link' }}</span>
              <Check v-if="copiedLink" class="ml-auto h-4 w-4 text-green-500" />
            </DropdownMenuItem>

            <DropdownMenuItem @click="copyMeetingId" class="cursor-pointer">
              <Copy class="mr-2 h-4 w-4" />
              <span>{{ copiedId ? 'ID copied!' : 'Copy meeting ID' }}</span>
              <Check v-if="copiedId" class="ml-auto h-4 w-4 text-green-500" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @click="shareOnWhatsApp" class="cursor-pointer">
              <img src="/icons/social-media/whatsapp.svg" class="mr-2 h-4 w-4" alt="WhatsApp" />
              <span>Share on WhatsApp</span>
            </DropdownMenuItem>

            <DropdownMenuItem @click="shareOnTelegram" class="cursor-pointer">
              <img src="/icons/social-media/telegram.svg" class="mr-2 h-4 w-4" alt="Telegram" />
              <span>Share on Telegram</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Microphone Button -->
        <Button
          :variant="isMuted ? 'destructive' : 'secondary'"
          size="icon"
          @click="emit('toggle-mute')"
          class="h-12 w-12 rounded-full"
        >
          <MicOff v-if="isMuted" class="h-5 w-5" />
          <Mic v-else class="h-5 w-5" />
        </Button>

        <!-- Camera Button -->
        <Button
          :variant="isVideoOff ? 'destructive' : 'secondary'"
          size="icon"
          @click="emit('toggle-video')"
          class="h-12 w-12 rounded-full"
        >
          <VideoOff v-if="isVideoOff" class="h-5 w-5" />
          <Video v-else class="h-5 w-5" />
        </Button>

        <!-- End Call Button -->
        <Button variant="destructive" size="icon" @click="emit('end-call')" class="h-12 w-12 rounded-full">
          <PhoneOff class="h-5 w-5" />
        </Button>
      </div>

      <!-- Spacer for alignment -->
      <div class="w-10"></div>
    </div>
  </div>
</template>
