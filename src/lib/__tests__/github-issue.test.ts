import { describe, expect, it } from 'vitest';

import { buildGitHubIssueUrl } from '@/lib/github-issue';

describe('buildGitHubIssueUrl', () => {
  it('includes only whitelisted bounded diagnostics', () => {
    const secret = 'room-secret-token-password';
    const url = new URL(
      buildGitHubIssueUrl('meeting', {
        appVersion: secret,
        userAgent: `Mozilla/5.0 ${secret} Chrome/126.0.0.0 Safari/537.36`,
      }),
    );
    const body = url.searchParams.get('body') ?? '';

    expect(url.origin + url.pathname).toBe('https://github.com/pythonPlant12/openmeet/issues/new');
    expect(url.searchParams.get('labels')).toBe('bug');
    expect(body).toContain('- Area: meeting');
    expect(body).toContain('- App version: unknown');
    expect(body).toContain('- Browser: Chrome 126 (desktop)');
    expect(url.href).not.toContain(secret);
  });

  it('never reads the current room URL', () => {
    window.history.replaceState({}, '', '/room/private-room-id?token=private-token');
    const url = buildGitHubIssueUrl('dashboard', { appVersion: '1.2.3', userAgent: 'Firefox/128' });
    const body = new URL(url).searchParams.get('body') ?? '';

    expect(decodeURIComponent(url)).not.toContain('private-room-id');
    expect(decodeURIComponent(url)).not.toContain('private-token');
    expect(body).toContain('App version: 1.2.3');
  });
});
