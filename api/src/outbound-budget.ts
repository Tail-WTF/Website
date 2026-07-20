import { DurableObject } from "cloudflare:workers";
import type { OutboundGate } from "./types";

export const ACTOR_OUTBOUND_BUDGET = 15;
export const ACTOR_OUTBOUND_WINDOW_MS = 12 * 60 * 60 * 1000;
export const SERVICE_OUTBOUND_BUDGET = 1000;
export const SERVICE_OUTBOUND_WINDOW_MS = 60 * 60 * 1000;

export function outboundGateFor(env: Env, actor: string): OutboundGate {
  return async () => {
    const { success } = await env.GLOBAL_RATE_LIMITER.limit({
      key: "outbound",
    });
    if (!success) return false;

    const service = env.OUTBOUND_BUDGET.get(
      env.OUTBOUND_BUDGET.idFromName("service"),
    );
    if (
      !(await service.consume(
        SERVICE_OUTBOUND_BUDGET,
        SERVICE_OUTBOUND_WINDOW_MS,
      ))
    ) {
      return false;
    }

    const actorStub = env.OUTBOUND_BUDGET.get(
      env.OUTBOUND_BUDGET.idFromName(actor),
    );
    return actorStub.consume(ACTOR_OUTBOUND_BUDGET, ACTOR_OUTBOUND_WINDOW_MS);
  };
}

/** Fixed-window counter; each caller passes its own budget and window. */
export class OutboundBudget extends DurableObject {
  async consume(budget: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = (await this.ctx.storage.get<number>("windowStart")) ?? 0;
    let used = (await this.ctx.storage.get<number>("used")) ?? 0;

    if (now - windowStart >= windowMs) {
      await this.ctx.storage.put("windowStart", now);
      used = 0;
    }

    if (used >= budget) return false;

    await this.ctx.storage.put("used", used + 1);
    return true;
  }
}
