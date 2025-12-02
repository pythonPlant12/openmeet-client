import { reactive, readonly } from 'vue';

export interface ThemeBranding {
  appName: string;
  appTagline: string;
  companyName: string;
  logoText: string;
}

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface ThemeConfig {
  branding: ThemeBranding;
  colors: ThemeColors;
  radius: string;
  backgroundImageUrl?: string;
}

const defaultTheme: ThemeConfig = {
  branding: {
    appName: 'OpenMeet',
    appTagline: 'Free & Open Video Conferencing',
    companyName: 'OpenMeet',
    logoText: 'OM',
  },
  colors: {
    primary: '154 94% 40%',
    primaryForeground: '0 0% 100%',
    secondary: '0 0% 28%',
    secondaryForeground: '0 0% 100%',
    background: '0 0% 12%',
    foreground: '0 0% 100%',
    card: '0 0% 18%',
    cardForeground: '0 0% 100%',
    muted: '0 0% 28%',
    mutedForeground: '220 13% 69%',
    accent: '154 94% 40%',
    accentForeground: '0 0% 100%',
    destructive: '0 84% 60%',
    destructiveForeground: '0 0% 100%',
    border: '154 94% 40% / 0.29',
    input: '0 0% 28%',
    ring: '154 94% 40%',
  },
  radius: '0.75rem',
};

const state = reactive<{ theme: ThemeConfig; loaded: boolean }>({
  theme: { ...defaultTheme },
  loaded: false,
});

function applyThemeToDocument(theme: ThemeConfig) {
  const root = document.documentElement;

  // Apply colors
  const colorMap: Record<string, keyof ThemeColors> = {
    '--primary': 'primary',
    '--primary-foreground': 'primaryForeground',
    '--secondary': 'secondary',
    '--secondary-foreground': 'secondaryForeground',
    '--background': 'background',
    '--foreground': 'foreground',
    '--card': 'card',
    '--card-foreground': 'cardForeground',
    '--muted': 'muted',
    '--muted-foreground': 'mutedForeground',
    '--accent': 'accent',
    '--accent-foreground': 'accentForeground',
    '--destructive': 'destructive',
    '--destructive-foreground': 'destructiveForeground',
    '--border': 'border',
    '--input': 'input',
    '--ring': 'ring',
    '--popover': 'card',
    '--popover-foreground': 'cardForeground',
  };

  for (const [cssVar, colorKey] of Object.entries(colorMap)) {
    root.style.setProperty(cssVar, theme.colors[colorKey]);
  }

  // Apply radius
  root.style.setProperty('--radius', theme.radius);

  // Generate chart colors based on primary
  const primaryHsl = theme.colors.primary.split(' ');
  if (primaryHsl.length >= 3) {
    const hue = primaryHsl[0];
    root.style.setProperty('--chart-1', theme.colors.primary);
    root.style.setProperty('--chart-2', `${hue} 80% 50%`);
    root.style.setProperty('--chart-3', `${hue} 70% 60%`);
    root.style.setProperty('--chart-4', `${hue} 60% 70%`);
    root.style.setProperty('--chart-5', `${hue} 50% 80%`);
  }
}

export async function initializeTheme(): Promise<ThemeConfig> {
  try {
    const response = await fetch('/theme.json');
    if (!response.ok) throw new Error('Failed to load theme');

    const themeData = await response.json();
    state.theme = { ...defaultTheme, ...themeData };
    applyThemeToDocument(state.theme);
    state.loaded = true;
    return state.theme;
  } catch {
    // Use default theme if loading fails
    applyThemeToDocument(defaultTheme);
    state.loaded = true;
    return defaultTheme;
  }
}

export function useTheme() {
  const setTheme = (newTheme: Partial<ThemeConfig>) => {
    if (newTheme.branding) {
      state.theme.branding = { ...state.theme.branding, ...newTheme.branding };
    }
    if (newTheme.colors) {
      state.theme.colors = { ...state.theme.colors, ...newTheme.colors };
    }
    if (newTheme.radius) {
      state.theme.radius = newTheme.radius;
    }
    applyThemeToDocument(state.theme);
  };

  const setColor = (key: keyof ThemeColors, value: string) => {
    state.theme.colors[key] = value;

    // Sync accent, ring, and border with primary for consistent hover/focus effects
    if (key === 'primary') {
      state.theme.colors.accent = value;
      state.theme.colors.ring = value;
      // Update border with opacity
      state.theme.colors.border = `${value} / 0.29`;
    }

    applyThemeToDocument(state.theme);
  };

  const setBranding = (key: keyof ThemeBranding, value: string) => {
    state.theme.branding[key] = value;
  };

  const setBackgroundImageUrl = (url: string) => {
    state.theme.backgroundImageUrl = url || undefined;
  };

  const resetTheme = () => {
    state.theme = { ...defaultTheme };
    applyThemeToDocument(state.theme);
  };

  const exportTheme = (): string => {
    return JSON.stringify(state.theme, null, 2);
  };

  return {
    theme: readonly(state.theme),
    loaded: readonly(state).loaded,
    setTheme,
    setColor,
    setBranding,
    setBackgroundImageUrl,
    resetTheme,
    exportTheme,
  };
}
