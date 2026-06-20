import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { crmNotifications } from "@/lib/db/schema";

export async function GET() {
  const notifications = await db
    .select()
    .from(crmNotifications)
    .where(eq(crmNotifications.is_deleted, false))
    .orderBy(desc(crmNotifications.created_at))
    .limit(20);

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      description: notification.body,
      type: notification.type,
      status: notification.status,
      createdAt: notification.created_at,
      payload: notification.payload
    }))
  });
}
