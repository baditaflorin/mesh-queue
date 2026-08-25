import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature, orderTickets } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("orders tickets deterministically when two guests join together", () => {
    expect(
      orderTickets([
        { peerId: "peer-z", requestedAt: 10 },
        { peerId: "peer-b", requestedAt: 8 },
        { peerId: "peer-a", requestedAt: 8 },
      ]),
    ).toEqual([
      { peerId: "peer-a", requestedAt: 8 },
      { peerId: "peer-b", requestedAt: 8 },
      { peerId: "peer-z", requestedAt: 10 },
    ]);
  });

  it("makes a new guest's place and next real action obvious", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "A line that keeps moving." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take a number" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Ready when you are" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Desk is ready" })).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    expect(screen.getByText("Connecting to the queue")).toBeDisabled();
    expect(screen.getByText("Connecting")).toBeInTheDocument();
  });
});
