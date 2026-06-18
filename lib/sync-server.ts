import { Redis } from "@upstash/redis";
import type { Cast, PlaybackState, Settings } from "./types";

/**
 * Lazily-created Redis client. Works with either the Upstash env vars
 * (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) or the older Vercel-KV
 * names (KV_REST_API_URL / KV_REST_API_TOKEN).
 */
let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

export function isSyncConfigured(): boolean {
  return getRedis() !== null;
}

function userKey(email: string, ...rest: string[]): string {
  return ["user", email.toLowerCase(), ...rest].join(":");
}

const CAST_INDEX = (email: string) => userKey(email, "casts");
const CAST_KEY = (email: string, id: string) => userKey(email, "cast", id);
const PLAYBACK_INDEX = (email: string) => userKey(email, "playback-ids");
const PLAYBACK_KEY = (email: string, castId: string) =>
  userKey(email, "playback", castId);
const SETTINGS_KEY = (email: string) => userKey(email, "settings");

export async function listRemoteCasts(email: string): Promise<Cast[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = (await redis.smembers(CAST_INDEX(email))) as string[];
  if (ids.length === 0) return [];
  const keys = ids.map((id) => CAST_KEY(email, id));
  const values = (await redis.mget(...keys)) as (Cast | null)[];
  return values.filter((v): v is Cast => v !== null);
}

export async function putRemoteCast(email: string, cast: Cast): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([
    redis.set(CAST_KEY(email, cast.id), cast),
    redis.sadd(CAST_INDEX(email), cast.id),
  ]);
}

export async function deleteRemoteCast(
  email: string,
  id: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([
    redis.del(CAST_KEY(email, id)),
    redis.srem(CAST_INDEX(email), id),
    redis.del(PLAYBACK_KEY(email, id)),
    redis.srem(PLAYBACK_INDEX(email), id),
  ]);
}

export async function listRemotePlayback(
  email: string,
): Promise<PlaybackState[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = (await redis.smembers(PLAYBACK_INDEX(email))) as string[];
  if (ids.length === 0) return [];
  const keys = ids.map((id) => PLAYBACK_KEY(email, id));
  const values = (await redis.mget(...keys)) as (PlaybackState | null)[];
  return values.filter((v): v is PlaybackState => v !== null);
}

export async function putRemotePlayback(
  email: string,
  state: PlaybackState,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([
    redis.set(PLAYBACK_KEY(email, state.castId), state),
    redis.sadd(PLAYBACK_INDEX(email), state.castId),
  ]);
}

export async function getRemoteSettings(
  email: string,
): Promise<Settings | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get(SETTINGS_KEY(email))) as Settings | null;
}

export async function putRemoteSettings(
  email: string,
  settings: Settings,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(SETTINGS_KEY(email), settings);
}
