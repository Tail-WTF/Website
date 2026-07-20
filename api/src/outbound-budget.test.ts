import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

function budgetFor(name: string) {
  return env.OUTBOUND_BUDGET.get(env.OUTBOUND_BUDGET.idFromName(name));
}

describe("OutboundBudget", () => {
  it("allows exactly the budgeted number of operations per window", async () => {
    const stub = budgetFor("actor-a");
    expect(await stub.consume(2, 60_000)).toBe(true);
    expect(await stub.consume(2, 60_000)).toBe(true);
    expect(await stub.consume(2, 60_000)).toBe(false);
  });

  it("tracks each key independently", async () => {
    const a = budgetFor("actor-b");
    const b = budgetFor("actor-c");
    expect(await a.consume(1, 60_000)).toBe(true);
    expect(await a.consume(1, 60_000)).toBe(false);
    expect(await b.consume(1, 60_000)).toBe(true);
  });

  it("resets the budget when the window elapses", async () => {
    const stub = budgetFor("actor-d");
    expect(await stub.consume(1, 50)).toBe(true);
    expect(await stub.consume(1, 50)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await stub.consume(1, 50)).toBe(true);
  });
});
