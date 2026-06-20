import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const integerFromEnv = (defaultValue: number, minimum: number, maximum: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() !== "") return Number(value);
      return value;
    },
    z.number().int().min(minimum).max(maximum).default(defaultValue)
  );

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value === "true" || value === "1" || value.toLowerCase() === "yes";
      }
      return value;
    },
    z.boolean().default(defaultValue)
  );

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://auto_pro_ia:auto_pro_ia@localhost:5432/auto_pro_ia"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().min(1).default("missing-openai-key"),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  EVOLUTION_API_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().min(1).default("missing-evolution-key"),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).default("auto-pro-ia"),
  EVOLUTION_WEBHOOK_SECRET: optionalString,
  FOLLOW_UP_JOB_SECRET: optionalString,
  FOLLOW_UP_AUTOMATION_ENABLED: booleanFromEnv(false),
  NOTIFICATION_WHATSAPP_NUMBERS: optionalString,
  SUPPORT_WHATSAPP_NUMBER: optionalString,
  MINIO_ENDPOINT: optionalString,
  MINIO_ACCESS_KEY: optionalString,
  MINIO_SECRET_KEY: optionalString,
  MINIO_BUCKET: z.string().default("autoproia-media"),
  MINIO_REGION: z.string().default("us-east-1"),
  MINIO_USE_SSL: z.preprocess(
    (value) => {
      if (typeof value === "string") return value === "true" || value === "1";
      return value;
    },
    z.boolean().default(true)
  ),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_REALTIME_CHANNEL: z.string().default("conversations"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SESSION_SECRET: z.string().min(32).default("auto-pro-ia-local-session-secret-change-me"),
  AUTH_COOKIE_NAME: z.string().default("auto_pro_ia_session"),
  SUPERADMIN_EMAIL: z.string().email().default("admin@autopro.ia"),
  SUPERADMIN_NAME: z.string().default("Superadmin"),
  AUTH_RECOVERY_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  AUTH_EMAIL_FROM: z.string().min(1).default("Auto Pro IA <noreply@autoproia.site>"),
  AI_MESSAGE_BUFFER_WINDOW_MS: integerFromEnv(12_000, 8_000, 15_000)
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function readEnv() {
  cachedEnv ??= envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME,
    EVOLUTION_WEBHOOK_SECRET: process.env.EVOLUTION_WEBHOOK_SECRET,
    FOLLOW_UP_JOB_SECRET: process.env.FOLLOW_UP_JOB_SECRET,
    FOLLOW_UP_AUTOMATION_ENABLED: process.env.FOLLOW_UP_AUTOMATION_ENABLED,
    NOTIFICATION_WHATSAPP_NUMBERS: process.env.NOTIFICATION_WHATSAPP_NUMBERS,
    SUPPORT_WHATSAPP_NUMBER: process.env.SUPPORT_WHATSAPP_NUMBER,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    MINIO_REGION: process.env.MINIO_REGION,
    MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_REALTIME_CHANNEL: process.env.SUPABASE_REALTIME_CHANNEL,
    APP_URL: process.env.APP_URL,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
    SUPERADMIN_NAME: process.env.SUPERADMIN_NAME,
    AUTH_RECOVERY_SECRET: process.env.AUTH_RECOVERY_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    AI_MESSAGE_BUFFER_WINDOW_MS: process.env.AI_MESSAGE_BUFFER_WINDOW_MS
  });

  return cachedEnv;
}

export const env = new Proxy({} as Env, {
  get(_target, property: string | symbol) {
    if (typeof property === "symbol") {
      return undefined;
    }

    return readEnv()[property as keyof Env];
  }
});
