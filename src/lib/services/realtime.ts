import { env } from "@/lib/env";

type RealtimeEvent = {
  type: "message.created" | "conversation.updated" | "handoff.changed";
  conversationId: string;
  payload: Record<string, unknown>;
};

export async function publishRealtimeEvent(event: RealtimeEvent) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const url = new URL("/realtime/v1/api/broadcast", env.SUPABASE_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            topic: env.SUPABASE_REALTIME_CHANNEL,
            event: event.type,
            payload: event
          }
        ]
      })
    });

    if (!response.ok) {
      console.warn("[realtime] broadcast failed", { status: response.status });
    }
  } catch (error) {
    console.warn("[realtime] broadcast skipped", error);
  }
}
