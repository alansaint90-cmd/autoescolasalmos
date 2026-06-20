import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";

type UploadMediaInput = {
  key: string;
  buffer: Buffer;
  contentType: string;
};

type StoredMediaObject = {
  body: ArrayBuffer;
  contentType: string;
  contentLength?: string | null;
};

const service = "s3";

export function isMinioMediaConfigured() {
  return Boolean(env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY && env.MINIO_BUCKET);
}

export async function uploadMediaToMinio(input: UploadMediaInput) {
  if (!isMinioMediaConfigured()) {
    throw new Error("MinIO nao configurado para armazenamento de midia.");
  }

  const payloadHash = sha256Hex(input.buffer);
  const url = objectUrl(input.key);
  const headers = signedHeaders({
    method: "PUT",
    url,
    payloadHash,
    contentType: input.contentType
  });

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: toArrayBuffer(input.buffer)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar midia para MinIO: ${response.status} ${body.slice(0, 220)}`);
  }

  return {
    storageKey: input.key,
    contentType: input.contentType
  };
}

export async function getMediaFromMinio(key: string): Promise<StoredMediaObject> {
  if (!isMinioMediaConfigured()) {
    throw new Error("MinIO nao configurado para leitura de midia.");
  }

  const payloadHash = sha256Hex("");
  const url = objectUrl(key);
  const headers = signedHeaders({
    method: "GET",
    url,
    payloadHash
  });

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao ler midia do MinIO: ${response.status} ${body.slice(0, 220)}`);
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
    contentLength: response.headers.get("content-length")
  };
}

function objectUrl(key: string) {
  const endpoint = normalizeEndpoint(env.MINIO_ENDPOINT || "");
  const encodedBucket = encodeURIComponent(env.MINIO_BUCKET);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`/${encodedBucket}/${encodedKey}`, endpoint);
}

function normalizeEndpoint(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("MINIO_ENDPOINT vazio.");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${env.MINIO_USE_SSL ? "https" : "http"}://${trimmed}`;
}

function signedHeaders(input: {
  method: "GET" | "PUT";
  url: URL;
  payloadHash: string;
  contentType?: string;
}) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate
  };

  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${headers[key].trim()}\n`)
    .join("");
  const signedHeaderNames = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderNames,
    input.payloadHash
  ].join("\n");

  const credentialScope = `${dateStamp}/${env.MINIO_REGION}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = getSignatureKey(env.MINIO_SECRET_KEY || "", dateStamp, env.MINIO_REGION, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${env.MINIO_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`
  };
}

function getSignatureKey(secret: string, dateStamp: string, region: string, serviceName: string) {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(serviceName).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function toArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
