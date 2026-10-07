import { type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
import process from 'node:process';

declare global {
  interface Window {
    __openmeetPeerConnections?: RTCPeerConnection[];
    __openmeetSockets?: WebSocket[];
  }
}

interface RtpSummary {
  audio: number;
  video: number;
  audioPackets: number;
  videoPackets: number;
  audioBytes: number;
  videoBytes: number;
}

// Browser-side network environments. Each one filters the app's own ICE servers, so the matrix exercises
// the real STUN/TURN configuration instead of test-only credentials.
type NetworkMode = 'host' | 'stun' | 'turn' | 'stun+turn';

interface CandidatePath {
  local: string | null;
  remote: string | null;
}

interface MediaSnapshot {
  candidatePath: CandidatePath;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  signalingState: RTCSignalingState | null;
  inbound: RtpSummary;
  outbound: RtpSummary;
  videos: VideoSnapshot[];
}

interface VideoSnapshot {
  isLocal: boolean;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  totalVideoFrames: number | null;
  hasStream: boolean;
  liveAudioTracks: number;
  liveVideoTracks: number;
}

interface BrowserDiagnostic {
  participant: number;
  type: string;
  text: string;
}

interface ParticipantSession {
  contexts: BrowserContext[];
  pages: Page[];
  roomUrl: string;
  diagnostics: BrowserDiagnostic[];
}

const participantCount = 4;
const twoParticipantCount = 2;
const haveCurrentData = 2;
const diagnosticTags = ['[SignalingService]', '[WebRTCServiceSFU]', '[webrtcMachine]'];
const unsafeDiagnosticPattern = /sdp|candidate|token|cookie|credential|password|turn:|turns:|bearer|vite_/i;

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test.describe('multi-participant media', () => {
  test('navigates away from prejoin without transition warnings or stale viewport locks', async ({ page, baseURL }) => {
    const transitionWarnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('Component inside <Transition>')) {
        transitionWarnings.push(message.text());
      }
    });

    await page.goto(`${baseURL}/room/navigation-cleanup-${Date.now()}`);
    await expect(page.getByRole('heading', { name: 'Join Meeting' })).toBeVisible();
    await page.getByRole('link', { name: 'OpenMeet' }).click();

    await expect(page).toHaveURL(new URL('/', baseURL!).toString());
    await expect(page.getByRole('heading', { name: 'Meet freely. Stay connected.' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          bodyOverflow: document.body.style.overflow,
          bodyPointerEvents: document.body.style.pointerEvents,
          htmlOverflow: document.documentElement.style.overflow,
        })),
      )
      .toEqual({ bodyOverflow: '', bodyPointerEvents: '', htmlOverflow: '' });
    expect(transitionWarnings).toEqual([]);
  });

  test('two participants exchange remote audio and video', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);

    const session = await joinParticipants(browser, baseURL!, twoParticipantCount, 'two-participant-media-e2e');

    try {
      expect(session.pages).toHaveLength(twoParticipantCount);
      await waitForParticipantCount(session.pages, twoParticipantCount);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, twoParticipantCount);
      await expectMediaStillFlowing(session.pages, twoParticipantCount - 1);
      await session.pages[0].waitForTimeout(8_000);
      await expectMediaStillFlowing(session.pages, twoParticipantCount - 1);
      await expectNoConnectionErrorDialog(session.pages);

      test.info().annotations.push({
        type: 'room-url',
        description: session.roomUrl,
      });
      test.info().annotations.push({
        type: 'diagnostics',
        description: summarizeDiagnostics(session.diagnostics),
      });
    } finally {
      await closeContexts(session.contexts);
    }
  });

  test('transmits and renders audio/video for every participant', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);

    const session = await joinParticipants(browser, baseURL!, participantCount, 'media-e2e');

    try {
      expect(session.pages).toHaveLength(participantCount);
      await waitForParticipantCount(session.pages, participantCount);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, participantCount);
      await expectMediaStillFlowing(session.pages, participantCount - 1);
      await session.pages[0].waitForTimeout(20_000);
      await expectMediaStillFlowing(session.pages, participantCount - 1);
      await expectNoConnectionErrorDialog(session.pages);
    } finally {
      await closeContexts(session.contexts);
    }
  });

  const networkModes: { mode: NetworkMode; candidate: RegExp }[] = [
    { mode: 'host', candidate: /^(host|srflx|prflx)\/[a-z]+$/ },
    { mode: 'stun', candidate: /^(host|srflx|prflx|relay)\// },
    { mode: 'turn', candidate: /^relay\/|\+turn-/ },
    { mode: 'stun+turn', candidate: /^(host|srflx|prflx|relay)\// },
  ];

  for (const { mode, candidate } of networkModes) {
    test(`keeps four participants connected over ${mode} networking`, async ({ browser, baseURL }) => {
      test.setTimeout(240_000);

      const session = await joinParticipants(browser, baseURL!, participantCount, `network-${mode}-e2e`, mode);

      try {
        await waitForParticipantCount(session.pages, participantCount);
        await waitForAllConnections(session.pages);
        await waitForHtmlVideoPlayback(session.pages, participantCount);

        const snapshots = await collectSnapshots(session.pages);
        // TURN-only rooms must relay through coturn; every other mode just needs a working selected pair.
        expect(
          snapshots.map((snapshot) => snapshot.candidatePath.local ?? ''),
          'selected local candidate per participant',
        ).toEqual(snapshots.map(() => expect.stringMatching(candidate)));
        test.info().annotations.push({
          type: 'candidate-paths',
          description: snapshots
            .map(
              (snapshot, index) => `p${index + 1} ${snapshot.candidatePath.local} -> ${snapshot.candidatePath.remote}`,
            )
            .join(' | '),
        });

        // Problems reported in real rooms are not immediate, so media is re-checked across a longer window.
        for (let round = 0; round < 4; round += 1) {
          await expectMediaStillFlowing(session.pages, participantCount - 1);
          await session.pages[0].waitForTimeout(10_000);
        }
        await expectNoConnectionErrorDialog(session.pages);
      } finally {
        test.info().annotations.push({ type: 'diagnostics', description: summarizeDiagnostics(session.diagnostics) });
        await closeContexts(session.contexts);
      }
    });
  }

  test('keeps five participants streaming through a long session with a leave and a rejoin', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(420_000);
    const count = 5;
    const session = await joinParticipants(browser, baseURL!, count, 'soak-e2e');

    try {
      await waitForParticipantCount(session.pages, count);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, count);

      for (let round = 0; round < 6; round += 1) {
        await expectMediaStillFlowing(session.pages, count - 1);
        await session.pages[0].waitForTimeout(15_000);
      }

      // The second participant reloads mid-call, the way a dropped user rejoins.
      await session.pages[1].reload({ waitUntil: 'domcontentloaded' });
      await session.pages[1].locator('#participant-name').fill('User 2');
      await expect(session.pages[1].getByRole('button', { name: 'Join Meeting' })).toBeEnabled({ timeout: 30_000 });
      await session.pages[1].getByRole('button', { name: 'Join Meeting' }).click();

      await waitForParticipantCount(session.pages, count);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, count);
      for (let round = 0; round < 3; round += 1) {
        await expectMediaStillFlowing(session.pages, count - 1);
        await session.pages[0].waitForTimeout(10_000);
      }
      await expectNoConnectionErrorDialog(session.pages);
    } finally {
      test.info().annotations.push({ type: 'diagnostics', description: summarizeDiagnostics(session.diagnostics) });
      await closeContexts(session.contexts);
    }
  });

  test('recovers a participant whose signaling socket drops mid-call', async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const count = 3;
    const session = await joinParticipants(browser, baseURL!, count, 'socket-drop-e2e');

    try {
      expect(session.pages).toHaveLength(count);
      await waitForParticipantCount(session.pages, count);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, count);

      // A network blip closes the signaling socket; the server drops that participant's peer connection.
      await session.pages[1].evaluate(() => window.__openmeetSockets?.at(-1)?.close());

      await waitForParticipantCount(session.pages, count);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, count);
      await expectMediaStillFlowing(session.pages, count - 1);
      await session.pages[0].waitForTimeout(35_000);
      await expectMediaStillFlowing(session.pages, count - 1);
      await expectNoConnectionErrorDialog(session.pages);
    } finally {
      test.info().annotations.push({ type: 'diagnostics', description: summarizeDiagnostics(session.diagnostics) });
      await closeContexts(session.contexts);
    }
  });

  test('removes an abruptly disconnected participant and keeps remaining media flowing', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);

    const session = await joinParticipants(browser, baseURL!, 3, 'disconnect-e2e');

    try {
      await waitForParticipantCount(session.pages, 3);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, 3);

      await session.contexts[2].close();

      const remainingPages = session.pages.slice(0, 2);
      await waitForParticipantCount(remainingPages, 2);
      await waitForAllConnections(remainingPages);
      await waitForHtmlVideoPlayback(remainingPages, 2);
      await expectMediaStillFlowing(remainingPages, 1);

      for (const [index, page] of remainingPages.entries()) {
        await expect(page.getByTestId('connection-error-dialog'), `participant ${index + 1} error dialog`).toHaveCount(
          0,
        );
      }
    } finally {
      await closeContexts(session.contexts.slice(0, 2));
    }
  });

  test('keeps media alive through a transient disconnected peer state', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);

    const session = await joinParticipants(browser, baseURL!, 2, 'transient-disconnect-e2e');

    try {
      await waitForParticipantCount(session.pages, 2);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, 2);

      await forceConnectionState(session.pages[0], 'disconnected');
      await session.pages[0].waitForTimeout(500);

      await expect(session.pages[0].getByTestId('connection-error-dialog')).toHaveCount(0);
      await forceConnectionState(session.pages[0], 'connected');
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, 2);
      await expectMediaStillFlowing(session.pages, 1);
    } finally {
      await closeContexts(session.contexts);
    }
  });

  test('shows failure dialog and removes stale participant after terminal failure', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);

    const session = await joinParticipants(browser, baseURL!, 2, 'terminal-failure-e2e');

    try {
      await waitForParticipantCount(session.pages, 2);
      await waitForAllConnections(session.pages);
      await waitForHtmlVideoPlayback(session.pages, 2);

      await forceConnectionState(session.pages[0], 'failed');

      await expect(session.pages[0].getByTestId('connection-error-dialog')).toBeVisible({ timeout: 10_000 });
      await expect(session.pages[0].getByText('Connection Lost')).toBeVisible();
      await expect(session.pages[0].getByText('Failed to establish a connection to the meeting')).toBeVisible();
      await expect(session.pages[0].getByTestId('connection-error-leave')).toBeVisible();
      await expect(session.pages[0].getByTestId('connection-error-reload')).toBeVisible();

      await waitForParticipantCount([session.pages[1]], 1);
      await expect(session.pages[1].getByTestId('connection-error-dialog')).toHaveCount(0);

      await session.pages[0].getByTestId('connection-error-leave').click();
      await expect(session.pages[0]).toHaveURL(new URL('/', baseURL!).toString());
    } finally {
      await closeContexts(session.contexts);
    }
  });
});

async function joinParticipants(
  browser: Browser,
  baseURL: string,
  count: number,
  roomPrefix: string,
  network: NetworkMode = 'stun+turn',
): Promise<ParticipantSession> {
  const roomUrl =
    process.env.PLAYWRIGHT_ROOM_URL ?? process.env.OPENMEET_ROOM_URL ?? `${baseURL}/room/${roomPrefix}-${Date.now()}`;
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const diagnostics: BrowserDiagnostic[] = [];

  for (let index = 0; index < count; index += 1) {
    const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
    contexts.push(context);

    await context.addInitScript((mode: NetworkMode) => {
      window.__openmeetPeerConnections = [];
      const OriginalRTCPeerConnection = window.RTCPeerConnection;
      const urlsOf = (server: RTCIceServer) => (Array.isArray(server.urls) ? server.urls : [server.urls]);
      const keepServers = (servers: RTCIceServer[], scheme: RegExp) =>
        servers
          .map((server) => ({ ...server, urls: urlsOf(server).filter((url) => scheme.test(url)) }))
          .filter((server) => server.urls.length > 0);

      const configure = (config: RTCConfiguration = {}): RTCConfiguration => {
        const servers = config.iceServers ?? [];
        if (mode === 'host') return { ...config, iceServers: [] };
        if (mode === 'stun') return { ...config, iceServers: keepServers(servers, /^stuns?:/i) };
        if (mode === 'turn') {
          return { ...config, iceServers: keepServers(servers, /^turns?:/i), iceTransportPolicy: 'relay' };
        }
        return config;
      };

      window.__openmeetSockets = [];
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class TrackedWebSocket extends OriginalWebSocket {
        constructor(...args: ConstructorParameters<typeof WebSocket>) {
          super(...args);
          window.__openmeetSockets?.push(this);
        }
      };

      window.RTCPeerConnection = class TrackedRTCPeerConnection extends OriginalRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(configure(config));
          window.__openmeetPeerConnections?.push(this);
        }
      };
    }, network);

    const page = await context.newPage();
    page.on('console', (message) => recordBrowserDiagnostic(diagnostics, index + 1, message.type(), message.text()));
    pages.push(page);
  }

  for (const [index, page] of pages.entries()) {
    await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#participant-name').fill(`User ${index + 1}`);
    await expect(page.getByRole('button', { name: 'Join Meeting' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Join Meeting' }).click();
    await expect(page.getByTestId('participant-video').first()).toBeAttached({ timeout: 30_000 });
  }

  return { contexts, pages, roomUrl, diagnostics };
}

async function waitForParticipantCount(pages: Page[], expectedParticipants: number) {
  await Promise.all(
    pages.map(async (page) => {
      await expect(page.getByTestId('participant-tile')).toHaveCount(expectedParticipants, { timeout: 60_000 });
      await expect(page.getByTestId('participant-video')).toHaveCount(expectedParticipants, { timeout: 60_000 });
    }),
  );
}

async function waitForAllConnections(pages: Page[]) {
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(
        () => {
          const pc = window.__openmeetPeerConnections?.at(-1);
          return (
            pc?.connectionState === 'connected' &&
            pc.iceConnectionState === 'connected' &&
            pc.signalingState === 'stable'
          );
        },
        null,
        { timeout: 60_000 },
      ),
    ),
  );
}

async function waitForHtmlVideoPlayback(pages: Page[], expectedParticipants: number) {
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(
        (count) => {
          const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-testid="participant-video"]'));
          const remoteVideos = videos.filter((video) => video.dataset.participantLocal !== 'true');

          return (
            videos.length === count &&
            remoteVideos.length === count - 1 &&
            remoteVideos.every((video) => {
              const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
              return (
                stream !== null &&
                stream.getAudioTracks().some((track) => track.readyState === 'live') &&
                stream.getVideoTracks().some((track) => track.readyState === 'live') &&
                video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                video.videoWidth > 0 &&
                video.videoHeight > 0
              );
            })
          );
        },
        expectedParticipants,
        { timeout: 60_000 },
      ),
    ),
  );
}

async function expectMediaStillFlowing(pages: Page[], expectedRemoteCount: number) {
  const before = await collectSnapshots(pages);
  await pages[0].waitForTimeout(5_000);
  const after = await collectSnapshots(pages);

  for (let index = 0; index < after.length; index += 1) {
    const snapshot = after[index];
    const previous = before[index];

    expect(snapshot.connectionState, `participant ${index + 1} peer connection`).toBe('connected');
    expect(snapshot.iceConnectionState, `participant ${index + 1} ICE connection`).toBe('connected');
    expect(snapshot.signalingState, `participant ${index + 1} signaling`).toBe('stable');

    expect(snapshot.outbound.audio, `participant ${index + 1} outbound audio stream count`).toBeGreaterThanOrEqual(1);
    expect(snapshot.outbound.video, `participant ${index + 1} outbound video stream count`).toBeGreaterThanOrEqual(1);
    expect(snapshot.inbound.audio, `participant ${index + 1} inbound audio stream count`).toBeGreaterThanOrEqual(
      expectedRemoteCount,
    );
    expect(snapshot.inbound.video, `participant ${index + 1} inbound video stream count`).toBeGreaterThanOrEqual(
      expectedRemoteCount,
    );

    expect(snapshot.outbound.audioPackets, `participant ${index + 1} outbound audio packets`).toBeGreaterThan(
      previous.outbound.audioPackets,
    );
    expect(snapshot.outbound.videoPackets, `participant ${index + 1} outbound video packets`).toBeGreaterThan(
      previous.outbound.videoPackets,
    );
    expect(snapshot.inbound.audioPackets, `participant ${index + 1} inbound audio packets`).toBeGreaterThan(
      previous.inbound.audioPackets,
    );
    expect(snapshot.inbound.videoPackets, `participant ${index + 1} inbound video packets`).toBeGreaterThan(
      previous.inbound.videoPackets,
    );

    expect(snapshot.videos, `participant ${index + 1} rendered video elements`).toHaveLength(expectedRemoteCount + 1);

    const remoteVideos = snapshot.videos.filter((video) => !video.isLocal);
    const previousRemoteVideos = previous.videos.filter((video) => !video.isLocal);
    expect(remoteVideos, `participant ${index + 1} remote video elements`).toHaveLength(expectedRemoteCount);

    for (let videoIndex = 0; videoIndex < remoteVideos.length; videoIndex += 1) {
      const video = remoteVideos[videoIndex];
      const previousVideo = previousRemoteVideos[videoIndex];
      const frameCountIncreased =
        video.totalVideoFrames !== null &&
        previousVideo.totalVideoFrames !== null &&
        video.totalVideoFrames > previousVideo.totalVideoFrames;

      expect(video.hasStream, `participant ${index + 1} remote video ${videoIndex + 1} has stream`).toBe(true);
      expect(
        video.liveAudioTracks,
        `participant ${index + 1} remote video ${videoIndex + 1} live audio tracks`,
      ).toBeGreaterThan(0);
      expect(
        video.liveVideoTracks,
        `participant ${index + 1} remote video ${videoIndex + 1} live tracks`,
      ).toBeGreaterThan(0);
      expect(
        video.readyState,
        `participant ${index + 1} remote video ${videoIndex + 1} readyState`,
      ).toBeGreaterThanOrEqual(haveCurrentData);
      expect(video.videoWidth, `participant ${index + 1} remote video ${videoIndex + 1} width`).toBeGreaterThan(0);
      expect(video.videoHeight, `participant ${index + 1} remote video ${videoIndex + 1} height`).toBeGreaterThan(0);
      expect(
        frameCountIncreased || video.currentTime > previousVideo.currentTime,
        `participant ${index + 1} remote video ${videoIndex + 1} rendered new frames`,
      ).toBe(true);
    }
  }
}

async function forceConnectionState(page: Page, state: RTCPeerConnectionState) {
  await page.evaluate((forcedState) => {
    const pc = window.__openmeetPeerConnections?.at(-1);
    if (!pc) {
      throw new Error('No tracked peer connection');
    }

    Object.defineProperty(pc, 'connectionState', {
      configurable: true,
      get: () => forcedState,
    });

    pc.onconnectionstatechange?.(new Event('connectionstatechange'));
    pc.dispatchEvent(new Event('connectionstatechange'));
  }, state);
}

async function collectSnapshots(pages: Page[]): Promise<MediaSnapshot[]> {
  return Promise.all(pages.map((page) => page.evaluate(collectMediaSnapshot)));
}

async function collectMediaSnapshot(): Promise<MediaSnapshot> {
  const createRtpSummary = (): RtpSummary => ({
    audio: 0,
    video: 0,
    audioPackets: 0,
    videoPackets: 0,
    audioBytes: 0,
    videoBytes: 0,
  });

  const pc = window.__openmeetPeerConnections?.at(-1) ?? null;
  const stats = pc ? await pc.getStats() : new Map<string, RTCStats>();
  const inbound = createRtpSummary();
  const outbound = createRtpSummary();
  const candidates = new Map<string, string>();
  let selectedPair: { localCandidateId?: string; remoteCandidateId?: string } | null = null;

  stats.forEach((stat) => {
    if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
      const candidate = stat as RTCStats & { candidateType?: string; protocol?: string; relayProtocol?: string };
      // A relayed local candidate can surface as prflx when coturn's advertised address differs from the one
      // the SFU sees, so relaying is marked from relayProtocol rather than the candidate type alone.
      const relayed = candidate.relayProtocol ? `+turn-${candidate.relayProtocol}` : '';
      candidates.set(stat.id, `${candidate.candidateType ?? 'unknown'}/${candidate.protocol ?? 'unknown'}${relayed}`);
    }
    if (stat.type === 'transport') {
      const transport = stat as RTCStats & { selectedCandidatePairId?: string };
      const pair = transport.selectedCandidatePairId ? stats.get(transport.selectedCandidatePairId) : null;
      if (pair) selectedPair = pair as typeof selectedPair;
    }
  });

  stats.forEach((stat) => {
    if (stat.type !== 'inbound-rtp' && stat.type !== 'outbound-rtp') {
      return;
    }

    const rtp = stat as RTCInboundRtpStreamStats & RTCOutboundRtpStreamStats & { mediaType?: string };
    const kind = rtp.kind ?? rtp.mediaType;
    const summary = stat.type === 'inbound-rtp' ? inbound : outbound;

    if (kind === 'audio') {
      summary.audio += 1;
      summary.audioPackets += rtp.packetsReceived ?? rtp.packetsSent ?? 0;
      summary.audioBytes += rtp.bytesReceived ?? rtp.bytesSent ?? 0;
    }

    if (kind === 'video') {
      summary.video += 1;
      summary.videoPackets += rtp.packetsReceived ?? rtp.packetsSent ?? 0;
      summary.videoBytes += rtp.bytesReceived ?? rtp.bytesSent ?? 0;
    }
  });

  const pair = selectedPair as { localCandidateId?: string; remoteCandidateId?: string } | null;
  return {
    candidatePath: {
      local: pair?.localCandidateId ? (candidates.get(pair.localCandidateId) ?? null) : null,
      remote: pair?.remoteCandidateId ? (candidates.get(pair.remoteCandidateId) ?? null) : null,
    },
    connectionState: pc?.connectionState ?? null,
    iceConnectionState: pc?.iceConnectionState ?? null,
    signalingState: pc?.signalingState ?? null,
    inbound,
    outbound,
    videos: Array.from(document.querySelectorAll<HTMLVideoElement>('[data-testid="participant-video"]')).map(
      (video) => {
        const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
        const playbackQuality = 'getVideoPlaybackQuality' in video ? video.getVideoPlaybackQuality() : null;

        return {
          isLocal: video.dataset.participantLocal === 'true',
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          currentTime: video.currentTime,
          totalVideoFrames: playbackQuality?.totalVideoFrames ?? null,
          hasStream: stream !== null,
          liveAudioTracks: stream?.getAudioTracks().filter((track) => track.readyState === 'live').length ?? 0,
          liveVideoTracks: stream?.getVideoTracks().filter((track) => track.readyState === 'live').length ?? 0,
        };
      },
    ),
  };
}

async function expectNoConnectionErrorDialog(pages: Page[]) {
  await Promise.all(
    pages.map(async (page, index) => {
      await expect(page.getByTestId('connection-error-dialog'), `participant ${index + 1} error dialog`).toHaveCount(0);
    }),
  );
}

function recordBrowserDiagnostic(diagnostics: BrowserDiagnostic[], participant: number, type: string, text: string) {
  if (!diagnosticTags.some((tag) => text.includes(tag)) || unsafeDiagnosticPattern.test(text)) {
    return;
  }

  diagnostics.push({
    participant,
    type,
    text: text.replace(/\s+/g, ' ').slice(0, 240),
  });
}

function summarizeDiagnostics(diagnostics: BrowserDiagnostic[]) {
  const recentDiagnostics = diagnostics.slice(-30);

  if (recentDiagnostics.length === 0) {
    return 'No tagged client diagnostics captured.';
  }

  return recentDiagnostics.map((entry) => `p${entry.participant}:${entry.type}:${entry.text}`).join(' | ');
}

async function closeContexts(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
}
