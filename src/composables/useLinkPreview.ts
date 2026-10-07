import { type Ref, onScopeDispose, ref, watch } from 'vue';

import { type LinkPreview, hasStoredSession, socialApi } from '@/services/social-api';
import { cookieUtils } from '@/utils';

// Previews and their images rarely change, so each is fetched once per page load.
const previews = new Map<string, Promise<LinkPreview | null>>();
const images = new Map<string, Promise<string | null>>();

function loadPreview(url: string) {
  let preview = previews.get(url);
  if (!preview) {
    preview = socialApi.getLinkPreview(cookieUtils.get('accessToken') ?? '', url).catch(() => null);
    previews.set(url, preview);
  }
  return preview;
}

function loadImage(url: string) {
  let image = images.get(url);
  if (!image) {
    image = socialApi
      .loadLinkPreviewImage(cookieUtils.get('accessToken') ?? '', url)
      .then((blob) => URL.createObjectURL(blob))
      .catch(() => null);
    images.set(url, image);
  }
  return image;
}

export function useLinkPreview(url: Ref<string | null>) {
  const preview = ref<LinkPreview | null>(null);
  const imageUrl = ref<string | null>(null);
  let active = true;

  watch(
    url,
    async (current) => {
      preview.value = null;
      imageUrl.value = null;
      if (!current || !hasStoredSession()) return;
      const loaded = await loadPreview(current);
      if (!active || url.value !== current) return;
      preview.value = loaded;
      if (!loaded?.hasImage) return;
      const image = await loadImage(current);
      if (active && url.value === current) imageUrl.value = image;
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    active = false;
  });
  return { preview, imageUrl };
}
