import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const cookieName = "mikes_shop_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export class AuthError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function createAuthStore({
  databasePath = "./data/mikes-vegan-shop.sqlite",
  secureCookies = false,
  now = () => Date.now(),
} = {}) {
  const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new DatabaseSync(resolvedPath);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      external_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `);

  const findUserByEmail = database.prepare(`
    SELECT id, external_user_id, email, display_name, password_hash, created_at
    FROM users WHERE email = ?
  `);
  const findUserBySession = database.prepare(`
    SELECT users.id, users.external_user_id, users.email, users.display_name, users.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `);
  const insertUser = database.prepare(`
    INSERT INTO users (id, external_user_id, email, display_name, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSession = database.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  const deleteSession = database.prepare("DELETE FROM sessions WHERE token_hash = ?");
  const deleteExpiredSessions = database.prepare("DELETE FROM sessions WHERE expires_at <= ?");

  async function signUp({ email, password, displayName }) {
    const normalized = validateCredentials({ email, password, displayName, requireName: true });
    if (findUserByEmail.get(normalized.email)) throw new AuthError("email_already_registered", 409);

    const id = randomUUID();
    const createdAt = now();
    const passwordHash = await hashPassword(normalized.password);
    insertUser.run(
      id,
      `mikes-vegan-shop:${id}`,
      normalized.email,
      normalized.displayName,
      passwordHash,
      createdAt,
    );

    return createSession({
      id,
      external_user_id: `mikes-vegan-shop:${id}`,
      email: normalized.email,
      display_name: normalized.displayName,
      created_at: createdAt,
    });
  }

  async function signIn({ email, password }) {
    const normalized = validateCredentials({ email, password, requireName: false });
    const row = findUserByEmail.get(normalized.email);
    if (!row || !(await verifyPassword(normalized.password, row.password_hash))) {
      throw new AuthError("invalid_email_or_password", 401);
    }
    return createSession(row);
  }

  function createSession(row) {
    deleteExpiredSessions.run(now());
    const token = randomBytes(32).toString("base64url");
    const createdAt = now();
    const expiresAt = createdAt + sessionLifetimeSeconds * 1000;
    insertSession.run(hashToken(token), row.id, createdAt, expiresAt);
    return { user: publicUser(row), cookie: sessionCookie(token, sessionLifetimeSeconds) };
  }

  function getUser(request) {
    const token = readCookie(request.headers.cookie, cookieName);
    if (!token) return null;
    const row = findUserBySession.get(hashToken(token), now());
    return row ? publicUser(row) : null;
  }

  function signOut(request) {
    const token = readCookie(request.headers.cookie, cookieName);
    if (token) deleteSession.run(hashToken(token));
    return sessionCookie("", 0);
  }

  function sessionCookie(token, maxAge) {
    return [
      `${cookieName}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      secureCookies ? "Secure" : "",
    ].filter(Boolean).join("; ");
  }

  return {
    signUp,
    signIn,
    getUser,
    signOut,
    close: () => database.close(),
  };
}

function validateCredentials({ email, password, displayName, requireName }) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";
  const normalizedDisplayName = typeof displayName === "string" ? displayName.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new AuthError("invalid_email");
  }
  if (normalizedPassword.length < 8 || normalizedPassword.length > 128) {
    throw new AuthError("password_must_be_8_to_128_characters");
  }
  if (requireName && (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 80)) {
    throw new AuthError("display_name_must_be_2_to_80_characters");
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword,
    displayName: normalizedDisplayName,
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString("base64url")}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, salt, encoded] = String(stored).split(":");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(header, name) {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function publicUser(row) {
  return {
    id: row.id,
    externalUserId: row.external_user_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
