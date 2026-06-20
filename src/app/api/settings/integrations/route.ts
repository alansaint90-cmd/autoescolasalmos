import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getIntegrationSettings,
  saveIntegrationSettings
} from "@/lib/services/integration-settings-service";
import { env } from "@/lib/env";
import { assertPermission } from "@/lib/services/permission-service";

function configured(value?: string, missingValue?: string) {
  return Boolean(value && value.trim() && value !== missingValue);
}

function getEnvironmentIntegrationStatus() {
  return {
    openai: {
      apiKey: configured(env.OPENAI_API_KEY, "missing-openai-key"),
      model: configured(env.OPENAI_MODEL)
    },
    evolution: {
      baseUrl: configured(env.EVOLUTION_API_URL),
      apiKey: configured(env.EVOLUTION_API_KEY, "missing-evolution-key"),
      instanceName: configured(env.EVOLUTION_INSTANCE_NAME),
      webhookSecret: configured(env.EVOLUTION_WEBHOOK_SECRET)
    },
    minio: {
      endpoint: configured(process.env.MINIO_ENDPOINT),
      accessKey: configured(process.env.MINIO_ACCESS_KEY),
      secretKey: configured(process.env.MINIO_SECRET_KEY),
      bucket: configured(process.env.MINIO_BUCKET)
    }
  };
}

function getEnvironmentIntegrationValues() {
  return {
    openai: {
      apiKey: configured(env.OPENAI_API_KEY, "missing-openai-key") ? env.OPENAI_API_KEY : "",
      model: configured(env.OPENAI_MODEL) ? env.OPENAI_MODEL : ""
    },
    evolution: {
      baseUrl: configured(env.EVOLUTION_API_URL) ? env.EVOLUTION_API_URL : "",
      apiKey: configured(env.EVOLUTION_API_KEY, "missing-evolution-key") ? env.EVOLUTION_API_KEY : "",
      instanceName: configured(env.EVOLUTION_INSTANCE_NAME) ? env.EVOLUTION_INSTANCE_NAME : "",
      webhookSecret: configured(env.EVOLUTION_WEBHOOK_SECRET) ? env.EVOLUTION_WEBHOOK_SECRET ?? "" : ""
    },
    minio: {
      endpoint: configured(process.env.MINIO_ENDPOINT) ? process.env.MINIO_ENDPOINT ?? "" : "",
      accessKey: configured(process.env.MINIO_ACCESS_KEY) ? process.env.MINIO_ACCESS_KEY ?? "" : "",
      secretKey: configured(process.env.MINIO_SECRET_KEY) ? process.env.MINIO_SECRET_KEY ?? "" : "",
      bucket: configured(process.env.MINIO_BUCKET) ? process.env.MINIO_BUCKET ?? "" : "",
      region: configured(process.env.MINIO_REGION) ? process.env.MINIO_REGION ?? "" : ""
    }
  };
}

export async function GET() {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageIntegrations");

    const settings = await getIntegrationSettings();
    const isSuperAdmin = session.role === "super_admin";

    return NextResponse.json({
      settings,
      environment: getEnvironmentIntegrationStatus(),
      environmentValues: isSuperAdmin ? getEnvironmentIntegrationValues() : null,
      canRevealSecrets: isSuperAdmin
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado." },
      { status: 403 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageIntegrations");

    const body = await request.json().catch(() => ({}));
    const settings = await saveIntegrationSettings(body.settings);

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel salvar as integracoes." },
      { status: 403 }
    );
  }
}
