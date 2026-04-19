# OpenMeet Client Documentation

The OpenMeet Client is a modern, responsive web application that provides the user interface for the OpenMeet video conferencing platform. Built with Vue 3 and TypeScript, it handles real-time video/audio communication using WebRTC.

## Overview

The client is a single-page application (SPA) that connects to the OpenMeet SFU server via WebSocket for signaling and uses WebRTC for peer-to-peer media streaming. It provides a clean, intuitive interface for video calls, participant management, and real-time chat.

### Key Features

- **WebRTC Integration**: Browser-based video/audio communication
- **Real-time Signaling**: WebSocket connection to SFU server
- **State Management**: XState for robust state machines
- **Responsive Design**: Mobile-first UI with Tailwind CSS
- **Media Controls**: Toggle audio/video, screen sharing
- **Chat System**: Real-time text chat during calls
- **Device Selection**: Choose audio/video input devices
- **Authentication**: JWT-based user authentication
- **Theme Support**: Light/dark mode toggle

## Technology Stack

- **Vue 3**: Progressive JavaScript framework with Composition API
- **TypeScript**: Type-safe development
- **XState**: State machine for WebRTC lifecycle management
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Radix Vue**: Headless UI components
- **WebRTC API**: Browser media and communication APIs
- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing

## Project Structure

```
openmeet-client/
├── src/
│   ├── components/              # Vue components
│   │   ├── ui/                  # Reusable UI components (shadcn/ui)
│   │   ├── meeting-page/        # Meeting-specific components
│   │   ├── landing-page/        # Landing page components
│   │   └── layout/              # Layout components (navbar, footer)
│   │
│   ├── composables/             # Vue composables (reusable logic)
│   │   ├── useWebrtc.ts         # WebRTC state machine interface
│   │   ├── useAuth.ts           # Authentication logic
│   │   ├── useMediaDevices.ts   # Media device selection
│   │   └── useTheme.ts          # Theme management
│   │
│   ├── pages/                   # Page components (views)
│   │   ├── MeetingPage.vue      # Main meeting room interface
│   │   ├── LandingPage.vue      # Home/landing page
│   │   ├── LoginPage.vue        # User login
│   │   ├── RegisterPage.vue     # User registration
│   │   └── DashboardPage.vue    # User dashboard
│   │
│   ├── services/                # Business logic services
│   │   ├── webrtc-sfu.ts        # WebRTC SFU client implementation
│   │   ├── signaling.ts         # WebSocket signaling service
│   │   └── api.ts               # HTTP API client
│   │
│   ├── xstate/                  # State machines
│   │   └── machines/
│   │       └── webrtc/          # WebRTC state machine
│   │
│   ├── config/                  # Configuration
│   │   └── branding.config.ts   # Branding/customization
│   │
│   ├── router/                  # Vue Router configuration
│   ├── assets/                  # Static assets
│   ├── utils.ts                 # Utility functions
│   └── main.ts                  # Application entry point
│
├── public/                      # Public static files
├── tests/                       # Test files
├── .env.development             # Development environment variables
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

## Core Components

### 1. WebRTC Service (`src/services/webrtc-sfu.ts`)

The WebRTC service manages peer connections to the SFU server:

- **Peer Connection Management**: Creates and manages RTCPeerConnection
- **Media Streaming**: Handles local and remote media streams
- **ICE Candidate Handling**: Manages ICE candidates for NAT traversal
- **Renegotiation**: Handles dynamic track addition (late joiners)
- **Media Controls**: Toggle audio/video tracks

**Key Methods:**
- `initializeMedia()`: Initialize local media devices
- `createPeerConnection()`: Create WebRTC peer connection
- `handleOffer()`: Process SDP offers from server
- `handleAnswer()`: Process SDP answers from server
- `addIceCandidate()`: Add ICE candidates for connectivity

### 2. Signaling Service (`src/services/signaling.ts`)

WebSocket-based signaling for call setup and control:

- **WebSocket Connection**: Persistent connection to SFU server
- **Message Routing**: Routes signaling messages to appropriate handlers
- **Reconnection Logic**: Automatic reconnection on connection loss
- **Event Handlers**: Publish/subscribe pattern for message handling

**Message Types:**
- `join`: Join a room
- `offer/answer`: SDP negotiation
- `iceCandidate`: ICE candidates
- `participantJoined/Left`: Participant events
- `mediaStateChanged`: Audio/video toggle events
- `chatMessage`: Text chat messages

### 3. State Machine (`src/xstate/machines/webrtc/`)

XState machine managing WebRTC lifecycle:

**States:**
- `idle`: Initial state, no connection
- `initializingMedia`: Requesting camera/microphone access
- `mediaReady`: Media initialized, ready to join
- `connected`: Connected to server
  - `joiningRoom`: Joining a room
  - `inCall`: Active call in progress
- `endingCall`: Cleaning up connection
- `error`: Error state

**Events:**
- `INIT_MEDIA`: Initialize media devices
- `JOIN_ROOM`: Join a room
- `LEAVE_ROOM`: Leave current room
- `TOGGLE_AUDIO/VIDEO`: Control media tracks
- `SEND_CHAT`: Send chat message

### 4. Composables

#### `useWebrtc.ts`
Reactive interface to WebRTC state machine:
- Exposes state and context as computed properties
- Provides action methods (initMedia, joinRoom, etc.)
- Type-safe event dispatching

#### `useAuth.ts`
Authentication management:
- Login/logout functionality
- JWT token storage and refresh
- Session persistence
- Protected route guards

#### `useMediaDevices.ts`
Media device management:
- Enumerate available devices
- Device selection and switching
- Device permissions handling

### 5. Meeting Page (`src/pages/MeetingPage.vue`)

Main interface for video calls:

**Features:**
- Video grid layout for participants
- Local video preview
- Media controls (mute, camera, screen share)
- Participant list
- Chat panel
- Connection status indicators

**Child Components:**
- `VideoGrid.vue`: Responsive grid layout for video tiles
- `ParticipantTile.vue`: Individual participant video/audio
- `MeetingControls.vue`: Control bar (mute, camera, etc.)
- `ChatPanel.vue`: Real-time chat interface
- `JoinMeetingDialog.vue`: Pre-join settings dialog

## Development Workflow

### Prerequisites

- Node.js 22+
- Yarn or npm

### Setup

1. Install dependencies:
```bash
cd openmeet-client
yarn install
```

2. Configure environment:
```bash
cp .env.example .env.development
```

Edit `.env.development`:
```env
VITE_SFU_WSS_URL=ws://localhost:8081/ws
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:localhost:3478
VITE_TURN_USER=openmeet
VITE_TURN_PASSWORD=openmeet_dev_turn
VITE_LANDING_PAGE=true
```

3. Start development server:
```bash
yarn dev
```

Application will be available at http://localhost:5173

### Available Scripts

```bash
# Development
yarn dev              # Start dev server with hot reload

# Building
yarn build            # Type-check and build for production
yarn preview          # Preview production build

# Testing
yarn test:unit        # Run unit tests with Vitest
yarn test:e2e         # Run E2E tests with Playwright
yarn test:e2e:dev     # Run E2E tests in dev mode

# Code Quality
yarn lint             # Lint and fix files with ESLint
yarn format           # Format code with Prettier
yarn type-check       # Type-check without building
```

## WebRTC Flow

### 1. Initialization
```
User opens app
  ↓
Click "Join Meeting"
  ↓
Request camera/microphone permissions
  ↓
Initialize local media stream
  ↓
Media ready
```

### 2. Joining a Room
```
Enter room ID and name
  ↓
Connect to WebSocket (signaling server)
  ↓
Send JOIN message
  ↓
Create RTCPeerConnection
  ↓
Generate offer (SDP)
  ↓
Send offer to server
  ↓
Receive answer from server
  ↓
Exchange ICE candidates
  ↓
Connection established
```

### 3. Late Joiner Flow
```
New participant joins
  ↓
Server sends existing tracks via renegotiation
  ↓
Receive new OFFER from server
  ↓
Create ANSWER
  ↓
New tracks added to connection
  ↓
Display remote video/audio
```

### 4. Media Control
```
User clicks mute/unmute
  ↓
Toggle MediaStreamTrack.enabled
  ↓
Send MEDIA_STATE_CHANGED to server
  ↓
Server broadcasts to other participants
  ↓
Update UI for all participants
```

## API Integration

### Authentication API

```typescript
// Login
POST /auth/login
Body: { email, password }
Response: { access_token, refresh_token }

// Register
POST /auth/register
Body: { email, password, name }
Response: { access_token, refresh_token }

// Refresh token
POST /auth/refresh
Body: { refresh_token }
Response: { access_token }
```

### WebSocket Signaling

```typescript
// Connect
const ws = new WebSocket('ws://localhost:8081/ws');

// Join room
ws.send({ type: 'join', roomId: '123', participantName: 'Alice' });

// Send offer
ws.send({ type: 'offer', targetId: 'server', sdp: offerSdp });

// Handle incoming messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle based on message.type
};
```

## Configuration

### Environment Variables

- `VITE_SFU_WSS_URL`: WebSocket URL for signaling server
- `VITE_STUN_URL`: STUN server URL for NAT traversal
- `VITE_TURN_URL`: TURN server URL for relay
- `VITE_TURN_USER`: TURN server username
- `VITE_TURN_PASSWORD`: TURN server password
- `VITE_LANDING_PAGE`: Enable/disable landing page

### Branding Customization

Edit `src/config/branding.config.ts`:

```typescript
export const brandingConfig = {
  appName: 'OpenMeet',
  logoUrl: '/logo.svg',
  primaryColor: '#3b82f6',
  // ... other branding options
};
```

## Testing

### Unit Tests

Located in `src/**/__tests__/`:

```bash
yarn test:unit
```

Uses Vitest with Vue Test Utils for component testing.

### E2E Tests

Located in `tests/`:

```bash
yarn test:e2e
```

Uses Playwright for browser automation testing.

## Building for Production

```bash
# Build optimized production bundle
yarn build

# Preview production build locally
yarn preview
```

Output will be in `dist/` directory.

### Docker Build

```bash
docker build -t openmeet-client .
docker run -p 8080:80 openmeet-client
```

## Troubleshooting

### Camera/Microphone Not Working

1. Check browser permissions
2. Ensure HTTPS or localhost (required for getUserMedia)
3. Check browser console for errors
4. Verify device is not in use by another app

### Connection Issues

1. Check WebSocket connection in browser DevTools
2. Verify STUN/TURN server configuration
3. Check firewall/NAT settings
4. Review browser console for ICE connection errors

### Video Not Displaying

1. Verify media tracks are active
2. Check if remote participant has enabled video
3. Review browser console for track errors
4. Ensure video element has correct srcObject

## Architecture Decisions

### Why XState?
- Explicit state management for complex WebRTC lifecycle
- Type-safe transitions and events
- Easier testing and debugging
- Visualizable state machine diagrams

### Why SFU Pattern?
- Better scalability than mesh (P2P)
- Lower bandwidth for multi-party calls
- Server controls media routing
- Easier to implement features (recording, transcoding)

### Why Composition API?
- Better TypeScript support
- More flexible code organization
- Easier to reuse logic (composables)
- Better performance

## Contributing

When contributing to the client:

1. Follow Vue 3 style guide
2. Use TypeScript for type safety
3. Write unit tests for composables
4. Update documentation for new features
5. Ensure responsive design (mobile-first)

## Related Documentation

- [Main Documentation](../../docs/README.md)
- [Server Documentation](../../openmeet-server/docs/README.md)
- [Vue 3 Documentation](https://vuejs.org/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [XState Documentation](https://statelyai.com/docs)
