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

export async function GET(_request: NextRequest, context: RouteContext) {
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
      return new NextResponse(object.body, {
        headers: {
          "Content-Type": object.contentType || media.mimeType || "application/octet-stream",
          "Cache-Control": "private, max-age=300",
          ...(object.contentLength ? { "Content-Length": object.contentLength } : {})
        }
      });
    }

    const inline = media.dataUrl || media.base64;
    if (inline) {
      const { buffer, mimeType } = decodeInlineMedia(inline, media.mimeType);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=120"
        }
      });
    }

    return NextResponse.json({ error: "Arquivo da midia indisponivel." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel carregar a midia.";
    const status = message.toLowerCase().includes("sessao") || message.toLowerCase().includes("permiss") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
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
