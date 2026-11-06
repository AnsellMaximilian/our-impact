import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AuthError, createAuthStore } from "./auth.mjs";

let auth;
let currentTime;

beforeEach(() => {
  currentTime = Date.parse("2026-11-06T10:00:00.000Z");
  auth = createAuthStore({ databasePath: ":memory:", now: () => currentTime });
});

afterEach(() => auth.close());

describe("Mike's shop authentication", () => {
  it("signs up a customer and restores the HttpOnly session", async () => {
    const result = await auth.signUp({
      displayName: "Jamie",
      email: "JAMIE@example.com",
      password: "community123",
    });

    assert.equal(result.user.email, "jamie@example.com");
    assert.match(result.user.externalUserId, /^mikes-vegan-shop:[0-9a-f-]+$/);
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /SameSite=Lax/);

    const request = { headers: { cookie: result.cookie.split(";")[0] } };
    assert.deepEqual(auth.getUser(request), result.user);
  });

  it("keeps the stable external user id across sign-ins", async () => {
    const first = await auth.signUp({
      displayName: "Alex",
      email: "alex@example.com",
      password: "community123",
    });
    const second = await auth.signIn({
      email: "alex@example.com",
      password: "community123",
    });

    assert.equal(second.user.externalUserId, first.user.externalUserId);
  });

  it("rejects duplicate accounts and invalid passwords", async () => {
    await auth.signUp({
      displayName: "Riley",
      email: "riley@example.com",
      password: "community123",
    });

    await assert.rejects(
      auth.signUp({ displayName: "Riley", email: "riley@example.com", password: "community456" }),
      (error) => error instanceof AuthError && error.code === "email_already_registered",
    );
    await assert.rejects(
      auth.signIn({ email: "riley@example.com", password: "wrong-password" }),
      (error) => error instanceof AuthError && error.code === "invalid_email_or_password",
    );
  });

  it("expires and deletes sessions", async () => {
    const result = await auth.signUp({
      displayName: "Morgan",
      email: "morgan@example.com",
      password: "community123",
    });
    const request = { headers: { cookie: result.cookie.split(";")[0] } };

    auth.signOut(request);
    assert.equal(auth.getUser(request), null);

    const signedIn = await auth.signIn({ email: "morgan@example.com", password: "community123" });
    const nextRequest = { headers: { cookie: signedIn.cookie.split(";")[0] } };
    currentTime += 8 * 24 * 60 * 60 * 1000;
    assert.equal(auth.getUser(nextRequest), null);
  });
});
