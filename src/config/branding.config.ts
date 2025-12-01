import { useTheme } from '@/composables/useTheme';

export function useBranding() {
  const { theme } = useTheme();
  return theme.branding;
}
