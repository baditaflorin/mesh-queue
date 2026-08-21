import { useEffect, useMemo, useState } from "react";
import {
  MeshNameInput,
  useDeadline,
  useExpiringClaim,
  useNamedPeer,
  useRoster,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

const DESK_CLAIM_TTL_MS = 90_000;
const SERVICE_WINDOW_MS = 5 * 60_000;

export type QueueTicket = {
  peerId: string;
  requestedAt: number;
};

type QueueState = {
  peerId: string;
  calledAt: number;
};

export function orderTickets(tickets: QueueTicket[]): QueueTicket[] {
  return [...tickets].sort(
    (a, b) => a.requestedAt - b.requestedAt || a.peerId.localeCompare(b.peerId),
  );
}

function shortPeerId(peerId: string): string {
  return `guest-${peerId.slice(0, 6)}`;
}

type Props = { room: YRoom | null; config: MeshConfig };

export function Feature({ room, config }: Props) {
  const namedPeer = useNamedPeer(config, room);
  const roster = useRoster(room);
  const desk = useExpiringClaim(room, "mesh-queue:desk", DESK_CLAIM_TTL_MS);
  const [revision, refresh] = useState(0);

  useEffect(() => {
    if (!room) return;
    const tickets = room.doc.getMap<QueueTicket>("mesh-queue:tickets");
    const state = room.doc.getMap<QueueState>("mesh-queue:state");
    const rerender = () => refresh((version) => version + 1);
    tickets.observe(rerender);
    state.observe(rerender);
    return () => {
      tickets.unobserve(rerender);
      state.unobserve(rerender);
    };
  }, [room]);

  const queue = useMemo(() => {
    if (!room) return [];
    const tickets: QueueTicket[] = [];
    room.doc.getMap<QueueTicket>("mesh-queue:tickets").forEach((ticket) => {
      if (ticket && typeof ticket.peerId === "string" && Number.isFinite(ticket.requestedAt)) {
        tickets.push(ticket);
      }
    });
    return orderTickets(tickets);
  }, [room, namedPeer.names, revision]);

  const current = room?.doc.getMap<QueueState>("mesh-queue:state").get("current") ?? null;
  const currentTicket = current
    ? queue.find((ticket) => ticket.peerId === current.peerId)
    : undefined;
  const serviceTimer = useDeadline(current ? current.calledAt + SERVICE_WINDOW_MS : null, {
    startTs: current?.calledAt,
  });
  const myPosition = room ? queue.findIndex((ticket) => ticket.peerId === room.peerId) + 1 : 0;
  const isMyTurn = !!room && current?.peerId === room.peerId;

  const displayName = (peerId: string) => namedPeer.nameOf(peerId) || shortPeerId(peerId);

  const takeNumber = () => {
    if (!room || myPosition) return;
    room.doc.getMap<QueueTicket>("mesh-queue:tickets").set(room.peerId, {
      peerId: room.peerId,
      requestedAt: Date.now(),
    });
  };

  const leaveQueue = () => {
    if (!room) return;
    room.doc.transact(() => {
      room.doc.getMap<QueueTicket>("mesh-queue:tickets").delete(room.peerId);
      const state = room.doc.getMap<QueueState>("mesh-queue:state");
      if (state.get("current")?.peerId === room.peerId) state.delete("current");
    });
  };

  const callNext = () => {
    const nextTicket = queue[0];
    if (!room || current || !nextTicket) return;
    room.doc.getMap<QueueState>("mesh-queue:state").set("current", {
      peerId: nextTicket.peerId,
      calledAt: Date.now(),
    });
  };

  const finishCurrent = () => {
    if (!room || !current) return;
    room.doc.transact(() => {
      room.doc.getMap<QueueTicket>("mesh-queue:tickets").delete(current.peerId);
      room.doc.getMap<QueueState>("mesh-queue:state").delete("current");
    });
  };

  const guestsAhead = Math.max(0, myPosition - (current ? 1 : 0));

  return (
    <main className="queue-page">
      <section className="queue-hero" aria-labelledby="queue-title">
        <p className="eyebrow">Mesh Queue</p>
        <h1 id="queue-title">Take a number. Keep moving.</h1>
        <p>
          A lightweight shared queue for pop-ups, office hours, kitchen passes, and anything else
          that needs one calm line.
        </p>
        <div className="connection-pill" aria-live="polite">
          <span className={room ? "connection-dot is-connected" : "connection-dot"} />
          {room ? `${roster.present.length || 1} here now` : "Connecting to the room…"}
        </div>
      </section>

      <section className="queue-layout" aria-label="Shared queue">
        <div className="queue-card queue-card-primary">
          <div className="queue-card-heading">
            <div>
              <p className="eyebrow">Your place</p>
              <h2>
                {isMyTurn ? "You’re up" : myPosition ? `Number ${myPosition}` : "Not in line"}
              </h2>
            </div>
            <div className="ticket-mark" aria-hidden="true">
              {isMyTurn ? "NOW" : myPosition || "—"}
            </div>
          </div>

          {!myPosition ? (
            <div className="join-panel">
              <MeshNameInput
                label="Your name"
                value={namedPeer.name}
                onChange={namedPeer.setName}
                placeholder="How should the desk call you?"
                maxLength={48}
                showCounter
              />
              <button
                className="queue-button queue-button-primary"
                type="button"
                onClick={takeNumber}
                disabled={!room}
              >
                Take a number
              </button>
              <p className="quiet">
                Your name stays in this peer-to-peer room, not a central queue server.
              </p>
            </div>
          ) : (
            <div className="ticket-panel">
              <p aria-live="polite">
                {isMyTurn
                  ? "Please head to the desk now."
                  : `${guestsAhead} guest${guestsAhead === 1 ? "" : "s"} ahead of you.`}
              </p>
              <button
                className="queue-button queue-button-quiet"
                type="button"
                onClick={leaveQueue}
              >
                Leave this queue
              </button>
            </div>
          )}
        </div>

        <div className="queue-card now-serving" aria-live="polite">
          <p className="eyebrow">Now serving</p>
          {currentTicket ? (
            <>
              <h2>{displayName(currentTicket.peerId)}</h2>
              <p className="service-clock">
                {serviceTimer.isPast
                  ? "Service window elapsed"
                  : `${serviceTimer.fmt} in the suggested window`}
              </p>
            </>
          ) : (
            <>
              <h2>The desk is ready</h2>
              <p>Take a number, then a desk volunteer can call the next guest.</p>
            </>
          )}
        </div>

        <section className="queue-card queue-list" aria-labelledby="line-heading">
          <div className="queue-card-heading">
            <div>
              <p className="eyebrow">The line</p>
              <h2 id="line-heading">
                {queue.length ? `${queue.length} waiting` : "No one waiting"}
              </h2>
            </div>
            <span className="line-count">{queue.length}</span>
          </div>
          {queue.length ? (
            <ol>
              {queue.map((ticket, index) => (
                <li
                  className={ticket.peerId === current?.peerId ? "is-serving" : ""}
                  key={ticket.peerId}
                >
                  <span className="line-number">{index + 1}</span>
                  <span>{displayName(ticket.peerId)}</span>
                  {ticket.peerId === current?.peerId && (
                    <span className="serving-label">at desk</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">The first guest to take a number appears here.</p>
          )}
        </section>

        <section className="queue-card desk-panel" aria-labelledby="desk-heading">
          <div className="queue-card-heading">
            <div>
              <p className="eyebrow">Desk controls</p>
              <h2 id="desk-heading">One volunteer at a time</h2>
            </div>
            <span className={desk.isMine ? "desk-status is-mine" : "desk-status"}>
              {desk.isMine ? "You’re at the desk" : desk.isFree ? "Desk is open" : "Desk in use"}
            </span>
          </div>
          {!desk.isMine ? (
            <button
              className="queue-button queue-button-primary"
              type="button"
              onClick={desk.claim}
              disabled={!room || !desk.isFree}
            >
              {desk.isFree ? "Run the desk" : "Desk is being run"}
            </button>
          ) : (
            <div className="desk-actions">
              {!current ? (
                <button
                  className="queue-button queue-button-primary"
                  type="button"
                  onClick={callNext}
                  disabled={!queue.length}
                >
                  {queue.length ? "Call next guest" : "Waiting for a guest"}
                </button>
              ) : (
                <button
                  className="queue-button queue-button-primary"
                  type="button"
                  onClick={finishCurrent}
                >
                  Finish with {displayName(current.peerId)}
                </button>
              )}
              <div className="desk-secondary-actions">
                <button className="text-button" type="button" onClick={desk.refresh}>
                  Keep desk open ({Math.ceil(desk.msRemaining / 1000)}s)
                </button>
                <button className="text-button" type="button" onClick={desk.release}>
                  Step away
                </button>
              </div>
            </div>
          )}
          <p className="quiet">
            The desk lock expires automatically, so a vanished tab cannot hold the queue hostage.
          </p>
        </section>
      </section>
    </main>
  );
}
