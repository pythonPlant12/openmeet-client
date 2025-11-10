/**
 * Cookie utility functions
 * These work with native document.cookie API and can be used anywhere
 * (Vue components, XState machines, plain TypeScript files)
 */
export const cookieUtils = {
  /**
   * Set a cookie with expiration in days
   */
  set(name: string, value: string, days: number) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  },

  /**
   * Get a cookie value by name
   */
  get(name: string): string | null {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },

  /**
   * Remove a cookie by setting its expiration to the past
   * Note: This is the standard way to remove cookies in browsers
   * There is no direct "delete" method for cookies
   */
  remove(name: string) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
  },
};
