import { onBeforeUnmount, ref } from 'vue';

// Private attachment URLs require an authenticated fetch. Cache blobs per account so an attachment
// remains available across chat revisits without making it visible to a different browser session.
export function useAttachmentCache(cacheScope: () => string | null | undefined, load: (path: string) => Promise<Blob>) {
  const urls = ref<Record<string, string>>({});
  const loadingPaths = ref(new Set<string>());
  const failedPaths = ref(new Set<string>());
  let generation = 0;

  async function cachedBlob(path: string) {
    if (!('caches' in window)) return load(path);

    const cacheKey = new URL(path, window.location.origin).href;
    let cache: Cache | null = null;
    try {
      cache = await window.caches.open(`openmeet-chat-attachments-v1-${cacheScope() ?? 'anonymous'}`);
      const cached = await cache.match(cacheKey);
      if (cached) return cached.blob();
    } catch (error) {
      console.warn('[useAttachmentCache] Browser cache unavailable:', error);
    }

    const attachment = await load(path);
    if (cache) {
      try {
        await cache.put(cacheKey, new Response(attachment));
      } catch (error) {
        console.warn('[useAttachmentCache] Failed to cache attachment:', error);
      }
    }
    return attachment;
  }

  async function ensure(paths: string[]) {
    const currentGeneration = generation;
    const missing = [...new Set(paths)].filter((path) => !urls.value[path] && !loadingPaths.value.has(path));
    if (!missing.length) return;

    loadingPaths.value = new Set([...loadingPaths.value, ...missing]);
    const next = [...missing];
    const worker = async () => {
      while (next.length) {
        const path = next.shift()!;
        try {
          const attachment = await cachedBlob(path);
          if (currentGeneration !== generation) return;
          urls.value = { ...urls.value, [path]: URL.createObjectURL(attachment) };
          const nextFailedPaths = new Set(failedPaths.value);
          nextFailedPaths.delete(path);
          failedPaths.value = nextFailedPaths;
        } catch (error) {
          console.error('[useAttachmentCache] Failed to load attachment:', error);
          failedPaths.value = new Set([...failedPaths.value, path]);
        } finally {
          if (currentGeneration === generation) {
            const nextLoadingPaths = new Set(loadingPaths.value);
            nextLoadingPaths.delete(path);
            loadingPaths.value = nextLoadingPaths;
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, missing.length) }, worker));
  }

  function clear() {
    generation += 1;
    Object.values(urls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    urls.value = {};
    loadingPaths.value = new Set();
    failedPaths.value = new Set();
  }

  onBeforeUnmount(clear);

  return {
    urls,
    ensure,
    clear,
    isLoading: (path: string) => loadingPaths.value.has(path),
    hasError: (path: string) => failedPaths.value.has(path),
  };
}
