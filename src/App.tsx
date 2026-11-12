"use client";

import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useMemo, useState } from "react";

export default function App() {
  const me = useQuery(api.houses.me);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between p-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-indigo-600">
              SMART MOTOR STARTER
            </p>
            <h1 className="text-lg font-semibold">Remote Pump Control</h1>
          </div>
          <div className="flex items-center gap-3">
            <Authenticated>
              <ProfilePill
                name={me?.user.name ?? null}
                email={me?.user.email ?? null}
              />
              <SignOutButton />
            </Authenticated>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl p-4 pb-10">
        <Authenticated>
          <Dashboard />
        </Authenticated>
        <Unauthenticated>
          <AuthCard />
        </Unauthenticated>
      </main>
    </div>
  );
}

function Dashboard() {
  const me = useQuery(api.houses.me);
  const status = useQuery(api.commands.status);
  const sendCommand = useMutation(api.commands.sendCommand);
  const heartbeat = useMutation(api.commands.heartbeat);
  const createHouse = useMutation(api.houses.createHouse);
  const joinHouseWithKey = useMutation(api.houses.joinHouseWithKey);
  const createHouseKey = useMutation(api.houses.createHouseKey);
  const updateHouseKey = useMutation(api.houses.updateHouseKey);
  const deleteHouseKey = useMutation(api.houses.deleteHouseKey);
  const [busy, setBusy] = useState<"START" | "STOP" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [houseName, setHouseName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");

  useEffect(() => {
    if (!status?.house || document.visibilityState !== "visible") {
      return;
    }

    void heartbeat({});

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void heartbeat({});
      }
    }, 20_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void heartbeat({});
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heartbeat, status?.house]);

  const statusLabel = useMemo(() => {
    if (!status || !status.house) {
      return {
        text: "Waiting for house setup",
        className: "bg-slate-200 text-slate-700",
      };
    }
    if (!status.online) {
      return {
        text: "Status unknown - board offline",
        className: "bg-amber-100 text-amber-900",
      };
    }
    if (status.readingFresh && status.running) {
      return {
        text: `Running (${status.amps.toFixed(1)} A)`,
        className: "bg-emerald-100 text-emerald-900",
      };
    }
    return {
      text: "Stopped",
      className: "bg-slate-200 text-slate-900",
    };
  }, [status]);

  const submitCommand = async (type: "START" | "STOP") => {
    if (type === "START") {
      const ok = window.confirm("Send START command?");
      if (!ok) {
        return;
      }
    }
    setError(null);
    setBusy(type);
    try {
      await sendCommand({ type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setBusy(null);
    }
  };

  if (status === undefined) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        Loading dashboard...
      </div>
    );
  }

  if (!me || !status.house || !me.membership || !me.house) {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create house</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create your house to enable shared motor control.
          </p>
          <input
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="House name"
            value={houseName}
            onChange={(e) => setHouseName(e.target.value)}
          />
          <button
            className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white"
            onClick={() => void createHouse({ name: houseName })}
          >
            Create house
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Join with private key</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter a valid 24-hour key from a house owner.
          </p>
          <input
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
            placeholder="Enter house key"
            value={joinKey}
            onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
          />
          <button
            className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white"
            onClick={() => void joinHouseWithKey({ key: joinKey })}
          >
            Join house
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{me.house.name}</h2>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {me.membership.role}
            </span>
          </div>
          <div
            className={`mt-4 rounded-xl px-4 py-5 text-center text-xl font-semibold ${statusLabel.className}`}
          >
            {statusLabel.text}
          </div>
          <p className="mt-3 text-sm text-slate-600">{status.activityMessage}</p>
          <p className="mt-1 text-xs text-slate-500">
            Last seen: {status.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString() : "-"}
          </p>
        </section>

        {status.startNotConfirmed && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            START sent but the motor has not started. It may be the starter&apos;s
            restart delay, a dry run, or no power.
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            className="h-16 rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={!status.online || busy !== null}
            onClick={() => void submitCommand("START")}
          >
            {busy === "START" ? "Sending..." : "START"}
          </button>
          <button
            className="h-16 rounded-xl bg-red-600 text-lg font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-red-300"
            disabled={busy !== null}
            onClick={() => void submitCommand("STOP")}
          >
            {busy === "STOP" ? "Sending..." : "STOP"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-base font-semibold">Recent commands</h3>
          {status.recentCommands.length === 0 ? (
            <p className="text-sm text-slate-500">No commands yet.</p>
          ) : (
            <ul className="space-y-2">
              {status.recentCommands.map((command) => (
                <li
                  key={command.id}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {command.type} · {command.actorName}
                    </span>
                    <span className="text-slate-600">
                      {mapState(command.status)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(command.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">User profile</h3>
          <p className="mt-2 text-sm text-slate-700">{me.user.name ?? "Unnamed user"}</p>
          <p className="text-xs text-slate-500">{me.user.email ?? "No email"}</p>
          <p className="text-xs text-slate-500">{me.user.phone ?? "No phone"}</p>
        </section>

        {me.membership.role === "owner" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">House private keys</h3>
            <input
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Key label (optional)"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
            />
            <button
              className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white"
              onClick={() =>
                void createHouseKey({
                  label: newKeyLabel || undefined,
                }).then(() => setNewKeyLabel(""))
              }
            >
              Create new private key (24h)
            </button>

            <ul className="mt-3 space-y-2">
              {me.houseKeys.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 p-2 text-xs"
                >
                  <p className="font-semibold tracking-wide">{item.key}</p>
                  <p className="text-slate-500">
                    {item.label ?? "No label"} · Expires {new Date(item.expiresAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded bg-slate-100 px-2 py-1"
                      onClick={() =>
                        void updateHouseKey({
                          id: item.id,
                          regenerate: true,
                          label: item.label ?? undefined,
                        })
                      }
                    >
                      Regenerate
                    </button>
                    <button
                      className="rounded bg-red-50 px-2 py-1 text-red-700"
                      onClick={() => void deleteHouseKey({ id: item.id })}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

function mapState(status: "pending" | "sent" | "acked" | "expired") {
  if (status === "acked") {
    return "confirmed";
  }
  return status;
}

function ProfilePill({ name, email }: { name: string | null; email: string | null }) {
  const display = name || email || "User";
  const initials = display
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {initials || "U"}
      </div>
      <div className="hidden pr-2 sm:block">
        <p className="text-xs font-semibold text-slate-800">{display}</p>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  if (!isAuthenticated) {
    return null;
  }
  return (
    <button
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
      onClick={() => void signOut()}
    >
      Logout
    </button>
  );
}

function AuthCard() {
  const { signIn } = useAuthActions();
  const [tab, setTab] = useState<"signIn" | "signUp" | "forgot">("signIn");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [signupStep, setSignupStep] = useState<"details" | "otp">("details");
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestSignupOtp = async () => {
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    const formData = new FormData();
    formData.set("flow", "signUp");
    formData.set("name", name.trim());
    formData.set("phone", phone.trim());
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);

    await signIn("password", formData);
    setSignupStep("otp");
    setNotice("OTP sent to your email inbox.");
  };

  const verifySignupOtp = async () => {
    const formData = new FormData();
    formData.set("flow", "email-verification");
    formData.set("email", email.trim().toLowerCase());
    formData.set("code", otp.trim());

    await signIn("password", formData);
  };

  const submitSignin = async () => {
    const formData = new FormData();
    formData.set("flow", "signIn");
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);
    await signIn("password", formData);
  };

  const requestResetOtp = async () => {
    const formData = new FormData();
    formData.set("flow", "reset");
    formData.set("email", email.trim().toLowerCase());
    await signIn("password", formData);
    setForgotStep("verify");
    setNotice("Password reset OTP sent to your email inbox.");
  };

  const submitResetPassword = async () => {
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }
    const formData = new FormData();
    formData.set("flow", "reset-verification");
    formData.set("email", email.trim().toLowerCase());
    formData.set("code", otp.trim());
    formData.set("newPassword", password);
    await signIn("password", formData);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${(tab === "signIn" || tab === "forgot") ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          onClick={() => {
            setTab("signIn");
            setForgotStep("request");
            setError(null);
            setNotice(null);
          }}
        >
          Sign in
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "signUp" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          onClick={() => {
            setTab("signUp");
            setSignupStep("details");
            setError(null);
            setNotice(null);
          }}
        >
          Sign up
        </button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setNotice(null);

          const run = async () => {
            if (tab === "signIn") {
              await submitSignin();
            } else if (tab === "signUp" && signupStep === "details") {
              await requestSignupOtp();
            } else if (tab === "signUp") {
              await verifySignupOtp();
            } else if (forgotStep === "request") {
              await requestResetOtp();
            } else {
              await submitResetPassword();
            }
          };

          void run().catch((err) => {
            setError(err instanceof Error ? err.message : "Authentication failed");
          });
        }}
      >
        {tab === "signUp" && (
          <>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </>
        )}

        <input
          className="w-full rounded-xl border border-slate-300 px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {(tab === "signUp" && signupStep === "otp") ||
        (tab === "forgot" && forgotStep === "verify") ? (
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="OTP code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
        ) : null}

        {(tab === "signIn" ||
          (tab === "signUp" && signupStep === "details") ||
          (tab === "forgot" && forgotStep === "verify")) && (
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            type="password"
            placeholder={tab === "forgot" ? "New password" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        {(tab === "signUp" && signupStep === "details") ||
        (tab === "forgot" && forgotStep === "verify") ? (
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        ) : null}

        <button
          className="w-full rounded-xl bg-indigo-600 px-3 py-2 font-semibold text-white"
          type="submit"
        >
          {tab === "signIn"
            ? "Sign in"
            : tab === "signUp" && signupStep === "details"
              ? "Send OTP"
              : tab === "signUp"
                ? "Verify OTP and create account"
                : forgotStep === "request"
                  ? "Send reset OTP"
                  : "Reset password"}
        </button>
      </form>

      {tab === "signIn" && (
        <button
          className="mt-3 text-sm text-slate-600 underline"
          onClick={() => {
            setTab("forgot");
            setForgotStep("request");
            setOtp("");
            setPassword("");
            setConfirmPassword("");
            setError(null);
            setNotice(null);
          }}
        >
          Forgot password?
        </button>
      )}

      {tab === "signUp" && signupStep === "otp" && (
        <button
          className="mt-3 text-sm text-slate-600 underline"
          onClick={() => {
            setSignupStep("details");
            setOtp("");
            setNotice(null);
            setError(null);
          }}
        >
          Edit details
        </button>
      )}

      {tab === "forgot" && forgotStep === "verify" && (
        <button
          className="mt-3 text-sm text-slate-600 underline"
          onClick={() => {
            setForgotStep("request");
            setOtp("");
            setPassword("");
            setConfirmPassword("");
            setError(null);
            setNotice(null);
          }}
        >
          Use a different email
        </button>
      )}

      {tab === "forgot" && (
        <button
          className="mt-3 text-sm text-slate-600 underline"
          onClick={() => {
            setTab("signIn");
            setForgotStep("request");
            setError(null);
            setNotice(null);
          }}
        >
          Back to sign in
        </button>
      )}

      {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
