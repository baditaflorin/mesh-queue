# Security audit — mesh-queue

Generated: **2026-08-26T13:52:38.150Z** · 16 checks · 16 pass · 0 fail

> A programmatic, CPU-only verification of shared security invariants and app-specific safety checks.
> Re-run with `npm run audit:security` from this repo. Source: `mesh-common/tests/securityAudit.test.ts`
> This app has no app-specific UI audit yet — only the shared crypto invariants are exercised. The layer-1 guarantees still apply by virtue of bundling `mesh-common`.

## Result

✅ **All checks pass.**

- crypto / Y.Doc invariants: **16 / 16**
- UI-flow checks: **0** _(no app-specific UI audit is present; pass 2 skipped)_

## Checks

| ID                                 | Claim                                                                                | Method                                                                          | Result |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | :----: |
| `L1.IDENTITY.persists`             | Identity key persists across reloads via localStorage                                | loadOrCreateIdentity called twice with same prefix; both keypairs match         |   ✅   |
| `L1.IDENTITY.uniquePerApp`         | Each storagePrefix produces a distinct keypair (no cross-app reuse)                  | loadOrCreateIdentity with two different prefixes; private keys differ           |   ✅   |
| `L1.MODERATOR.claimSyncs`          | A claims moderator → B's hook reports A as current moderator                         | linkMockRooms relays Y.Doc updates; A.claim() then read on B                    |   ✅   |
| `L1.MODERATOR.expiredClaimIgnored` | A signed claim with expiresAt in the past is treated as vacant                       | Plant claim with expiresAt = now - 60s; hook reports current=null               |   ✅   |
| `L1.MODERATOR.forgedClaimRejected` | A claim with a signature not matching its embedded pubkey is treated as vacant       | Plant {pubkey:real, sig:forger}; hook rejects and reports current=null          |   ✅   |
| `L1.MODERATOR.releaseSyncs`        | Relinquish by the current moderator clears the slot for all peers                    | After A.relinquish() both A and B observe current=null                          |   ✅   |
| `L1.MODERATOR.signedClaim`         | The moderator claim's signature verifies against the embedded pubkey                 | verify({peerId,pubkey,claimedAt,expiresAt,nonce}, sig, pubkey) === true         |   ✅   |
| `L1.MODERATOR.vacantDefault`       | Fresh room reports no moderator and isMe=false                                       | useModerator hook on a fresh mock room returns {current:null, isMe:false}       |   ✅   |
| `L1.SIGN.rejectGarbage`            | Invalid signature / pubkey inputs return false instead of crashing                   | verify({x:1}, 'not-hex', 'also-bad') and verify({x:1}, '', '') both false       |   ✅   |
| `L1.SIGN.rejectTampered`           | A signed payload with any byte modified fails verification                           | Sign {msg:'hello'}, then verify({msg:'HELLO'}, …) returns false                 |   ✅   |
| `L1.SIGN.rejectWrongKey`           | A's signature does not verify under B's public key                                   | Sign with kpA.priv, verify with kpB.pub returns false                           |   ✅   |
| `L1.SIGN.roundtrip`                | A signed payload verifies against the matching pubkey                                | Ed25519 sign(payload, privkey) then verify(payload, sig, pubkey)                |   ✅   |
| `L1.TOFU.fingerprint`              | trustFingerprint emits a 4x2-hex grouped string for in-person verification           | fingerprint(peerId, pubkey) matches /^xx-xx-xx-xx$/                             |   ✅   |
| `L1.TOFU.peerIdFromPubkey`         | peerIdFromPubkey is deterministic and uses 64-bit prefix of pubkey                   | Two calls with same pubkey return the same 16-hex-char id                       |   ✅   |
| `L1.TOFU.register`                 | register() writes a self-signed PubkeyRecord into the registry Y.Map                 | Verify the stored record's signature against its own pubkey                     |   ✅   |
| `L1.TOFU.rejectImposter`           | A forged record signed by the wrong key does not block the real peer from publishing | Pre-write mallory-signed alice claim; alice arrives and overwrites with her own |   ✅   |

## Evidence

Selected captured evidence (full payloads in `security-audit.json`):

### `L1.IDENTITY.persists`

```json
{
  "pubkeyA": "bb9b7eede24d678c8d5f2977e47e39f35c84e875c3b72c897c162f856373f671",
  "pubkeyB": "bb9b7eede24d678c8d5f2977e47e39f35c84e875c3b72c897c162f856373f671"
}
```

### `L1.IDENTITY.uniquePerApp`

```json
{
  "pubkeyA": "e5a190591d643733",
  "pubkeyB": "9ea4a99ef5c1bcb1"
}
```

### `L1.MODERATOR.claimSyncs`

```json
{
  "claimer": "alice",
  "ttlMs": 1800000
}
```

### `L1.MODERATOR.expiredClaimIgnored`

```json
{
  "plantedExpiresAt": 1787752298143,
  "now": 1787752358146
}
```

### `L1.MODERATOR.forgedClaimRejected`

```json
{
  "realPubkey": "a2548b54cff6bd42",
  "forgerPubkey": "f3b9cf09d63e45db"
}
```

### `L1.MODERATOR.signedClaim`

```json
{
  "sigLen": 128,
  "nonceLen": 32
}
```

### `L1.SIGN.roundtrip`

```json
{
  "sigLen": 128,
  "pubkeyPrefix": "3219345203ae9bdb"
}
```

### `L1.TOFU.fingerprint`

```json
{
  "fingerprint": "3b-40-85-e6"
}
```

### `L1.TOFU.peerIdFromPubkey`

```json
{
  "peerId": "501e9a60a9a28930"
}
```

### `L1.TOFU.register`

```json
{
  "peerId": "alice",
  "pubkeyPrefix": "cd1c36ad4e45bcf1",
  "sigLen": 128
}
```

### `L1.TOFU.rejectImposter`

```json
{
  "forgedPubkey": "6b258392d609b1ae",
  "realPubkey": "5cab3047ca4c2562"
}
```

---

## How to re-run

```bash
cd mesh-queue
npm run audit:security
```

The audit runs in two passes:

1. **Crypto invariants** (Vitest, ~1s) — sign/verify roundtrips, TOFU registry, moderator role state machine, forged-claim rejection, expired-claim rejection. Uses in-memory Yjs mock rooms; no browser.
2. **UI flow** (Playwright, app-specific) — opens the browser scenario declared in `tests/e2e/security-audit.spec.ts` and verifies the app's own safety contract.

Both run **headless, CPU-only**. No GPU acceleration is required; no signaling server is contacted. The fleet's `judge.sh` aggregator includes these checks alongside per-app feature tests.
