import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

const quickRepliesSettingsKey = "conversation-quick-replies";

const attachmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["audio", "image", "video"]),
  dataUrl: z.string().min(1)
});

const quickReplySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  message: z.string().default(""),
  attachment: attachmentSchema.optional()
});

const quickRepliesSchema = z.object({
  quickReplies: z.array(quickReplySchema).max(60)
});

export async function GET() {
  const session = await getSession();
  await assertPermission(session.role, "viewConversations");

  const [record] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, quickRepliesSettingsKey))
    .limit(1);

  const parsed = quickRepliesSchema.safeParse(record?.value);

  return NextResponse.json({
    ok: true,
    quickReplies: parsed.success ? parsed.data.quickReplies : []
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  await assertPermission(session.role, "replyConversations");

  const body = quickRepliesSchema.parse(await request.json().catch(() => ({})));

  await db
    .insert(appSettings)
    .values({
      key: quickRepliesSettingsKey,
      value: body as unknown as Record<string, unknown>
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: body as unknown as Record<string, unknown>,
        updated_at: new Date()
      }
    });

  return NextResponse.json({ ok: true, quickReplies: body.quickReplies });
}
