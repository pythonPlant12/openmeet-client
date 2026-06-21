const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function browserHostname(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.location.hostname;
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function replacementHost(currentHostname = browserHostname()): string | null {
  if (!currentHostname || isLoopbackHost(currentHostname)) {
    return null;
  }

  return currentHostname;
}

export function resolveReachableWebSocketUrl(configuredUrl: string): string {
  const host = replacementHost();
  if (!host) {
    return configuredUrl;
  }

  try {
    const url = new URL(configuredUrl);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = host;
    }

    return url.toString();
  } catch {
    return configuredUrl;
  }
}

export function resolveReachableTurnUrl(configuredUrl: string): string {
  const host = replacementHost();
  if (!host) {
    return configuredUrl;
  }

  const match = /^(turns?):([^/?]+)(.*)$/i.exec(configuredUrl);
  if (!match) {
    return configuredUrl;
  }

  const [, scheme, address, suffix] = match;
  const [hostname, port] = address.split(':');

  if (!hostname || !isLoopbackHost(hostname)) {
    return configuredUrl;
  }

  return `${scheme}:${host}${port ? `:${port}` : ''}${suffix}`;
}
