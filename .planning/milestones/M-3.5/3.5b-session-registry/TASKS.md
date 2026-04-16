# Phase 3.5b Tasks — Session Registry & Cross-Session Routing

---

## Wave 1: Foundation

### T1: Expand types.ts with registry, relay, and discovery types ✅
- [x] RegistryEntry interface (identity, capabilities, status, connectedAt, lastSeen)
- [x] RelayConfig interface (port, host, pidFile, portFile, idleTimeoutMs)
- [x] PollResponse type ({ messages: Envelope[] })
- [x] DiscoverResult type (session list with identity and status)
- [x] RegisterRequest/UnregisterRequest types for relay API
- [x] RelayHealthResponse type
- File: `src/wire/types.ts`

### T2: Port registry from dynamo ✅
- [x] createRegistry() factory with Map-based session store
- [x] register(sessionId, info) — add session, emit event
- [x] unregister(sessionId) — remove session, clean timers/buffers, emit event
- [x] lookup(sessionId) — return session info or null
- [x] getSessions() — return all sessions
- [x] disconnect(sessionId) — mark disconnected, start TTL timer, init buffer
- [x] reconnect(sessionId) — clear timer, restore active, return buffered messages
- [x] bufferMessage(sessionId, envelope) — queue message for disconnected session
- [x] destroy() — clear all state
- [x] EventEmitter for session:registered, session:lost, session:reconnected
- File: `src/wire/registry.ts`

### T3: Port priority queue from dynamo ✅
- [x] createPriorityQueue() factory with per-urgency arrays
- [x] enqueue(envelope) — route to urgency queue, drop oldest on overflow
- [x] dequeue() — return highest priority message (urgent > directive > active > background)
- [x] peek() — look without removing
- [x] getDepth() — per-queue and total counts
- [x] isEmpty() — check all queues empty
- [x] flush() — drain all queues in priority order
- [x] Configurable depth limits per urgency level
- File: `src/wire/queue.ts`

---

## Wave 2: Relay Server

### T4: Build HTTP relay server ✅
- [x] Node.js http.createServer with request routing
- [x] POST /register — register session (sessionId, identity, capabilities)
- [x] POST /unregister — remove session, clean up pending polls
- [x] POST /send — validate envelope, deliver to mailbox or pending poll
- [x] POST /send-batch — batch envelope delivery
- [x] GET /poll — long-poll with configurable timeout (25s default)
- [x] GET /sessions — list all registered sessions
- [x] GET /health — status, session count, uptime
- [x] Broadcast support (to="broadcast" delivers to all except sender)
- [x] Priority-ordered mailbox delivery (use queue for poll responses)
- [x] Port selection: 9876 default, fallback 9877-9886
- [x] Write PID to relay.pid, port to relay.port on startup
- [x] Idle timeout: self-terminate after 5 min with 0 sessions
- [x] SIGTERM handler for graceful shutdown
- [x] Logging to ~/.claude-governance/wire/relay.log
- File: `src/wire/relay-server.ts`

---

## Wave 3: Relay Client + Lifecycle

### T5: Build relay HTTP client ✅
- [x] RelayClient interface with configurable base URL
- [x] register(sessionId, identity, capabilities) — POST /register
- [x] unregister(sessionId) — POST /unregister
- [x] send(envelope) — POST /send
- [x] poll(sessionId, timeout) — GET /poll with long-poll
- [x] discover(statusFilter?) — GET /sessions
- [x] health() — GET /health
- [x] startPollLoop(sessionId, onMessage) — background poll with error backoff
- [x] stopPollLoop() — abort controller, clean exit
- [x] Uses fetch() (Node.js 20 built-in, no external deps)
- File: `src/wire/relay-client.ts`

### T6: Build relay lifecycle manager ✅
- [x] Wire state directory: ~/.claude-governance/wire/
- [x] ensureRelay() — check PID, start if needed, return port
- [x] isRelayRunning() — read relay.pid, check process alive (with EPERM handling)
- [x] startRelay() — spawn detached child, wait for port file (10s timeout)
- [x] getRelayPort() — read relay.port file
- [x] cleanStaleState() — remove dead PID/port files
- [x] Race condition handling: retry if relay started between check and spawn
- [x] Health check verification before returning existing port
- File: `src/wire/relay-lifecycle.ts`

---

## Wave 4: Server Integration

### T7: Integrate relay into Wire MCP server ✅
- [x] On startup: ensureRelay() → register with relay → start poll loop
- [x] wire_send routing: POST to relay instead of local notification echo
- [x] wire_send broadcast: relay handles distribution
- [x] New tool: wire_discover — query relay /sessions, format for Claude
- [x] wire_status enhancement: show peers, relay health, poll status
- [x] On shutdown: unregister from relay, stop poll loop
- [x] Poll loop: receive messages → send as notifications/claude/channel
- [x] Error handling: relay down → graceful degradation to local-only mode
- [x] Session identity: WIRE_SESSION_NAME env → cwd basename → random suffix
- File: `src/wire/server.ts`

---

## Wave 5: Build + Verify

### T8: Update build pipeline ✅
- [x] tsdown.wire.config.ts: dual entry points (wire-server, wire-relay)
- [x] wire-relay.cjs: standalone (14KB), no MCP SDK dependency
- [x] wire-server.cjs: updated with relay integration (480KB)
- [x] pnpm build:wire produces both artifacts + shared protocol chunk
- [x] Verify: all files exist in data/wire/
- File: `tsdown.wire.config.ts`

### T9: Integration verification ✅
- [x] Relay server starts and listens on port 9876
- [x] Register/unregister via curl against relay
- [x] Send message via curl, poll receives it
- [x] GET /sessions returns registered sessions with identity/capabilities
- [x] Relay PID/port files written correctly
- [x] Relay log file captures events
- [x] Full typecheck passes (tsc --noEmit)
- [x] Build produces correct artifacts (pnpm build:wire)
