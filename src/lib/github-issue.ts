export type BugReportArea = 'dashboard' | 'meeting';

const ISSUE_URL = 'https://github.com/pythonPlant12/openmeet/issues/new';

function browserLabel(userAgent: string) {
  const edge = userAgent.match(/Edg\/(\d+)/);
  const firefox = userAgent.match(/Firefox\/(\d+)/);
  const chrome = userAgent.match(/Chrome\/(\d+)/);
  const safari = userAgent.match(/Version\/(\d+).+Safari/);
  const browser = edge
    ? `Edge ${edge[1]}`
    : firefox
      ? `Firefox ${firefox[1]}`
      : chrome
        ? `Chrome ${chrome[1]}`
        : safari
          ? `Safari ${safari[1]}`
          : 'Unknown';
  const device = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop';
  return `${browser} (${device})`;
}

function safeVersion(version: string | undefined) {
  return version && version.length <= 40 && /^v?\d+(?:\.\d+){0,3}(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)
    ? version
    : 'unknown';
}

export function buildGitHubIssueUrl(area: BugReportArea, options: { appVersion?: string; userAgent?: string } = {}) {
  const params = new URLSearchParams({
    title: `[Bug] ${area === 'meeting' ? 'Meeting' : 'Dashboard'} issue`,
    labels: 'bug',
    body: [
      '## What happened?',
      '',
      '<!-- Describe the problem without including meeting links, passwords, or personal information. -->',
      '',
      '## Steps to reproduce',
      '',
      '1. ',
      '',
      '## Safe context',
      '',
      `- Area: ${area}`,
      `- App version: ${safeVersion(options.appVersion ?? import.meta.env.VITE_APP_VERSION)}`,
      `- Browser: ${browserLabel(options.userAgent ?? navigator.userAgent)}`,
    ].join('\n'),
  });

  return `${ISSUE_URL}?${params.toString()}`;
}
