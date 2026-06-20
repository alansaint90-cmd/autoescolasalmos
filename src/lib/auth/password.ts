import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 64;

export function createAuthToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function hashAuthToken(token: string) {
  const derived = (await scryptAsync(token, "auto-pro-ia-auth-token", 64)) as Buffer;
  return derived.toString("base64url");
}

export function validatePasswordStrength(password: string) {
  if (password.length < 8) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letras e numeros na senha.";
  }

  return null;
}
