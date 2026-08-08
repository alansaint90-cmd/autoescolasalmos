import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicOnboarding, savePublicOnboarding } from "@/lib/services/client-onboarding-service";

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  dataUrl: z.string().optional(),
  uploadedAt: z.string()
});

const saveSchema = z.object({
  responses: z.record(z.string(), z.unknown()).default({}),
  files: z.array(fileSchema).default([]),
  complete: z.boolean().optional()
});

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await getPublicOnboarding(token);

  if (!result) {
    return NextResponse.json({ error: "Link invalido ou expirado." }, { status: 404 });
  }

  return NextResponse.json({
    client: {
      id: result.client.id,
      name: result.client.name,
      contactName: result.client.contact_name
    },
    onboarding: {
      status: result.onboarding.status,
      responses: result.onboarding.responses,
      files: result.onboarding.files,
      completedAt: result.onboarding.completed_at,
      lastSavedAt: result.onboarding.last_saved_at
    }
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body = saveSchema.parse(await request.json());
    const result = await savePublicOnboarding({
      token,
      responses: body.responses,
      files: body.files,
      complete: body.complete
    });

    if (!result) {
      return NextResponse.json({ error: "Link invalido ou expirado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      status: result.onboarding.status,
      completedAt: result.onboarding.completed_at,
      lastSavedAt: result.onboarding.last_saved_at
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel salvar onboarding." },
      { status: 400 }
    );
  }
}
