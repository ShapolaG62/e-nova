import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Cache chave→JSON com TTL. Usa Upstash Redis quando configurado (compartilhado
 * entre instâncias/serverless); senão, um Map em memória (dev / VPS única).
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** Incrementa e devolve o contador; define o TTL na primeira vez. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryKV implements KV {
  private store = new Map<string, { v: unknown; exp: number }>();
  private alive(key: string) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T>(key: string) {
    return (this.alive(key)?.v as T) ?? null;
  }
  async set(key: string, v: unknown, ttl: number) {
    if (this.store.size > 50_000) this.store.clear(); // proteção simples de memória
    this.store.set(key, { v, exp: Date.now() + ttl * 1000 });
  }
  async del(...keys: string[]) {
    keys.forEach((k) => this.store.delete(k));
  }
  async incr(key: string, ttl: number) {
    const e = this.alive(key);
    const n = ((e?.v as number) ?? 0) + 1;
    this.store.set(key, { v: n, exp: e?.exp ?? Date.now() + ttl * 1000 });
    return n;
  }
}

class UpstashKV implements KV {
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    return (await this.r.get<T>(key)) ?? null;
  }
  async set(key: string, v: unknown, ttl: number) {
    await this.r.set(key, v, { ex: ttl });
  }
  async del(...keys: string[]) {
    if (keys.length) await this.r.del(...keys);
  }
  async incr(key: string, ttl: number) {
    const [n] = await this.r.multi().incr(key).expire(key, ttl, "NX").exec<[number, number]>();
    return n;
  }
}

const g = globalThis as unknown as { __enovaKV?: KV };

export const kv: KV = (g.__enovaKV ??=
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashKV(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
    : new MemoryKV());

/** Janela fixa: true se ainda dentro do limite. Falha aberta se o cache cair. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const n = await kv.incr(`rl:${key}`, windowSeconds);
    return n <= limit;
  } catch {
    return true;
  }
}
