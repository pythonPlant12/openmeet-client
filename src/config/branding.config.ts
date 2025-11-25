export interface BrandingConfig {
  appName: string;
  appTagline: string;
  companyName: string;
  logoText: string;
}

const brandingConfig: BrandingConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'AirConsole Meet',
  appTagline: import.meta.env.VITE_APP_TAGLINE || 'Secure Video Conferencing',
  companyName: import.meta.env.VITE_COMPANY_NAME || 'AirConsole',
  logoText: import.meta.env.VITE_LOGO_TEXT || 'AC',
};

export default brandingConfig;
