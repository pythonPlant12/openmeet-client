<script setup lang="ts">
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Database,
  Download,
  Github,
  Palette,
  RotateCcw,
  Server,
  Shield,
  Users,
  Video,
  Zap,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import FeatureCard from '@/components/landing-page/FeatureCard.vue';
import TheFooter from '@/components/layout/TheFooter.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ThemeColors, useTheme } from '@/composables/useTheme';

const router = useRouter();
const { theme, setColor, setBranding, setBackgroundImageUrl, resetTheme, exportTheme } = useTheme();

const copied = ref(false);
const activeTab = ref<'colors' | 'branding'>('colors');

const colorInputs = computed(() => [
  { key: 'primary' as keyof ThemeColors, label: 'Primary', description: 'Main brand color' },
  { key: 'background' as keyof ThemeColors, label: 'Background', description: 'Page background' },
  { key: 'foreground' as keyof ThemeColors, label: 'Main Text', description: 'Default text color' },
  { key: 'mutedForeground' as keyof ThemeColors, label: 'Muted Text', description: 'Secondary text color' },
  { key: 'card' as keyof ThemeColors, label: 'Card', description: 'Card backgrounds' },
  { key: 'cardForeground' as keyof ThemeColors, label: 'Card Text', description: 'Text inside cards' },
]);

const backgroundUrlError = ref('');

function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (optional field)
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function handleBackgroundUrlChange(value: string) {
  if (isValidUrl(value)) {
    backgroundUrlError.value = '';
    setBackgroundImageUrl(value);
  } else {
    backgroundUrlError.value = 'Please enter a valid URL';
  }
}

function hslToHex(hsl: string): string {
  const parts = hsl.split(' ');
  if (parts.length < 3) return '#10b981';

  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '154 94% 40%';

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function handleColorChange(key: keyof ThemeColors, event: Event) {
  const hex = (event.target as HTMLInputElement).value;
  setColor(key, hexToHsl(hex));
}

function handleBrandingChange(key: 'appName' | 'appTagline' | 'companyName' | 'logoText', value: string | number) {
  setBranding(key, String(value));
}

async function copyConfig() {
  await navigator.clipboard.writeText(exportTheme());
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function downloadConfig() {
  const blob = new Blob([exportTheme()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'theme.json';
  a.click();
  URL.revokeObjectURL(url);
}

const features = [
  {
    icon: Video,
    title: 'HD Video Calls',
    description: 'Clear video with adaptive bitrate that adjusts to your connection.',
  },
  {
    icon: Users,
    title: 'Group Meetings',
    description: 'Host meetings with multiple participants using our SFU architecture.',
  },
  {
    icon: Clock,
    title: 'No Time Limits',
    description: 'Your meetings can run as long as you need. No artificial restrictions.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Self-hosted means your data never leaves your infrastructure.',
  },
  {
    icon: Server,
    title: 'Easy Deployment',
    description: 'Single VPS with Docker. Get running in under 10 minutes.',
  },
  {
    icon: Palette,
    title: 'White-label Ready',
    description: 'Change colors, branding, and make it completely yours.',
  },
];

const techStack = [
  { icon: Zap, name: 'Vue 3', description: 'Modern reactive frontend' },
  { icon: Server, name: 'Rust SFU', description: 'High performance media server' },
  { icon: Shield, name: 'TURN Server', description: 'Reliable NAT traversal' },
  { icon: Database, name: 'PostgreSQL', description: 'Robust data storage' },
];
</script>

<template>
  <div class="min-h-[calc(100vh-80px)]">
    <!-- Hero Section -->
    <section
      class="py-24 px-6 text-center bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.1)_0%,transparent_50%)]"
    >
      <div class="max-w-3xl mx-auto">
        <div
          class="inline-block px-4 py-2 mb-6 text-sm rounded-full bg-primary/10 border border-primary/30 text-primary opacity-0 animate-fade-in"
        >
          Open Source Video Conferencing
        </div>

        <h1
          class="text-5xl md:text-7xl font-extrabold leading-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent opacity-0 animate-fade-in [animation-delay:100ms]"
        >
          {{ theme.branding.appName }}
        </h1>

        <p class="text-xl text-primary mb-6 opacity-0 animate-fade-in [animation-delay:200ms]">
          {{ theme.branding.appTagline }}
        </p>

        <p class="text-lg text-muted-foreground leading-relaxed mb-8 opacity-0 animate-fade-in [animation-delay:300ms]">
          A free, open-source alternative to Google Meet and Microsoft Teams. Self-host on any VPS, customize the
          branding, and own your video conferencing infrastructure. No time limits, no tracking, no compromises.
        </p>

        <div class="flex gap-4 justify-center flex-wrap opacity-0 animate-fade-in [animation-delay:400ms]">
          <Button size="lg" @click="router.push('/login')">
            Start a Meeting
            <ArrowRight class="w-4 h-4 ml-2" />
          </Button>
          <Button size="lg" variant="outline" as="a" href="https://github.com/pythonPlant12/openmeet" target="_blank">
            <Github class="w-4 h-4 mr-2" />
            View on GitHub
          </Button>
        </div>
      </div>
    </section>

    <!-- Tech Stack -->
    <section class="py-12 border-y border-border bg-card/50">
      <div class="max-w-5xl mx-auto px-6">
        <p class="text-center text-sm text-muted-foreground mb-6">Built with modern technologies</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div
            v-for="(tech, index) in techStack"
            :key="tech.name"
            class="flex items-center gap-3 opacity-0 animate-fade-in-up transition-transform hover:scale-105"
            :style="{ animationDelay: `${500 + index * 100}ms` }"
          >
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <component :is="tech.icon" class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-sm">{{ tech.name }}</p>
              <p class="text-xs text-muted-foreground">{{ tech.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 px-6">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-2">Why {{ theme.branding.appName }}?</h2>
        <p class="text-center text-muted-foreground mb-12">Built for teams who value privacy and flexibility</p>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            v-for="(feature, index) in features"
            :key="feature.title"
            :icon="feature.icon"
            :title="feature.title"
            :description="feature.description"
            class="opacity-0 animate-fade-in-up"
            :style="{ animationDelay: `${index * 100}ms` }"
          />
        </div>
      </div>
    </section>

    <!-- Customization Demo Section -->
    <section class="py-20 px-6 bg-card/50">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-2">Make It Yours</h2>
        <p class="text-center text-muted-foreground mb-12">
          Customize everything to match your brand. Try it below — changes are live but temporary.
        </p>

        <div class="grid lg:grid-cols-[2fr_1fr] gap-6">
          <Card>
            <CardHeader>
              <div class="flex gap-2">
                <button
                  :class="[
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors',
                    activeTab === 'colors'
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50',
                  ]"
                  @click="activeTab = 'colors'"
                >
                  <Palette class="w-4 h-4" />
                  Colors
                </button>
                <button
                  :class="[
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors',
                    activeTab === 'branding'
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50',
                  ]"
                  @click="activeTab = 'branding'"
                >
                  <span
                    class="w-5 h-5 rounded bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
                  >
                    {{ theme.branding.logoText.slice(0, 2) }}
                  </span>
                  Branding
                </button>
              </div>
            </CardHeader>

            <CardContent>
              <!-- Colors Tab -->
              <div v-if="activeTab === 'colors'" class="mb-6">
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div v-for="color in colorInputs" :key="color.key" class="flex flex-col gap-2">
                    <Label :for="color.key" class="flex flex-col">
                      {{ color.label }}
                      <span class="text-xs text-muted-foreground font-normal">{{ color.description }}</span>
                    </Label>
                    <div class="flex items-center gap-3">
                      <input
                        :id="color.key"
                        type="color"
                        :value="hslToHex(theme.colors[color.key])"
                        class="w-12 h-9 cursor-pointer bg-transparent"
                        @input="handleColorChange(color.key, $event)"
                      />
                      <span class="text-xs font-mono text-muted-foreground">{{ theme.colors[color.key] }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Branding Tab -->
              <div v-if="activeTab === 'branding'" class="mb-6">
                <div class="grid sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-2">
                    <Label for="appName">App Name</Label>
                    <Input
                      id="appName"
                      :model-value="theme.branding.appName"
                      @update:model-value="handleBrandingChange('appName', $event)"
                      placeholder="Your App Name"
                    />
                  </div>
                  <div class="flex flex-col gap-2">
                    <Label for="appTagline">Tagline</Label>
                    <Input
                      id="appTagline"
                      :model-value="theme.branding.appTagline"
                      @update:model-value="handleBrandingChange('appTagline', $event)"
                      placeholder="Your tagline"
                    />
                  </div>
                  <div class="flex flex-col gap-2">
                    <Label for="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      :model-value="theme.branding.companyName"
                      @update:model-value="handleBrandingChange('companyName', $event)"
                      placeholder="Your Company"
                    />
                  </div>
                  <div class="flex flex-col gap-2">
                    <Label for="logoText">Logo Text (2 chars)</Label>
                    <Input
                      id="logoText"
                      :model-value="theme.branding.logoText"
                      @update:model-value="handleBrandingChange('logoText', $event)"
                      placeholder="OM"
                      maxlength="2"
                    />
                  </div>
                  <div class="flex flex-col gap-2 sm:col-span-2">
                    <Label for="backgroundImageUrl">
                      Login Page Background URL
                      <span class="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
                    </Label>
                    <Input
                      id="backgroundImageUrl"
                      :model-value="theme.backgroundImageUrl || ''"
                      @update:model-value="handleBackgroundUrlChange($event as string)"
                      placeholder="https://example.com/background.jpg"
                      :class="{ 'border-destructive': backgroundUrlError }"
                    />
                    <span v-if="backgroundUrlError" class="text-xs text-destructive">{{ backgroundUrlError }}</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" @click="resetTheme">
                  <RotateCcw class="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button variant="outline" size="sm" @click="copyConfig">
                  <Check v-if="copied" class="w-4 h-4 mr-2" />
                  <Copy v-else class="w-4 h-4 mr-2" />
                  {{ copied ? 'Copied!' : 'Copy JSON' }}
                </Button>
                <Button size="sm" @click="downloadConfig">
                  <Download class="w-4 h-4 mr-2" />
                  Download theme.json
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Instructions -->
          <Card class="h-fit">
            <CardHeader>
              <CardTitle class="text-lg">How to Apply</CardTitle>
            </CardHeader>
            <CardContent>
              <ol class="space-y-4">
                <li class="pb-4 border-b border-border">
                  <strong class="block mb-1">1. Customize</strong>
                  <p class="text-sm text-muted-foreground">Use the controls to adjust colors and branding.</p>
                </li>
                <li class="pb-4 border-b border-border">
                  <strong class="block mb-1">2. Export</strong>
                  <p class="text-sm text-muted-foreground">Click "Download theme.json" to save your config.</p>
                </li>
                <li class="pb-4 border-b border-border">
                  <strong class="block mb-1">3. Deploy</strong>
                  <p class="text-sm text-muted-foreground">
                    Replace <code class="px-1.5 py-0.5 rounded bg-muted text-xs">public/theme.json</code> with your
                    file.
                  </p>
                </li>
                <li>
                  <strong class="block mb-1">4. Done</strong>
                  <p class="text-sm text-muted-foreground">Restart and your branding is live. No rebuild needed.</p>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 px-6 text-center bg-gradient-to-b from-transparent to-primary/5">
      <div class="max-w-2xl mx-auto">
        <h2 class="text-3xl font-bold mb-2">Ready to get started?</h2>
        <p class="text-muted-foreground mb-8">Deploy your own video conferencing platform in minutes.</p>
        <Button size="lg" @click="router.push('/login')">
          Start a Meeting
          <ArrowRight class="w-4 h-4 ml-2" />
        </Button>
      </div>
    </section>

    <TheFooter />
  </div>
</template>
