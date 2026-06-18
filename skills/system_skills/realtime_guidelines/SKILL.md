---
name: "real-time-and-multi-user"
description: >
  Guidelines for implementing real-time features, WebSockets, and collaborative
  canvases. Use when the app requires chat, live collaboration, multiplayer games,
  or notifications. Covers server-authoritative state, event-based communication,
  and canvas library selection (Konva, Fabric.js).
---

# Real-Time & Multi-User Guidelines

## Critical Rule: No Simulations

When building applications with multi-user or real-time features, **you MUST use
real infrastructure**:

Feature Type       | Required Implementation
------------------ | ------------------------------------------
Chat / Messaging   | WebSockets with server-side state
Live Collaboration | WebSockets with server-side state
Multiplayer Games  | WebSockets with server-authoritative state
Notifications      | Push notifications or WebSocket events

## Forbidden Patterns

**DO NOT** use these patterns to fake multi-user behavior (unless asked by the
user):

-   Using AI/LLM responses to simulate other users
-   Using `setTimeout`/`setInterval` to fake real-time updates
-   Storing multi-user state only in client-side memory (not synced to a server)

## Architecture Principles

When implementing real-time multi-user features, follow these core principles:

### 1. Server as Source of Truth

The server maintains the authoritative state. Clients are views of that state.

-   All mutations flow through the server
-   The server validates and broadcasts changes to all connected clients
-   Never trust client-side state for critical data

### 2. Event-Based Communication

Use an event-driven pattern for real-time updates:

```
Client A sends action → Server processes → Server broadcasts to all clients
```

Events should be: - **Named clearly**: `object:created`, `cursor:moved`,
`user:joined` - **Minimal payload**: Send only changed data, not full state -
`Idempotent`: Applying the same event twice must not corrupt state

#### Idempotency in Practice

Event handlers for `create` operations must guard against duplicates: - **Check
existence**: Before adding an object, check if an object with that ID already
exists. - **Early return**: If it exists, skip the addition. - **Resilience**:
This protects against reconnection races, duplicate broadcasts, and network
retries.

`Update` operations are naturally idempotent (overwriting with the same value is
safe). `Delete` operations should be a no-op if the item does not exist.

### 3. Optimistic Updates with Reconciliation

For responsive UIs, apply changes optimistically on the client:

1.  Apply change locally immediately
2.  Send change to server
3.  If server rejects, rollback local change
4.  If server confirms, state is already correct

## Communication Patterns

### Presence Awareness

Track who is active in a session:

-   **Join/Leave events**: Notify when users connect/disconnect
-   **Active user list**: Server maintains list of connected users
-   **User metadata**: Include name, color, cursor position as needed

### Reconnection Handling

Connections will drop. Plan for it:

-   **Auto-reconnect**: Client should attempt reconnection automatically
-   **State sync on reconnect**: Request full state from server after
    reconnecting
-   **Pending changes queue**: Buffer local changes during disconnect, send on
    reconnect
-   **Race condition awareness**: If a client adds an object, disconnects, then
    reconnects, the `init` payload may include that object. Without idempotent
    handlers, it appears twice. Always use idempotent event handlers regardless
    of server broadcast semantics.

### Rooms/Channels

For collaborative documents or sessions:

-   **Room-based isolation**: Users in different rooms don't see each other's
    changes
-   **Room ID from URL**: Derive room identity from document/session URL
-   **Join on connect**: Client joins appropriate room immediately after
    connecting

## State Synchronization

### Initial Sync

When a client connects:

1.  Client connects and authenticates (if needed)
2.  Client joins appropriate room/channel
3.  Server sends full current state
4.  Client renders initial state

### Delta Updates

During active session:

-   Send only what changed, not full state
-   Include object IDs for targeted updates
-   Use operation types: `create`, `update`, `delete`

### Conflict Resolution

When two users edit simultaneously:

Approach                  | When to Use
------------------------- | ----------------------------------------------------
**Last-Write-Wins**       | Simple, acceptable for most collaborative UIs
**Operational Transform** | Text editing, requires library support
**CRDT**                  | Complex collaborative data, requires library support

For most apps, **last-write-wins** is sufficient. The server applies changes in
order received and broadcasts the result.

## Full-Stack Integration

Real-time features require a server. Follow the Full-Stack guidelines to
configure it, then add WebSocket support.

### Key Points

-   **Same port**: WebSocket server runs on port 3000 alongside HTTP
-   **Upgrade handling**: WebSocket libraries handle HTTP→WS upgrade
    automatically
-   **Order matters**: Initialize WebSocket handler with the HTTP server

### Framework-Specific Notes

-   **React/Vite**: WebSocket server attaches to the HTTP server created for
    Express
-   **Next.js**: Use custom server or API routes with WebSocket upgrade handling
-   **Angular**: Same pattern as React - Express server with WebSocket
    attachment

--------------------------------------------------------------------------------

## Canvas Library Selection

For collaborative canvas apps (design tools, whiteboards, editors):

Use Case                                  | Recommended Library
----------------------------------------- | ------------------------
**Default choice**                        | Konva with `react-konva`
Advanced features (beziers, filters, SVG) | Fabric.js v6+

**Why Konva for collaboration**: State-driven model matches
server-as-source-of-truth. Receive state from socket → update React state →
components re-render.

### Fabric.js v6+ Gotchas

If using Fabric, avoid these common version pitfalls:

| Issue                | Solution                                              |
| -------------------- | ----------------------------------------------------- |
| Import syntax        | `import * as fabric from 'fabric'` (not named import) |
| `@types/fabric`      | Don't install - v6+ has built-in TypeScript types     |
| `getPointer` removed | Use `canvas.getScenePoint(e)` instead                 |
| `type` is read-only  | Strip before `.set()`: `const { type, id, ...rest } = |
:                      : obj`                                                  :
| `loadFromJSON`       | Use `await canvas.loadFromJSON(json)` (async, not     |
:                      : callback)                                             :
| Canvas double-init   | Call `canvas.dispose()` in cleanup                    |

--------------------------------------------------------------------------------

## Library API Verification

Before implementing canvas or complex real-time libraries:

1.  Check installed version in `package.json`
2.  Verify import syntax matches the installed major version
3.  Prefer libraries with stable APIs (e.g., Konva over Fabric.js)

--------------------------------------------------------------------------------

## Preventing Infinite Sync Loops

When canvas/state changes trigger socket events:

-   **Track update source**: Flag remote vs local changes (`isRemoteUpdate`)
-   **Guard emission**: Skip emit when `isRemoteUpdate === true`
-   **Strip identity props**: Remove `type`, `id` before calling `.set()`

--------------------------------------------------------------------------------

## Canvas + WebSocket Checklist

When combining canvas libraries with real-time collaboration:

-   [ ] Canvas instance stored in a ref (not component state)
-   [ ] Cleanup on unmount (Fabric: `.dispose()`, Konva: `.destroy()`)
-   [ ] Socket data arriving before canvas mount is buffered
-   [ ] Continuous drag/resize events are throttled before emit
-   [ ] Currently-selected objects skip incoming remote updates
