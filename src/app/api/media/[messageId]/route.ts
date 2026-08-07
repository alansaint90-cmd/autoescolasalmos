import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";
import { getMediaFromMinio } from "@/lib/services/minio-media-service";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "viewLeads");

    const { messageId } = await context.params;
    const [message] = await db
      .select({
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    const media = getMediaMetadata(message?.metadata);
    if (!media) {
      return NextResponse.json({ error: "Midia nao encontrada." }, { status: 404 });
    }

    if (media.storageKey) {
      const object = await getMediaFromMinio(media.storageKey);
      return buildMediaResponse(object.body, {
        contentType: object.contentType || media.mimeType || "application/octet-stream",
        rangeHeader: request.headers.get("range"),
        maxAge: 300
      });
    }

    const inline = media.dataUrl || media.base64;
    if (inline) {
      const { buffer, mimeType } = decodeInlineMedia(inline, media.mimeType);
      return buildMediaResponse(buffer, {
        contentType: mimeType,
        rangeHeader: request.headers.get("range"),
        maxAge: 120
      });
    }

    return NextResponse.json({ error: "Arquivo da midia indisponivel." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel carregar a midia.";
    const status = message.toLowerCase().includes("sessao") || message.toLowerCase().includes("permiss") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function buildMediaResponse(
  body: ArrayBuffer | Buffer,
  input: {
    contentType: string;
    rangeHeader: string | null;
    maxAge: number;
  }
) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const total = buffer.byteLength;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": input.contentType,
    "Cache-Control": `private, max-age=${input.maxAge}`
  };

  if (!input.rangeHeader) {
    return new NextResponse(toResponseBody(buffer), {
      headers: {
        ...commonHeaders,
        "Content-Length": String(total)
      }
    });
  }

  const range = parseByteRange(input.rangeHeader, total);
  if (!range) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes */${total}`
      }
    });
  }

  const chunk = buffer.subarray(range.start, range.end + 1);
  return new NextResponse(toResponseBody(chunk), {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${range.start}-${range.end}/${total}`
    }
  });
}

function toResponseBody(buffer: Buffer) {
  const output = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(output).set(buffer);
  return output;
}

function parseByteRange(value: string, total: number) {
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || total <= 0) return null;

  const [, startValue, endValue] = match;
  let start = startValue ? Number.parseInt(startValue, 10) : 0;
  let end = endValue ? Number.parseInt(endValue, 10) : total - 1;

  if (!startValue && endValue) {
    const suffixLength = Number.parseInt(endValue, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(total - suffixLength, 0);
    end = total - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= total || end < start) return null;

  end = Math.min(end, total - 1);
  return { start, end };
}

function getMediaMetadata(metadata: Record<string, unknown> | null | undefined) {
  const media = metadata?.media;
  if (!media || typeof media !== "object") return null;
  return media as {
    storageKey?: string;
    dataUrl?: string;
    base64?: string;
    mimeType?: string;
  };
}

function decodeInlineMedia(value: string, fallbackMimeType?: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  const mimeType = match?.[1] || fallbackMimeType || "application/octet-stream";
  const payload = match?.[2] || value;
  return {
    buffer: Buffer.from(payload, "base64"),
    mimeType
  };
}
