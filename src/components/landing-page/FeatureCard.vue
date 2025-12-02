<script setup lang="ts">
import { type Component, ref } from 'vue';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  icon: Component;
  title: string;
  description: string;
}

defineProps<Props>();

const cardTransform = ref('');

const handleMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const maxRotation = 8;

  const xDistance = Math.abs(x - centerX);
  let yRotation = (xDistance * maxRotation) / centerX;
  yRotation = x < centerX ? -yRotation : yRotation;

  const yDistance = Math.abs(y - centerY);
  let xRotation = (yDistance * maxRotation) / centerY;
  xRotation = y < centerY ? xRotation : -xRotation;

  cardTransform.value = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg) translateY(-4px) scale(1.02)`;
};

const handleMouseLeave = () => {
  cardTransform.value = '';
};
</script>

<template>
  <div class="cursor-pointer" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
    <Card
      class="h-full transition-all duration-100 ease-out hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
      :style="{ transform: cardTransform }"
    >
      <CardHeader>
        <div
          class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 transition-colors group-hover:bg-primary/20"
        >
          <component :is="icon" class="w-6 h-6" />
        </div>
        <CardTitle class="text-lg">{{ title }}</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground text-sm">{{ description }}</p>
      </CardContent>
    </Card>
  </div>
</template>
