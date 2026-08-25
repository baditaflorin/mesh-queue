import { useEffect, useMemo, useState } from "react";
import {
  MeshButton,
  MeshLaunch,
  MeshNameInput,
  MeshPresence,
  MeshStatusPill,
  MeshSurface,
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

/**
 * A shared service desk that gives each person one unambiguous next action.
 * The queue state stays entirely in the room's Yjs document; this component
 * only turns that live state into a readable, calm front-of-house view.
 */
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
  const serviceTimer = useDeadline(current ? current.calledAt + SERVICE_WINDOW_MS : null, {
    startTs: current?.calledAt,
  });
  const myPosition = room ? queue.findIndex((ticket) => ticket.peerId === room.peerId) + 1 : 0;
  const isMyTurn = Boolean(room && current?.peerId === room.peerId);
  const guestsAhead = Math.max(0, myPosition - (current ? 1 : 0));
  const peopleHere = Math.max(room ? 1 : 0, roster.present.length);
  const waitingCount = queue.filter((ticket) => ticket.peerId !== current?.peerId).length;

  const displayName = (peerId: string) => namedPeer.nameOf(peerId) || shortPeerId(peerId);
  const servingName = current ? displayName(current.peerId) : null;

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
    const nextTicket = queue.find((ticket) => ticket.peerId !== current?.peerId);
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

  const personalHeading = isMyTurn
    ? "You’re up"
    : myPosition
      ? `Number ${String(myPosition).padStart(2, "0")}`
      : "Ready when you are";
  const personalMessage = !room
    ? "Connecting you to this shared desk."
    : isMyTurn
      ? "Please make your way to the desk."
      : myPosition
        ? `${guestsAhead} ${guestsAhead === 1 ? "guest is" : "guests are"} ahead of you.`
        : "Add your name, then take a number when you’re ready.";
  const personalTone = !room ? "warning" : isMyTurn ? "success" : myPosition ? "info" : "neutral";
  const personalStatus = !room
    ? "Connecting"
    : isMyTurn
      ? "At the desk"
      : myPosition
        ? `${guestsAhead} ahead`
        : "No number yet";
  const launchPrimaryAction = !room
    ? {
        label: "Connecting to the queue",
        onClick: takeNumber,
        disabled: true,
      }
    : myPosition
      ? {
          label: "Leave the queue",
          onClick: leaveQueue,
        }
      : {
          label: "Take a number",
          onClick: takeNumber,
        };
  const launchSecondaryAction = desk.isMine
    ? current
      ? {
          label: `Finish with ${servingName}`,
          onClick: finishCurrent,
        }
      : {
          label: queue.length ? "Call the next guest" : "Waiting for a guest",
          onClick: callNext,
          disabled: !queue.length,
        }
    : desk.isFree
      ? {
          label: "Run the desk",
          onClick: desk.claim,
          disabled: !room,
        }
      : undefined;

  return (
    <main className="queue-page">
      <MeshLaunch
        className="queue-launch"
        eyebrow="Live service desk"
        heading="A line that keeps moving."
        promise="Take a number, see your place, and let one volunteer guide the next person without a central queue server."
        presence={
          <MeshPresence
            count={peopleHere}
            label="people in this room"
            state={room ? "connected" : "connecting"}
            announce="polite"
          />
        }
        loading={!room}
        connectionHint={room ? "This queue is live for everyone in the room." : undefined}
        preview={
          <div className="queue-launch-preview-grid">
            <MeshSurface
              as="section"
              tone="raised"
              padding="lg"
              className="queue-focus-surface"
              aria-labelledby="your-place-heading"
            >
              <div className="queue-surface-heading">
                <div>
                  <p className="queue-kicker">Your place</p>
                  <h2 id="your-place-heading">{personalHeading}</h2>
                </div>
                <span className="queue-ticket" aria-hidden="true">
                  {isMyTurn ? "NOW" : myPosition ? String(myPosition).padStart(2, "0") : "—"}
                </span>
              </div>
              <MeshStatusPill tone={personalTone} dot announce="polite">
                {personalStatus}
              </MeshStatusPill>
              <p className="queue-focus-copy">{personalMessage}</p>
              {!myPosition && (
                <div className="queue-name-field">
                  <MeshNameInput
                    label="Your name"
                    value={namedPeer.name}
                    onChange={namedPeer.setName}
                    placeholder="How should the desk call you?"
                    maxLength={48}
                    showCounter
                  />
                </div>
              )}
            </MeshSurface>

            <MeshSurface
              as="aside"
              tone="base"
              padding="lg"
              className="queue-now-serving"
              aria-labelledby="now-serving-heading"
              aria-live="polite"
            >
              <div className="queue-surface-heading">
                <div>
                  <p className="queue-kicker">Now serving</p>
                  <h2 id="now-serving-heading">{servingName ?? "Desk is ready"}</h2>
                </div>
                <MeshStatusPill tone={current ? "live" : "neutral"} dot>
                  {current ? "In service" : "Open"}
                </MeshStatusPill>
              </div>
              <p className="queue-now-serving-copy">
                {current
                  ? serviceTimer.isPast
                    ? "Suggested service window has elapsed."
                    : `${serviceTimer.fmt} left in the suggested service window.`
                  : "A desk volunteer can call the first guest as soon as they’re ready."}
              </p>
            </MeshSurface>
          </div>
        }
        primaryAction={launchPrimaryAction}
        secondaryAction={launchSecondaryAction}
      />

      <section className="queue-workspace" aria-label="Queue workspace">
        <MeshSurface
          as="section"
          tone="base"
          padding="lg"
          className="queue-line-surface"
          aria-labelledby="line-heading"
        >
          <div className="queue-section-header">
            <div>
              <p className="queue-kicker">The line</p>
              <h2 id="line-heading">
                {waitingCount ? `${waitingCount} waiting` : "No one waiting"}
              </h2>
            </div>
            <MeshStatusPill tone={waitingCount ? "info" : "neutral"} dot>
              {queue.length} total
            </MeshStatusPill>
          </div>

          {queue.length ? (
            <ol className="queue-list">
              {queue.map((ticket, index) => {
                const isServing = ticket.peerId === current?.peerId;
                const isMine = ticket.peerId === room?.peerId;
                return (
                  <li
                    className={isServing ? "is-serving" : undefined}
                    data-mine={isMine || undefined}
                    key={ticket.peerId}
                  >
                    <span className="queue-list-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="queue-list-name">
                      {displayName(ticket.peerId)}
                      {isMine ? <small>Your number</small> : null}
                    </span>
                    {isServing ? (
                      <MeshStatusPill tone="live" dot>
                        At desk
                      </MeshStatusPill>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="queue-empty-state">The first person to take a number appears here.</p>
          )}
        </MeshSurface>

        <MeshSurface
          as="section"
          tone="raised"
          padding="lg"
          className="queue-desk-surface"
          aria-labelledby="desk-heading"
        >
          <div className="queue-section-header">
            <div>
              <p className="queue-kicker">Service controls</p>
              <h2 id="desk-heading">One volunteer, one clear handoff</h2>
            </div>
            <MeshStatusPill
              tone={desk.isMine ? "success" : desk.isFree ? "neutral" : "warning"}
              dot
            >
              {desk.isMine
                ? "You’re running the desk"
                : desk.isFree
                  ? "Desk is open"
                  : "Desk in use"}
            </MeshStatusPill>
          </div>

          <p className="queue-desk-copy">
            The desk claim expires automatically, so a closed tab cannot hold the room hostage.
          </p>

          {!desk.isMine ? (
            <MeshButton
              fullWidth
              variant="primary"
              size="lg"
              onClick={desk.claim}
              disabled={!room || !desk.isFree}
            >
              {desk.isFree ? "Run the desk" : "Another volunteer is serving"}
            </MeshButton>
          ) : (
            <div className="queue-desk-actions">
              {current ? (
                <MeshButton fullWidth variant="primary" size="lg" onClick={finishCurrent}>
                  Finish with {servingName}
                </MeshButton>
              ) : (
                <MeshButton
                  fullWidth
                  variant="primary"
                  size="lg"
                  onClick={callNext}
                  disabled={!queue.length}
                >
                  {queue.length ? "Call the next guest" : "Waiting for a guest"}
                </MeshButton>
              )}
              <div className="queue-desk-secondary-actions">
                <MeshButton variant="quiet" size="sm" onClick={desk.refresh}>
                  Keep desk open ({Math.ceil(desk.msRemaining / 1000)}s)
                </MeshButton>
                <MeshButton variant="quiet" size="sm" onClick={desk.release}>
                  Step away
                </MeshButton>
              </div>
            </div>
          )}
        </MeshSurface>
      </section>
    </main>
  );
}
