import { onBeforeUnmount, ref } from 'vue';

// Avatars are served behind auth, so they are fetched as blobs and exposed as object URLs keyed by source path.
export function useAvatarCache(load: (path: string) => Promise<Blob>) {
  const urls = ref<Record<string, string>>({});
  const loadingPaths = ref(new Set<string>());
  let generation = 0;

  async function ensure(paths: string[]) {
    const currentGeneration = generation;
    const missing = [...new Set(paths)].filter((path) => !urls.value[path] && !loadingPaths.value.has(path));
    if (!missing.length) return;

    loadingPaths.value = new Set([...loadingPaths.value, ...missing]);
    await Promise.all(
      missing.map(async (path) => {
        try {
          const avatar = await load(path);
          if (currentGeneration !== generation) return;
          urls.value = { ...urls.value, [path]: URL.createObjectURL(avatar) };
        } catch (error) {
          console.error('[useAvatarCache] Failed to load avatar:', error);
        } finally {
          if (currentGeneration === generation) {
            const nextLoadingPaths = new Set(loadingPaths.value);
            nextLoadingPaths.delete(path);
            loadingPaths.value = nextLoadingPaths;
          }
        }
      }),
    );
  }

  function clear() {
    generation += 1;
    Object.values(urls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    urls.value = {};
    loadingPaths.value = new Set();
  }

  onBeforeUnmount(clear);

  return {
    urls,
    ensure,
    clear,
    isLoading: (path: string) => loadingPaths.value.has(path),
  };
}
