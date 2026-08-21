# mesh-queue

[![live](https://img.shields.io/badge/live-mesh--queue-f97316)](https://baditaflorin.github.io/mesh-queue/)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> A shared take-a-number queue that works directly between browsers.

**Live → https://baditaflorin.github.io/mesh-queue/**

## What it does

`mesh-queue` gives a small group one live, ordered line without a central queue service. Guests take a number, see their live position, and a single desk volunteer calls and completes the next guest. The desk claim expires automatically, so an abandoned tab does not block the room.

The queue is a browser-local Yjs document synchronized peer-to-peer with WebRTC. It uses mesh-common's `useNamedPeer`, `useRoster`, `useExpiringClaim`, `useDeadline`, `MeshNameInput`, settings drawer, invite flow, and self-reference chrome.

## Use it

1. Open the [live app](https://baditaflorin.github.io/mesh-queue/) and share the room link using the invite button.
2. Each guest enters a name and selects **Take a number**.
3. One volunteer selects **Run the desk**, then calls and finishes each guest in order.

The 90-second desk lock is coordination UX, not an authorization boundary: all people in a shared room can inspect its CRDT state. Share room links deliberately.

## Local development

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-queue
cd mesh-queue
npm install
npm run dev
```

`mesh-common` must be a sibling directory because the app intentionally uses it through `file:../mesh-common` during development.

## Verification and deployment

```bash
npm run typecheck
npm run smoke
npm run test:e2e
```

GitHub Pages serves the committed `docs/` directory from `main`. Repository validation is defined in `.woodpecker.yml`; no GitHub Actions workflow is used.

## Privacy

Queue entries, display names, and desk state are visible to anyone in the same room. The app has no application backend or account system. Signaling and TURN infrastructure facilitate WebRTC connectivity but do not own the queue data. See [the full privacy note](docs/privacy.md).

## License

MIT — see [LICENSE](LICENSE).
