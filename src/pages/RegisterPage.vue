<script setup lang="ts">
import { AlertCircle, ArrowLeft, ArrowRight, Video } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

import AuthVisual from '@/components/auth/AuthVisual.vue';
import SplitText from '@/components/marketing/SplitText.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';
import { useBranding } from '@/config/branding.config';
import { AuthEventType } from '@/xstate/machines/auth/types';

const branding = useBranding();
const router = useRouter();
const { t } = useI18n();
const { createMeeting } = useMeetingNavigation();
const { isRegistering, isCheckingSession, hasRegisterError, errorMessage, send } = useAuth();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const passwordMismatch = ref(false);

const handleRegister = () => {
  if (password.value !== confirmPassword.value) {
    passwordMismatch.value = true;
    return;
  }
  passwordMismatch.value = false;

  send({
    type: AuthEventType.REGISTER,
    email: email.value,
    name: name.value,
    password: password.value,
  });
};

const handleRegisterKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || isRegistering.value) return;
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  event.preventDefault();
  handleRegister();
};

const handleRetry = () => {
  send({ type: AuthEventType.RETRY });
};

const goToLogin = () => {
  if (hasRegisterError.value) send({ type: AuthEventType.RETRY });
  router.push('/login');
};
</script>

<template>
  <div class="marketing-font min-h-svh bg-[#FBFCF8] text-[#102F35] lg:grid lg:grid-cols-2">
    <AuthVisual :title="t('auth.register.visualTitle')" :description="t('auth.register.visualDescription')" />

    <section class="flex min-h-svh items-center justify-center px-5 pb-10 pt-[124px] sm:px-10 lg:px-12 xl:px-20">
      <div v-if="isCheckingSession" class="flex flex-col items-center gap-4 text-[#61777B]">
        <LoadingRipple class="text-[#0B7A75]" />
        <p class="text-sm">{{ t('auth.checkingSession') }}</p>
      </div>

      <div v-else class="w-full max-w-md">
        <div class="mb-7 flex items-center justify-between gap-4">
          <RouterLink
            to="/"
            class="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-[#27595D] underline-offset-4 hover:text-[#0B7A75] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
          >
            <ArrowLeft class="size-4" />
            {{ t('common.backToHome') }}
          </RouterLink>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-[#E6F4F1] px-3 py-2 text-sm font-semibold text-[#0B7A75] transition-colors hover:bg-[#D8ECE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] lg:hidden"
            :disabled="isRegistering"
            @click="createMeeting"
          >
            <Video class="size-4" />
            {{ t('auth.meetNow') }}
          </button>
        </div>

        <SplitText
          as="p"
          :text="t('auth.register.eyebrow', { appName: branding.appName })"
          class="text-sm font-semibold text-[#0B7A75]"
        />
        <SplitText
          as="h1"
          :text="t('auth.register.title')"
          :delay="80"
          class="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl"
        />
        <SplitText
          as="p"
          :text="t('auth.register.description')"
          :delay="140"
          class="mt-3 text-base leading-7 text-[#61777B]"
        />

        <form class="mt-7 space-y-4" @submit.prevent="handleRegister" @keydown="handleRegisterKeydown">
          <div class="space-y-2">
            <Label for="name" class="text-[#27595D]">{{ t('auth.register.name') }}</Label>
            <Input
              id="name"
              v-model="name"
              type="text"
              autocomplete="name"
              :placeholder="t('auth.register.namePlaceholder')"
              required
              :disabled="isRegistering"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white px-4 text-[#102F35] shadow-none placeholder:text-[#8AA0A2] focus-visible:ring-[#0B7A75]"
            />
          </div>

          <div class="space-y-2">
            <Label for="email" class="text-[#27595D]">{{ t('auth.email') }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              :placeholder="t('auth.emailPlaceholder')"
              required
              :disabled="isRegistering"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white px-4 text-[#102F35] shadow-none placeholder:text-[#8AA0A2] focus-visible:ring-[#0B7A75]"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="password" class="text-[#27595D]">{{ t('auth.password') }}</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.register.passwordPlaceholder')"
                required
                minlength="6"
                :disabled="isRegistering"
                class="h-11 rounded-xl border-[#D8E7E3] bg-white px-4 text-[#102F35] shadow-none placeholder:text-[#8AA0A2] focus-visible:ring-[#0B7A75]"
              />
            </div>
            <div class="space-y-2">
              <Label for="confirmPassword" class="text-[#27595D]">{{ t('auth.register.confirmPassword') }}</Label>
              <Input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.register.confirmPasswordPlaceholder')"
                required
                :disabled="isRegistering"
                class="h-11 rounded-xl border-[#D8E7E3] bg-white px-4 text-[#102F35] shadow-none placeholder:text-[#8AA0A2] focus-visible:ring-[#0B7A75]"
              />
            </div>
          </div>

          <div
            v-if="passwordMismatch || hasRegisterError"
            role="alert"
            class="flex items-start gap-2.5 rounded-xl bg-[#fff0ef] p-3.5 text-sm text-[#a62f2f]"
          >
            <AlertCircle class="mt-0.5 size-4 shrink-0" />
            {{ passwordMismatch ? t('auth.register.passwordMismatch') : errorMessage }}
          </div>

          <Button
            type="submit"
            class="harbor-primary-action h-12 w-full rounded-full bg-[#0B7A75] text-base text-white shadow-[0_12px_28px_rgba(11,122,117,0.18)]"
            :disabled="isRegistering"
          >
            <LoadingRipple v-if="isRegistering" size="sm" />
            {{ isRegistering ? t('auth.register.submitting') : t('auth.register.title') }}
            <ArrowRight v-if="!isRegistering" class="size-4" />
          </Button>

          <Button
            v-if="hasRegisterError"
            type="button"
            variant="outline"
            class="harbor-soft-action h-11 w-full rounded-full border-transparent bg-[#E6F4F1] text-[#27595D]"
            @click="handleRetry"
          >
            {{ t('common.retry') }}
          </Button>
        </form>

        <div
          class="mt-6 flex flex-col gap-3 border-t border-[#D8E7E3] pt-6 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-[#61777B]">
            <SplitText as="span" :text="t('auth.register.alreadyRegistered')" />
            <button
              type="button"
              class="font-semibold text-[#0B7A75] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isRegistering"
              @click="goToLogin"
            >
              {{ t('common.logIn') }}
            </button>
          </p>
          <button
            type="button"
            :disabled="isRegistering"
            class="inline-flex items-center gap-1.5 font-semibold text-[#27595D] underline-offset-4 hover:text-[#0B7A75] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] disabled:cursor-not-allowed disabled:opacity-50"
            @click="createMeeting"
          >
            {{ t('auth.register.skip') }} <ArrowRight class="size-4" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
