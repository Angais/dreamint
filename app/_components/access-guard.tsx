"use client";

import { useEffect, useState, useTransition } from "react";
import { checkAccessSession, verifyAccessPassword } from "../actions/access-control";

type AccessGuardProps = {
  protectionEnabled: boolean;
  children: React.ReactNode;
};

const ATTEMPT_KEY = "dreamint/access-attempts";
const LOCK_KEY = "dreamint/access-lock-until";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

export function AccessGuard({ protectionEnabled, children }: AccessGuardProps) {
  const [status, setStatus] = useState<"checking" | "prompt" | "granted" | "locked">("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!protectionEnabled) {
      setStatus("granted");
      return;
    }

    const now = Date.now();
    const storedLockUntil = typeof window !== "undefined" ? Number(window.localStorage.getItem(LOCK_KEY)) : 0;
    if (storedLockUntil && storedLockUntil > now) {
      setLockUntil(storedLockUntil);
      setStatus("locked");
      return;
    }
    if (storedLockUntil) {
      window.localStorage.removeItem(LOCK_KEY);
      window.localStorage.removeItem(ATTEMPT_KEY);
    }

    startTransition(() => {
      checkAccessSession()
        .then((result) => {
          if (result.valid) {
            setStatus("granted");
          } else {
            setStatus("prompt");
          }
        })
        .catch(() => {
          setStatus("prompt");
        });
    });
  }, [protectionEnabled, startTransition]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!protectionEnabled) {
      setStatus("granted");
      return;
    }

    const submittedPassword = password.trim();
    if (!submittedPassword) {
      setError("Password is required.");
      return;
    }

    const now = Date.now();
    const storedLockUntil = typeof window !== "undefined" ? Number(window.localStorage.getItem(LOCK_KEY)) : 0;
    if (storedLockUntil && storedLockUntil > now) {
      setLockUntil(storedLockUntil);
      setStatus("locked");
      return;
    }

    startTransition(() => {
      verifyAccessPassword(submittedPassword)
        .then((result) => {
          if (result.valid) {
            window.localStorage.removeItem(ATTEMPT_KEY);
            window.localStorage.removeItem(LOCK_KEY);
            setStatus("granted");
            setPassword("");
          } else {
            const attempts = typeof window !== "undefined" ? Number(window.localStorage.getItem(ATTEMPT_KEY) ?? "0") : 0;
            const nextAttempts = attempts + 1;
            if (typeof window !== "undefined") {
              window.localStorage.setItem(ATTEMPT_KEY, String(nextAttempts));
            }
            if (nextAttempts >= MAX_ATTEMPTS) {
              const until = Date.now() + LOCKOUT_MS;
              if (typeof window !== "undefined") {
                window.localStorage.setItem(LOCK_KEY, String(until));
              }
              setLockUntil(until);
              setStatus("locked");
              setError(`Too many attempts. Try again in ${Math.ceil(LOCKOUT_MS / 60000)} minutes.`);
              return;
            }
            setError("Incorrect password. Try again.");
            setStatus("prompt");
          }
        })
        .catch(() => {
          setError("Unable to verify password. Please retry.");
          setStatus("prompt");
        });
    });
  };

  if (status === "granted") {
    return <>{children}</>;
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        <div className="rounded-lg border border-neutral-800 px-6 py-5">
          <p className="text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (status === "locked") {
    const remainingMs = lockUntil ? Math.max(0, lockUntil - Date.now()) : LOCKOUT_MS;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white px-4">
        <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-7 shadow-xl">
          <h1 className="text-xl font-semibold">Access Locked</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Too many incorrect attempts. Please wait {remainingMinutes} minute{remainingMinutes === 1 ? "" : "s"} before trying again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-7 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Private Access</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Enter the access password to continue. This is stored locally so you will not be asked again
          on this browser.
        </p>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-sm text-neutral-200" htmlFor="access-password">
              Password
            </label>
            <input
              id="access-password"
              name="access-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none ring-0 focus:border-neutral-500"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
