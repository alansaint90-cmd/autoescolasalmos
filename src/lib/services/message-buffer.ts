import Redis from "ioredis";
import { env } from "@/lib/env";

const bufferTtlSeconds = 60 * 10;
const processingMarkerTtlSeconds = 60;
const recentContextTtlSeconds = 60 * 60 * 24 * 7;
const recentContextLimit = 30;
let redisClient: Redis | null = null;

export type BufferedMessage = {
  conversationId: string;
  messageId: string;
  content: string;
  receivedAt: string;
};

export type RecentContextMessage = {
  conversationId: string;
  messageId: string;
  role: "lead" | "ai" | "human" | "system";
  content: string;
  createdAt: string;
};

export async function pushToConversationBuffer(message: BufferedMessage) {
  const redis = getRedis();
  const key = bufferKey(message.conversationId);
  await redis.rpush(key, JSON.stringify(message));
  await redis.expire(key, bufferTtlSeconds);
  console.info("[message-buffer] message pushed", { conversationId: message.conversationId });
}

export async function drainConversationBuffer(conversationId: string) {
  const redis = getRedis();
  const key = bufferKey(conversationId);
  const items = await redis.lrange(key, 0, -1);
  await redis.del(key);
  console.info("[message-buffer] buffer drained", { conversationId, count: items.length });

  return items.map((item) => JSON.parse(item) as BufferedMessage);
}

export async function clearConversationBuffer(conversationId: string) {
  const redis = getRedis();
  await redis.del(bufferKey(conversationId), processingKey(conversationId));
  console.info("[message-buffer] buffer cleared", { conversationId });
}

export async function appendRecentConversationContext(message: RecentContextMessage) {
  const redis = getRedis();
  const key = recentContextKey(message.conversationId);
  await redis.lpush(key, JSON.stringify(message));
  await redis.ltrim(key, 0, recentContextLimit - 1);
  await redis.expire(key, recentContextTtlSeconds);
  console.info("[message-buffer] recent context stored", { conversationId: message.conversationId });
}

export async function getRecentConversationContext(conversationId: string) {
  const redis = getRedis();
  const items = await redis.lrange(recentContextKey(conversationId), 0, recentContextLimit - 1);
  return items.map((item) => JSON.parse(item) as RecentContextMessage).reverse();
}

export async function scheduleBufferProcessing(conversationId: string) {
  const redis = getRedis();
  await redis.set(processingKey(conversationId), String(Date.now()), "EX", processingMarkerTtlSeconds);
  console.info("[message-buffer] processing scheduled", {
    conversationId,
    quietWindowMs: getMessageBufferWindowMs()
  });
}

export async function shouldProcessBuffer(conversationId: string) {
  const redis = getRedis();
  const status = await redis.get(processingKey(conversationId));
  const scheduledAt = Number(status);
  const elapsedMs = Number.isFinite(scheduledAt) ? Date.now() - scheduledAt : 0;
  const quietWindowMs = getMessageBufferWindowMs();
  const shouldProcess = Boolean(status && elapsedMs >= quietWindowMs);

  console.info("[message-buffer] processing status", { conversationId, status, elapsedMs, quietWindowMs, shouldProcess });
  return shouldProcess;
}

export function getMessageBufferWindowMs() {
  return env.AI_MESSAGE_BUFFER_WINDOW_MS;
}

function getRedis() {
  redisClient ??= new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  return redisClient;
}

function bufferKey(conversationId: string) {
  return `conversation:${conversationId}:buffer`;
}

function processingKey(conversationId: string) {
  return `conversation:${conversationId}:processing`;
}

function recentContextKey(conversationId: string) {
  return `conversation:${conversationId}:recent-context`;
}
