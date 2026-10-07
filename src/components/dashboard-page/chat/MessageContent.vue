<script setup lang="ts">
import { computed } from 'vue';

import { findMeetingReferences, firstPreviewableLink, splitMessageLinks } from '@/lib/message-links';

import LinkPreviewCard from './LinkPreviewCard.vue';
import MeetingLinkCard from './MeetingLinkCard.vue';

const props = defineProps<{ content: string; local: boolean }>();

const segments = computed(() => splitMessageLinks(props.content));
const meetings = computed(() => findMeetingReferences(props.content));
const previewUrl = computed(() => firstPreviewableLink(props.content));
</script>

<template>
  <p class="whitespace-pre-wrap break-words leading-snug">
    <template v-for="(segment, index) in segments" :key="index"
      ><a
        v-if="segment.kind === 'link'"
        :href="segment.href"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="break-all underline underline-offset-2"
        :class="local ? 'text-white decoration-white/60' : 'text-[#0B7A75] decoration-[#0B7A75]/40'"
        >{{ segment.text }}</a
      ><template v-else>{{ segment.text }}</template></template
    >
  </p>
  <MeetingLinkCard v-for="meeting in meetings" :key="meeting.roomRef" :reference="meeting" :local="local" />
  <LinkPreviewCard v-if="previewUrl" :url="previewUrl" :local="local" />
</template>
