import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  membership: vi.fn(),
  question: vi.fn(),
  transaction: vi.fn(),
  debit: vi.fn(),
  createBet: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findUnique: mocks.membership },
    question: { findUnique: mocks.question },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ groupId: "group", questionId: "q" }) };
const request = (body: unknown = { optionId: "yes" }) =>
  new Request("http://localhost/api/groups/group/questions/q/bets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const openQuestion = () => ({
  id: "q", groupId: "group", status: "OPEN", closesAt: null, betAmount: 50,
  options: [{ id: "yes", bets: [] }, { id: "no", bets: [] }],
});

describe("placing a virtual prediction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "member" } });
    mocks.membership.mockResolvedValue({ balance: 100 });
    mocks.question.mockResolvedValue(openQuestion());
    mocks.createBet.mockResolvedValue({ id: "bet", amount: 50, optionId: "yes" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      membership: { update: mocks.debit }, bet: { create: mocks.createBet },
    }));
  });

  it("rejects unauthenticated requests without reading group data", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects users outside the group before reading a question", async () => {
    mocks.membership.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without writing a prediction", async () => {
    const malformed = new Request("http://localhost/", { method: "POST", body: "{" });
    expect((await POST(malformed, context)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not place predictions on resolved questions", async () => {
    mocks.question.mockResolvedValue({ ...openQuestion(), status: "RESOLVED" });
    const response = await POST(request(), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Question is not open for betting" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("enforces the deadline on the server", async () => {
    mocks.question.mockResolvedValue({ ...openQuestion(), closesAt: new Date("2000-01-01") });
    const response = await POST(request(), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Betting deadline has passed" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an option belonging to another question", async () => {
    const response = await POST(request({ optionId: "other-question-option" }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid option ID" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a second prediction by the same member", async () => {
    mocks.question.mockResolvedValue({ ...openQuestion(), options: [
      { id: "yes", bets: [{ userId: "member", amount: 50 }] }, { id: "no", bets: [] },
    ] });
    const response = await POST(request({ optionId: "no" }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "You already placed a bet on this question" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects insufficient virtual funds", async () => {
    mocks.membership.mockResolvedValue({ balance: 49 });
    const response = await POST(request(), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Insufficient balance" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("uses the question price and debits the authenticated member inside one transaction", async () => {
    const response = await POST(request({ optionId: "yes", amount: 1, userId: "outsider" }), context);
    expect(response.status).toBe(201);
    expect(mocks.question).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "q", groupId: "group" },
    }));
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.debit).toHaveBeenCalledWith({
      where: { userId_groupId: { userId: "member", groupId: "group" } },
      data: { balance: { decrement: 50 } },
    });
    expect(mocks.createBet).toHaveBeenCalledWith({
      data: { amount: 50, userId: "member", optionId: "yes" },
    });
    expect((await response.json()).bet.amount).toBe(50);
  });
});
