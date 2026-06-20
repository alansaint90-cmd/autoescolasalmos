export type IntegrationStatus = "pending" | "connected" | "error";

export type IntegrationSettings = {
  openai: {
    apiKey: string;
    model: string;
    organization: string;
    status: IntegrationStatus;
  };
  evolution: {
    baseUrl: string;
    apiKey: string;
    instanceName: string;
    webhookSecret: string;
    status: IntegrationStatus;
  };
  minio: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    useSSL: boolean;
    status: IntegrationStatus;
  };
};

export const integrationSettingsKey = "integration-settings";

export const defaultIntegrationSettings: IntegrationSettings = {
  openai: { apiKey: "", model: "gpt-4.1-mini", organization: "", status: "pending" },
  evolution: { baseUrl: "", apiKey: "", instanceName: "", webhookSecret: "", status: "pending" },
  minio: {
    endpoint: "",
    accessKey: "",
    secretKey: "",
    bucket: "autoproia-media",
    region: "us-east-1",
    useSSL: true,
    status: "pending"
  }
};

function status(value: unknown): IntegrationStatus {
  return value === "connected" || value === "error" || value === "pending" ? value : "pending";
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizeIntegrationSettings(value: unknown): IntegrationSettings {
  const partial = typeof value === "object" && value !== null ? value as Partial<IntegrationSettings> : {};

  return {
    openai: {
      apiKey: text(partial.openai?.apiKey),
      model: text(partial.openai?.model, defaultIntegrationSettings.openai.model),
      organization: text(partial.openai?.organization),
      status: status(partial.openai?.status)
    },
    evolution: {
      baseUrl: text(partial.evolution?.baseUrl),
      apiKey: text(partial.evolution?.apiKey),
      instanceName: text(partial.evolution?.instanceName),
      webhookSecret: text(partial.evolution?.webhookSecret),
      status: status(partial.evolution?.status)
    },
    minio: {
      endpoint: text(partial.minio?.endpoint),
      accessKey: text(partial.minio?.accessKey),
      secretKey: text(partial.minio?.secretKey),
      bucket: text(partial.minio?.bucket, defaultIntegrationSettings.minio.bucket),
      region: text(partial.minio?.region, defaultIntegrationSettings.minio.region),
      useSSL: typeof partial.minio?.useSSL === "boolean" ? partial.minio.useSSL : true,
      status: status(partial.minio?.status)
    }
  };
}
