Architecture Overview

The system is split into two layers:

1. WebRTCService (src/services/webrtc.ts) - A class that handles the low-level WebRTC API operations
2. webrtcMachine (src/xstate/machines/webrtc/index.ts) - An XState machine that orchestrates the WebRTCService and manages the state flow

---

PART 1: The WebRTC Service (The Worker)

The WebRTCService class encapsulates all WebRTC browser APIs and Firebase signaling:

Line 9-13: Class Properties

private peerConnection: RTCPeerConnection | null = null; // The actual WebRTC connection
private localStream: MediaStream | null = null; // Your camera/microphone stream
private remoteStream: MediaStream | null = null; // Remote user's stream
private unsubscribers: (() => void)[] = []; // Firebase listeners cleanup

Lines 17-29: initializeMedia() Method

What it does:

- Requests permission to access camera and microphone
- Creates a MediaStream with video and audio tracks
- Initializes an empty remoteStream for later

Browser API: navigator.mediaDevices.getUserMedia()

Returns: Your local video/audio stream

---

Lines 31-56: createPeerConnection() Method

What it does:

1. Creates an RTCPeerConnection with STUN servers (lines 36-39)


    - STUN servers help discover your public IP address for NAT traversal

2. Adds your local media tracks to the connection (lines 42-46)


    - This makes your video/audio available to the remote peer

3. Sets up handler for receiving remote tracks (lines 49-53)


    - When remote user's tracks arrive, add them to remoteStream

Key Concept: RTCPeerConnection is the main WebRTC object that handles peer-to-peer connection

---

Lines 58-94: createOffer() Method (Caller Side)

Step-by-step flow:

1. Line 64-70: Set up ICE candidate handler


    - ICE candidates = network addresses where you can be reached
    - Each candidate is saved to Firebase so the other peer can find you

2. Line 72-73: Create SDP offer


    - SDP (Session Description Protocol) = metadata about your media (codecs, formats, etc.)
    - This describes what you want to send/receive

3. Line 76: Save offer to Firebase


    - Other peer will read this to know what you're offering

4. Line 79-85: Listen for the answer


    - Once the other peer responds, set their SDP as remote description
    - This completes the signaling handshake

5. Line 88-91: Listen for the other peer's ICE candidates


    - Add their network addresses to establish connection

Firebase is used for signaling - exchanging SDP and ICE candidates before the direct peer connection is established.

---

Lines 96-132: createAnswer() Method (Receiver Side)

Step-by-step flow:

1. Line 102-108: Set up ICE candidate handler (same as offer)
2. Line 111-114: Get the offer from Firebase


    - Read the SDP offer that the caller saved

3. Line 116-117: Set remote description to the offer


    - This tells your RTCPeerConnection what the caller wants

4. Line 119-120: Create and set answer


    - Generate your own SDP describing what you can send/receive
    - Set it as local description

5. Line 123: Save answer to Firebase


    - Caller will read this to complete the handshake

6. Line 126-129: Listen for caller's ICE candidates

---

Lines 146-161: cleanup() Method

Tears down everything:

- Unsubscribes from Firebase listeners
- Stops camera/microphone tracks
- Closes peer connection
- Clears all references

---

PART 2: The XState Machine (The Orchestrator)

Line 14: Creating Service Instance

const webrtcService = new WebRTCService();
One shared instance used by all actors.

---

Lines 17-50: Actor Definitions (Async Operations)

initMediaActor (lines 17-20)

- Wraps webrtcService.initializeMedia() in a promise actor
- Returns: { localStream: MediaStream }

createCallActor (lines 22-37)

1. Generates unique call ID
2. Calls webrtcService.createPeerConnection()
3. Calls webrtcService.createOffer(callId)
4. Returns: { callId, offer }

joinCallActor (lines 39-50)

1. Takes callId as input
2. Calls webrtcService.createPeerConnection()
3. Calls webrtcService.createAnswer(callId)
4. Returns: { answer }

---

Lines 65-169: Actions (Context Updates & Side Effects)

Context Update Actions (using assign):

- setLocalStream (66-72): Saves local stream to context
- setCallCreated (74-81): Saves callId and marks as initiator
- setCallJoined (83-86): Marks as NOT initiator
- setCallId (88-93): Saves callId from JOIN_CALL event
- setPeerConnection (95-97): Gets peer connection from service
- setRemoteStream (99-101): Gets remote stream from service
- setConnectionState (103-108): Updates connection state
- setIceConnectionState (110-115): Updates ICE connection state
- setError (117-122): Saves error message
- clearContext (124-133): Resets all context to initial state

Side Effect Actions:

- cleanupResources (135-137): Calls webrtcService.cleanup()
- monitorPeerConnection (139-164):
  - Sets up event listeners on peer connection
  - When connection state changes, sends events back to machine
  - This is self-communication! The action sends events to the machine itself

---

Lines 191-296: State Machine Definition

State: idle (192-199)

- Initial state, no media initialized
- Event INIT_MEDIA → transition to initializingMedia

State: initializingMedia (201-214)

- Invokes: initMediaActor
- On success: → mediaReady, run setLocalStream action
- On error: → error, run setError action

State: mediaReady (216-227)

- Camera/mic are ready
- Event CREATE_CALL → creatingCall
- Event JOIN_CALL → joiningCall + run setCallId action

State: creatingCall (229-242)

- Invokes: createCallActor
- On success: → inCall, run 3 actions:
  a. setCallCreated - save callId
  b. setPeerConnection - save peer connection reference
  c. monitorPeerConnection - set up event listeners
- On error: → error

State: joiningCall (244-258)

- Invokes: joinCallActor with callId as input
- On success: → inCall, run 3 actions:
  a. setCallJoined - mark as not initiator
  b. setPeerConnection - save peer connection reference
  c. monitorPeerConnection - set up event listeners
- On error: → error

State: inCall (260-274)

- Entry action: updateRemoteStream - get latest remote stream
- Listens for events:
  - CONNECTION_STATE_CHANGED → run setConnectionState
  - ICE_CONNECTION_STATE_CHANGED → run setIceConnectionState
  - END_CALL → endingCall

State: endingCall (276-282)

- Entry actions:
  a. cleanupResources - stop media, close connection
  b. clearContext - reset context
- Always: automatically transition to idle

State: error (284-295)

- Error occurred
- Event RETRY → idle (with cleanup)
- Event END_CALL → endingCall

---

PART 3: Complete Flow Examples

Scenario 1: User Creates a Call

1. Component sends: { type: 'INIT_MEDIA' }
2. Machine: idle → initializingMedia
3. Service: webrtcService.initializeMedia() requests camera/mic
4. Machine: initializingMedia → mediaReady, saves local stream
5. Component sends: { type: 'CREATE_CALL' }
6. Machine: mediaReady → creatingCall
7. Service:


    - Creates RTCPeerConnection
    - Creates SDP offer
    - Saves offer to Firebase
    - Listens for answer

8. Machine: creatingCall → inCall, saves callId and peer connection
9. Service: When answer arrives from Firebase, sets remote description
10. Service: ICE candidates exchanged through Firebase
11. Service: Direct peer-to-peer connection established
12. Service: Remote tracks arrive, triggers ontrack handler
13. Machine: monitorPeerConnection action sends CONNECTION_STATE_CHANGED events
14. Machine: Updates context with connection states

Scenario 2: User Joins a Call

1. Component sends: { type: 'INIT_MEDIA' }
2. Machine: idle → initializingMedia → mediaReady (same as above)
3. Component sends: { type: 'JOIN_CALL', callId: 'call-123' }
4. Machine: mediaReady → joiningCall
5. Service:


    - Reads offer from Firebase (call-123)
    - Creates RTCPeerConnection
    - Sets remote description (the offer)
    - Creates SDP answer
    - Saves answer to Firebase
    - Listens for offer ICE candidates

6. Machine: joiningCall → inCall
7. Service: ICE candidates exchanged, connection established
8. Machine: Same monitoring as Scenario 1

---

Key Concepts Explained

Why Firebase?

WebRTC is peer-to-peer, but peers need to find each other first. This is called signaling:

- SDP (offer/answer) = "I can send/receive these formats"
- ICE candidates = "You can reach me at these network addresses"

Firebase acts as the signaling server to exchange this info before the direct connection.

Why XState Machine?

The WebRTC flow has many steps and states:

- You can't create offer before initializing media
- You can't join call before creating peer connection
- You must clean up resources in the right order

XState enforces this order and makes states explicit.

Self-Communication Pattern (Line 139-164)

The monitorPeerConnection action sets up event listeners that send events back to the machine:
pc.onconnectionstatechange = () => {
self.send({ type: 'CONNECTION_STATE_CHANGED', ... });
};
This allows the machine to react to external WebRTC events (connection state changes) as if they were user actions.
