import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { loadEnvFile } from "node:process";
import { promisify } from "node:util";
import postgres from "postgres";

try {
  loadEnvFile(".env");
} catch {
  // Production usually provides DATABASE_URL via environment variables.
}

const scryptAsync = promisify(scrypt);
const keyLength = 64;
const databaseUrl = process.env.DATABASE_URL ?? "postgres://auto_pro_ia:auto_pro_ia@localhost:5432/auto_pro_ia";

const systemUserId = "00000000-0000-0000-0000-000000000001";
const now = new Date();

const seedUsers = [
  {
    name: "Superadmin",
    email: process.env.SUPERADMIN_EMAIL ?? "admin@autopro.ia",
    role: "super_admin",
    password: "AutoPro@2026Admin"
  },
  {
    name: "Camila",
    email: "camila@autopro.ia",
    role: "gerente",
    password: "AutoPro@2026Camila"
  },
  {
    name: "Ana Carolina",
    email: "ana@autopro.ia",
    role: "atendente",
    password: "AutoPro@2026Ana"
  },
  {
    name: "Aline",
    email: "aline@autopro.ia",
    role: "atendente",
    password: "AutoPro@2026Aline"
  },
  {
    name: "Ricardo IA",
    email: "ia@autopro.ia",
    role: "ia",
    password: "AutoPro@2026IA"
  }
];

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, keyLength);

  return `scrypt:${salt}:${Buffer.from(derived).toString("base64url")}`;
}

async function main() {
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    await sql`
      insert into users (
        id,
        name,
        email,
        role,
        updated_at,
        is_deleted,
        modified_by
      )
      values (
        ${systemUserId},
        'Auto Pro IA',
        'sistema@autoproia.local',
        'admin',
        ${now},
        false,
        ${systemUserId}
      )
      on conflict (id) do update set
        name = excluded.name,
        role = excluded.role,
        updated_at = excluded.updated_at,
        is_deleted = false,
        modified_by = excluded.modified_by
    `;

    for (const user of seedUsers) {
      const passwordHash = await hashPassword(user.password);
      const email = user.email.trim().toLowerCase();

      await sql`
        insert into users (
          id,
          name,
          email,
          role,
          password_hash,
          password_set_at,
          email_verified_at,
          invite_token_hash,
          invite_expires_at,
          invited_at,
          updated_at,
          is_deleted,
          modified_by
        )
        values (
          ${randomUUID()},
          ${user.name},
          ${email},
          ${user.role},
          ${passwordHash},
          null,
          null,
          null,
          null,
          null,
          ${now},
          false,
          ${systemUserId}
        )
        on conflict (email) do update set
          name = excluded.name,
          role = excluded.role,
          password_hash = case
            when users.password_hash is null and users.password_set_at is null then excluded.password_hash
            else users.password_hash
          end,
          password_set_at = users.password_set_at,
          email_verified_at = users.email_verified_at,
          invite_token_hash = case
            when users.password_hash is null and users.password_set_at is null then null
            else users.invite_token_hash
          end,
          invite_expires_at = case
            when users.password_hash is null and users.password_set_at is null then null
            else users.invite_expires_at
          end,
          invited_at = case
            when users.password_hash is null and users.password_set_at is null then null
            else users.invited_at
          end,
          updated_at = excluded.updated_at,
          is_deleted = false,
          modified_by = excluded.modified_by
      `;
    }

    const rows = await sql`
      select
        name,
        email,
        role,
        password_hash is not null as has_password,
        password_set_at is not null as password_set,
        case
          when password_hash is not null and password_set_at is null then true
          else false
        end as first_access_required
      from users
      where email in ${sql(seedUsers.map((user) => user.email.trim().toLowerCase()))}
      order by
        case role
          when 'super_admin' then 1
          when 'gerente' then 2
          when 'atendente' then 3
          when 'ia' then 4
          else 5
        end,
        name
    `;

    console.log(JSON.stringify({
      seeded: rows,
      safety: "Senhas reais preservadas: o seed so cria senha temporaria quando password_hash e password_set_at estao vazios.",
      credentials: seedUsers.map((user) => ({
        ...user,
        firstAccess: "Entre com esta senha temporaria; o sistema pedira para criar uma nova senha."
      }))
    }, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[seed-users] failed", error);
  process.exitCode = 1;
});
