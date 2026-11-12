"use client";

import {
  Authenticated,
  Unauthenticated,
  useAction,
  useConvex,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

const surface =
  "rounded-[28px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_18px_40px_-24px_rgba(24,24,27,0.16)]";
const field =
  "w-full max-w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-100";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400";
const timerPresets = ["1", "5", "10", "15", "30", "60"] as const;

export default function App() {
  const me = useQuery(api.houses.me);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#f4f4f5] text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-2 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Authenticated>
              {me?.isAdmin && (
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={() => setAdminSidebarOpen(true)}
                  aria-label="Open admin menu"
                  title="Open admin menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              )}
            </Authenticated>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black p-0.5 shadow-sm">
              <img src="/motor-logo.png" alt="Motor Starter logo" className="h-8 w-8 rounded-xl object-cover" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-950 sm:text-base">
                Smart Motor Starter
              </h1>
              <p className="hidden text-[11px] font-medium text-zinc-400 sm:block">
                House motor control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Authenticated>
              <ProfileMenu
                name={me?.user.name ?? null}
                email={me?.user.email ?? null}
                phone={me?.user.phone ?? null}
                open={profileOpen}
                setOpen={setProfileOpen}
              />
            </Authenticated>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-3 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-5 lg:px-6">
        <Authenticated>
          <Dashboard
            adminSidebarOpen={adminSidebarOpen}
            setAdminSidebarOpen={setAdminSidebarOpen}
          />
        </Authenticated>
        <Unauthenticated>
          <AuthCard />
        </Unauthenticated>
      </main>
    </div>
  );
}

function Dashboard({
  adminSidebarOpen,
  setAdminSidebarOpen,
}: {
  adminSidebarOpen: boolean;
  setAdminSidebarOpen: (open: boolean) => void;
}) {
  const me = useQuery(api.houses.me);
  const adminUsers = useQuery(api.adminUsers.listUsers, me?.isAdmin ? {} : "skip");
  const status = useQuery(api.commands.status);
  const sendCommand = useMutation(api.commands.sendCommand);
  const heartbeat = useMutation(api.commands.heartbeat);
  const createHouse = useMutation(api.houses.createHouse);
  const joinHouseWithKey = useMutation(api.houses.joinHouseWithKey);
  const createHouseKey = useMutation(api.houses.createHouseKey);
  const updateHouseKey = useMutation(api.houses.updateHouseKey);
  const deleteHouseKey = useMutation(api.houses.deleteHouseKey);
  const renameCurrentHouse = useMutation(api.houses.renameCurrentHouse);
  const deleteCurrentHouse = useMutation(api.houses.deleteCurrentHouse);
  const selectHouse = useMutation(api.houses.selectHouse);
  const ownedHouses = useQuery(api.houses.listOwnedHouses, me?.isAdmin ? {} : "skip");
  const createManagedUser = useAction(api.adminUsers.createUser);
  const updateManagedUser = useAction(api.adminUsers.updateUser);
  const deleteManagedUser = useAction(api.adminUsers.deleteUser);
  const [busy, setBusy] = useState<"START" | "STOP" | null>(null);
  const [confirmCommandType, setConfirmCommandType] = useState<"START" | "STOP" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("10");
  const [timerNotice, setTimerNotice] = useState<string | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoStopTimerRef = useRef<number | null>(null);
  const buttonLabelTimerRef = useRef<number | null>(null);
  const scheduledMinutesRef = useRef<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState<"START" | "STOP" | null>(null);
  const [houseName, setHouseName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [adminPage, setAdminPage] = useState<"overview" | "houses" | "manage" | "users">("houses");
  const [houseEditName, setHouseEditName] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [showManagedPassword, setShowManagedPassword] = useState(false);
  const [motorState, setMotorState] = useState<"START" | "STOP" | null>(null);

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

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current !== null) {
        window.clearTimeout(autoStopTimerRef.current);
      }
      if (buttonLabelTimerRef.current !== null) {
        window.clearTimeout(buttonLabelTimerRef.current);
      }
    };
  }, []);

  const showButtonResult = (type: "START" | "STOP") => {
    if (buttonLabelTimerRef.current !== null) {
      window.clearTimeout(buttonLabelTimerRef.current);
    }
    setButtonLabel(type);
    buttonLabelTimerRef.current = window.setTimeout(() => {
      setButtonLabel(null);
      buttonLabelTimerRef.current = null;
    }, 10_000);
  };

  useEffect(() => {
    if (motorState && status?.lastCommand?.type === motorState) {
      setMotorState(null);
    }
  }, [motorState, status?.lastCommand?.type]);

  const commanded = motorState ?? status?.lastCommand?.type ?? null;

  useEffect(() => {
    if (timerEndsAt === null) {
      return;
    }
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [timerEndsAt]);

  useEffect(() => {
    const clearCountdown = () => {
      if (autoStopTimerRef.current !== null) {
        window.clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      scheduledMinutesRef.current = null;
      setTimerEndsAt(null);
    };

    if (!timerEnabled || commanded !== "START") {
      clearCountdown();
      return;
    }

    const minutes = Number(timerMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      clearCountdown();
      return;
    }

    if (scheduledMinutesRef.current === timerMinutes && autoStopTimerRef.current !== null) {
      return;
    }

    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
    }

    const startedAt = Date.now();
    scheduledMinutesRef.current = timerMinutes;
    setNow(startedAt);
    setTimerEndsAt(startedAt + minutes * 60 * 1000);
    autoStopTimerRef.current = window.setTimeout(() => {
      void sendCommand({ type: "STOP" })
        .then(() => {
          setMotorState("STOP");
          showButtonResult("STOP");
          setTimerNotice("Timer ended. STOP command sent.");
        })
        .catch(() => setTimerNotice("Timer ended, but STOP command failed."));
      autoStopTimerRef.current = null;
      scheduledMinutesRef.current = null;
      setTimerEndsAt(null);
    }, minutes * 60 * 1000);
    setTimerNotice(`Auto STOP set for ${minutes} minute${minutes > 1 ? "s" : ""}.`);
  }, [timerEnabled, timerMinutes, commanded, sendCommand]);

  const statusLabel = useMemo(() => {
    if (!status || !status.house) {
      return {
        text: "Waiting for house setup",
        tone: "idle" as const,
        className: "bg-zinc-100 text-zinc-700",
      };
    }
    if (commanded === "START") {
      return {
        text: "Started",
        tone: "running" as const,
        className: "bg-emerald-50 text-emerald-700",
      };
    }
    if (commanded === "STOP") {
      return {
        text: "Stopped",
        tone: "stopped" as const,
        className: "bg-zinc-100 text-zinc-800",
      };
    }
    if (!status.online) {
      return {
        text: "Status unknown - offline",
        tone: "offline" as const,
        className: "bg-rose-50 text-rose-700",
      };
    }
    if (status.readingFresh && status.running) {
      return {
        text: "Started",
        tone: "running" as const,
        className: "bg-emerald-50 text-emerald-700",
      };
    }
    return {
      text: "Stopped",
      tone: "stopped" as const,
      className: "bg-zinc-100 text-zinc-800",
    };
  }, [commanded, status]);

  const submitCommand = async (type: "START" | "STOP") => {
    setError(null);
    setBusy(type);
    try {
      await sendCommand({ type });
      setMotorState(type);
      showButtonResult(type);

      if (type === "STOP") {
        if (autoStopTimerRef.current !== null) {
          window.clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }
        scheduledMinutesRef.current = null;
        setTimerNotice(null);
        setTimerEndsAt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setBusy(null);
    }
  };

  if (status === undefined) {
    return (
      <div className={`${surface} p-6 text-sm text-zinc-500`}>Loading dashboard...</div>
    );
  }

  if (!me || !status.house || !me.membership || !me.house) {
    const showCreateHouse = !!me?.isAdmin;
    return (
      <section className={`grid gap-4 ${showCreateHouse ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {showCreateHouse && (
          <div className={`${surface} p-6`}>
            <p className={eyebrow}>Admin</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Create house</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Create your house to enable shared motor control.
            </p>
            <input
              className={`${field} mt-5`}
              placeholder="House name"
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
            />
            <button
              className="mt-3 w-full rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              onClick={() => void createHouse({ name: houseName })}
            >
              Create house
            </button>
          </div>
        )}

        <div className={`${surface} p-6`}>
          <p className={eyebrow}>Access</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Join with private key</h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            Enter the 6-character key shared by the admin.
          </p>
          <input
            className={`${field} mt-5 uppercase tracking-[0.18em]`}
            placeholder="6-character key"
            value={joinKey}
            maxLength={6}
            onChange={(e) => {
              setJoinError(null);
              setJoinKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
            }}
          />
          <button
            className="mt-3 flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={joining || joinKey.length !== 6}
            onClick={() => {
              setJoining(true);
              setJoinError(null);
              void joinHouseWithKey({ key: joinKey })
                .catch((err) => setJoinError(friendlyError(err)))
                .finally(() => setJoining(false));
            }}
          >
            {joining ? <LoadingLabel label="Joining..." /> : "Join house"}
          </button>
          {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
        </div>
      </section>
    );
  }

  const timerTotalMs = Math.max(1, Number(timerMinutes) * 60 * 1000);
  const timerRemainingMs = timerEndsAt === null ? 0 : Math.max(0, timerEndsAt - now);
  const timerProgress = timerEndsAt === null ? 0 : Math.min(1, timerRemainingMs / timerTotalMs);

  const isAdmin = !!me.isAdmin;
  const showHousesPage = !isAdmin || adminPage === "houses";
  const visibleCommands = isAdmin
    ? status.recentCommands
    : status.recentCommands.filter((command) => command.actorId === me.user.id).slice(0, 1);
  const adminPages = [
    ["overview", "Overview"],
    ["houses", "Houses"],
    ["manage", "Manage"],
    ["users", "Users"],
  ] as const;

  const openHouseManagement = () => {
    setHouseEditName(me.house?.name ?? "");
    setAdminMessage(null);
    setAdminPage("manage");
  };

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        {showHousesPage && (
          <>
            <section className={`${surface} overflow-hidden p-5 sm:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={eyebrow}>House</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <button
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        onClick={openHouseManagement}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back
                      </button>
                    )}
                    <h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-zinc-950">{me.house.name}</h2>
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  {me.membership.role}
                </span>
              </div>

              <div className={`mt-5 flex items-center gap-3 rounded-[22px] px-4 py-4 ${statusLabel.className}`}>
                <span className="relative grid h-3 w-3 place-items-center">
                  {statusLabel.tone === "running" && (
                    <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/70" />
                  )}
                  <span
                    className={`relative h-2.5 w-2.5 rounded-full ${
                      statusLabel.tone === "running"
                        ? "bg-emerald-500"
                        : statusLabel.tone === "offline"
                          ? "bg-rose-500"
                          : "bg-zinc-400"
                    }`}
                  />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Live status</p>
                  <p className="text-base font-semibold tracking-tight">{statusLabel.text}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-zinc-600">{status.activityMessage}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Last seen: {status.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString() : "-"}
              </p>
            </section>

            {error && (
              <section className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </section>
            )}

            <section className={`${surface} p-5 sm:p-6`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={eyebrow}>Instant commands</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
                    Start or stop
                  </h3>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">Auto stop timer</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Sends STOP after the motor starts
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={timerEnabled}
                    onClick={() => setTimerEnabled(!timerEnabled)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${timerEnabled ? "bg-zinc-950" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition ${timerEnabled ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {timerPresets.map((minutes) => {
                    const selected = timerMinutes === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        disabled={!timerEnabled}
                        onClick={() => setTimerMinutes(minutes)}
                        className={`rounded-2xl px-2 py-2.5 text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected
                            ? "bg-zinc-950 text-white"
                            : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {minutes}
                        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide opacity-70">
                          min
                        </span>
                      </button>
                    );
                  })}
                </div>
                {timerEnabled && timerEndsAt !== null && (
                  <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200">
                    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0" aria-hidden="true">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="#e4e4e7" strokeWidth="4" />
                      <circle
                        cx="28"
                        cy="28"
                        r="22"
                        fill="none"
                        stroke="#18181b"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 22}
                        strokeDashoffset={2 * Math.PI * 22 * (1 - timerProgress)}
                        transform="rotate(-90 28 28)"
                      />
                    </svg>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        Remaining
                      </p>
                      <p className="text-3xl font-semibold tracking-tight text-zinc-950 tabular-nums">
                        {formatRemaining(timerRemainingMs, Number(timerMinutes) * 60)}
                      </p>
                      <p className="text-xs text-zinc-500">until auto STOP</p>
                    </div>
                  </div>
                )}
                {timerNotice && (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                    {timerNotice}
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <button
                  className={`relative flex min-h-16 items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-emerald-600 px-4 py-4 text-base font-semibold tracking-wide text-white shadow-[0_12px_24px_-16px_rgba(5,150,105,0.9)] transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-emerald-300 sm:h-[88px] sm:text-lg ${buttonLabel === "START" ? "started-live" : ""}`}
                  disabled={busy !== null}
                  onClick={() => setConfirmCommandType("START")}
                >
                  {buttonLabel !== "START" && <PlayIcon />}
                  {busy === "START" ? "Sending..." : buttonLabel === "START" ? "Started" : "START"}
                </button>
                <button
                  className={`relative flex min-h-16 items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-rose-600 px-4 py-4 text-base font-semibold tracking-wide text-white shadow-[0_12px_24px_-16px_rgba(225,29,72,0.9)] transition hover:bg-rose-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-rose-300 sm:h-[88px] sm:text-lg ${buttonLabel === "STOP" ? "stopped-live" : ""}`}
                  disabled={busy !== null}
                  onClick={() => setConfirmCommandType("STOP")}
                >
                  {buttonLabel !== "STOP" && <StopIcon />}
                  {busy === "STOP" ? "Sending..." : buttonLabel === "STOP" ? "Stopped" : "STOP"}
                </button>
              </div>
            </section>

            {confirmCommandType && (
              <div
                className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
                onClick={() => setConfirmCommandType(null)}
              >
                <div className="grid min-h-full place-items-center p-4">
                  <div
                    className="w-full max-w-sm rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className={eyebrow}>Confirm</p>
                    <h4 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                      Send {confirmCommandType}?
                    </h4>
                    <p className="mt-1 text-sm text-zinc-500">
                      This goes to the motor starter immediately.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                        onClick={() => setConfirmCommandType(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className={`rounded-2xl px-3 py-2.5 text-sm font-semibold text-white ${confirmCommandType === "START" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}
                        onClick={() => {
                          const selected = confirmCommandType;
                          setConfirmCommandType(null);
                          void submitCommand(selected);
                        }}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <section className={`${surface} p-5 sm:p-6`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className={eyebrow}>Activity</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Recent commands</h3>
                  {!isAdmin && (
                    <p className="mt-1 text-xs text-zinc-500">Your latest start or stop.</p>
                  )}
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-zinc-500">
                  {visibleCommands.length}
                </span>
              </div>
              {visibleCommands.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
                  No commands yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {visibleCommands.map((command) => (
                    <li
                      key={command.id}
                      className="flex items-center justify-between gap-3 rounded-[22px] bg-zinc-50 px-3.5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[11px] font-bold ${
                            command.type === "START"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {command.type === "START" ? "ON" : "OFF"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-950">
                            {command.type === "START" ? "started by" : "stopped by"} {command.actorName}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {new Date(command.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold lowercase tracking-wide ${
                          command.type === "START"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {command.type === "START" ? "motor started" : "motor stopped"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {isAdmin && adminPage === "overview" && (
          <section className={`${surface} p-5 sm:p-6`}>
            <p className={eyebrow}>Admin</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Overview</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile label="Connection" value={status.online ? "Online" : "Offline"} live={status.online} />
              <MetricTile label="Motor" value={commanded === "START" ? "Started" : "Stopped"} live={commanded === "START"} />
            </div>
            <p className="mt-4 rounded-[22px] bg-zinc-50 px-4 py-3 text-sm text-zinc-600">{status.activityMessage}</p>
          </section>
        )}

        {isAdmin && adminPage === "manage" && (
          <section className={`${surface} p-5 sm:p-6`}>
            <p className={eyebrow}>Houses</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">House management</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Select a house, or create, rename, and delete one.
            </p>
            <ul className="mt-4 space-y-2">
              {(ownedHouses ?? []).length === 0 ? (
                <li className="rounded-[22px] border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400">
                  No houses yet.
                </li>
              ) : (
                (ownedHouses ?? []).map((house) => (
                  <li key={house.id}>
                    <button
                      className={`flex w-full items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-left transition ${
                        house.selected
                          ? "bg-zinc-950 text-white"
                          : "bg-zinc-50 text-zinc-950 hover:bg-zinc-100"
                      }`}
                      onClick={() =>
                        void selectHouse({ houseId: house.id })
                          .then(() => {
                            setHouseEditName(house.name);
                            setAdminMessage(null);
                          })
                          .catch((err) =>
                            setAdminMessage(
                              err instanceof Error ? err.message : "Failed to select house",
                            ),
                          )
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{house.name}</span>
                        <span className={`mt-0.5 block text-xs ${house.selected ? "text-zinc-400" : "text-zinc-500"}`}>
                          {new Date(house.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          house.selected ? "bg-white/15 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200"
                        }`}
                      >
                        {house.selected ? "Selected" : "Select"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 space-y-4 rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-500">House name</span>
                <input
                  className={field}
                  placeholder="House name"
                  value={houseEditName}
                  onChange={(e) => setHouseEditName(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  className="rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                  onClick={() =>
                    void createHouse({ name: houseEditName || "New House" })
                      .then(() => {
                        setAdminMessage("House created");
                      })
                      .catch((err) => {
                        setAdminMessage(
                          err instanceof Error ? err.message : "Failed to create house",
                        );
                      })
                  }
                >
                  Create
                </button>
                <button
                  className="rounded-2xl bg-zinc-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600"
                  onClick={() =>
                    void renameCurrentHouse({ name: houseEditName })
                      .then(() => setAdminMessage("House updated"))
                      .catch((err) =>
                        setAdminMessage(
                          err instanceof Error ? err.message : "Failed to update house",
                        ),
                      )
                  }
                >
                  Edit
                </button>
                <button
                  className="rounded-2xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
                  onClick={() => {
                    const ok = window.confirm("Delete this house?");
                    if (!ok) return;
                    void deleteCurrentHouse({})
                      .then(() => setAdminMessage("House deleted"))
                      .catch((err) =>
                        setAdminMessage(
                          err instanceof Error ? err.message : "Failed to delete house",
                        ),
                      );
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {adminMessage && (
              <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200">
                {adminMessage}
              </p>
            )}
          </section>
        )}

        {isAdmin && adminPage === "users" && (
          <section className={`${surface} p-5 sm:p-6`}>
            <p className={eyebrow}>Directory</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Users</h3>
            <p className="mt-1 text-xs text-zinc-500">Create, edit, and delete user accounts.</p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">Select a user to view and manage their account.</p>
              <button
                className="shrink-0 rounded-2xl bg-zinc-950 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={() => {
                  setCreateUserOpen(true);
                  setAdminMessage(null);
                }}
              >
                Create user
              </button>
            </div>

            {adminMessage && !createUserOpen && !editingUserId && (
              <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200">
                {adminMessage}
              </p>
            )}

            <ul className="mt-4 space-y-2.5">
              {(adminUsers ?? []).map((user) => (
                <li key={user.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-zinc-50 p-3.5 text-left text-xs transition hover:bg-zinc-100"
                    onClick={() => {
                      setEditingUserId(user.id);
                      setEditName(user.name || "");
                      setEditEmail(user.email);
                      setEditPassword("");
                      setShowManagedPassword(false);
                      setAdminMessage(null);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-xs font-semibold text-white">
                        {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-zinc-950">{user.name || "Unnamed"}</span>
                        <span className="block truncate text-zinc-500">{user.email}</span>
                        <span className="mt-0.5 block text-[11px] text-zinc-400">
                          Added {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200">
                      User
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {createUserOpen && (
              <div
                className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
                onClick={() => setCreateUserOpen(false)}
              >
                <div className="grid min-h-full place-items-center p-4">
                  <div
                    className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={eyebrow}>Users</p>
                        <h4 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Create user</h4>
                        <p className="mt-1 text-xs text-zinc-500">Name, phone, email, and a password they can sign in with.</p>
                      </div>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        onClick={() => setCreateUserOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-500">Name</span>
                        <input
                          className={field}
                          placeholder="Full name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-500">Phone</span>
                        <input
                          className={field}
                          type="tel"
                          placeholder="Phone number"
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-500">Email</span>
                        <input
                          className={field}
                          type="email"
                          placeholder="name@email.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-zinc-500">Password</span>
                        <div className="relative">
                          <input
                            className={`${field} pr-16`}
                            type={showNewUserPassword ? "text" : "password"}
                            placeholder="Password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                            onClick={() => setShowNewUserPassword((value) => !value)}
                          >
                            {showNewUserPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>
                    </div>
                    {adminMessage && (
                      <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        {adminMessage}
                      </p>
                    )}
                    <button
                      className="mt-4 w-full rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      disabled={!newUserEmail.trim() || !newUserPassword}
                      onClick={() =>
                        void createManagedUser({
                          name: newUserName,
                          phone: newUserPhone,
                          email: newUserEmail,
                          password: newUserPassword,
                        })
                          .then(() => {
                            setAdminMessage("User created");
                            setNewUserName("");
                            setNewUserPhone("");
                            setNewUserEmail("");
                            setNewUserPassword("");
                            setCreateUserOpen(false);
                          })
                          .catch((err) => {
                            setAdminMessage(
                              err instanceof Error ? err.message : "Failed to create user",
                            );
                          })
                      }
                    >
                      Create user
                    </button>
                  </div>
                </div>
              </div>
            )}

            {editingUserId && (
              <div
                className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
                onClick={() => setEditingUserId(null)}
              >
                <div className="grid min-h-full place-items-center overflow-y-auto p-4">
                  <div
                    className="my-6 w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {(() => {
                      const user = (adminUsers ?? []).find((item) => item.id === editingUserId);
                      if (!user) {
                        return <p className="text-sm text-zinc-500">User not found.</p>;
                      }
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={eyebrow}>User</p>
                              <h4 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
                                {user.name || "Unnamed"}
                              </h4>
                              <p className="text-xs text-zinc-500">{user.email}</p>
                              <p className="text-xs text-zinc-500">{user.phone || "No phone"}</p>
                            </div>
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                              onClick={() => setEditingUserId(null)}
                            >
                              Close
                            </button>
                          </div>
                          <div className="mt-4 rounded-[22px] bg-zinc-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                Password
                              </p>
                              <button
                                type="button"
                                className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                                onClick={() => setShowManagedPassword((value) => !value)}
                              >
                                {showManagedPassword ? "Hide" : "Show"}
                              </button>
                            </div>
                            <p className="mt-1 font-mono text-sm text-zinc-950">
                              {user.knownPassword
                                ? showManagedPassword
                                  ? user.knownPassword
                                  : "••••••••"
                                : "Not set yet"}
                            </p>
                          </div>
                          <div className="mt-4 space-y-2">
                            <input
                              className={field}
                              placeholder="Name"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <input
                              className={field}
                              placeholder="Email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                            />
                            <input
                              className={field}
                              type="password"
                              placeholder="Reset password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                className="flex-1 rounded-2xl bg-zinc-950 px-2 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                                onClick={() => {
                                  void updateManagedUser({
                                    userId: user.id,
                                    name: editName,
                                    phone: user.phone,
                                    email: editEmail,
                                    newPassword: editPassword || undefined,
                                  })
                                    .then(() => {
                                      setAdminMessage("User updated");
                                      setEditPassword("");
                                    })
                                    .catch((err) => {
                                      setAdminMessage(
                                        err instanceof Error ? err.message : "Failed to update user",
                                      );
                                    });
                                }}
                              >
                                Save
                              </button>
                              <button
                                className="rounded-2xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                                onClick={() => {
                                  const ok = window.confirm(`Delete user ${user.email}?`);
                                  if (!ok) return;
                                  void deleteManagedUser({ userId: user.id })
                                    .then(() => {
                                      setAdminMessage("User deleted");
                                      setEditingUserId(null);
                                      setEditName("");
                                      setEditEmail("");
                                      setEditPassword("");
                                    })
                                    .catch((err) => {
                                      setAdminMessage(
                                        err instanceof Error ? err.message : "Failed to delete user",
                                      );
                                    });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {adminMessage && (
                            <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                              {adminMessage}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="min-w-0 space-y-4 sm:space-y-5">
        {isAdmin ? (
          <>
            <section className={`${surface} p-5`}>
              <p className={eyebrow}>Navigate</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Admin dashboard</h3>
              <p className="mt-1 text-xs text-zinc-500">Select a page to manage the system.</p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {adminPages.map(([page, label]) => (
                  <button
                    key={page}
                    className={`rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      adminPage === page
                        ? "bg-zinc-950 text-white"
                        : "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                    }`}
                    onClick={() => {
                      if (page === "manage") {
                        openHouseManagement();
                        return;
                      }
                      setAdminPage(page);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {adminPage === "houses" && me.membership.role === "owner" && (
              <section className={`${surface} p-5`}>
                <p className={eyebrow}>Access</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Private keys</h3>
                <p className="mt-1 text-xs text-zinc-500">Generate one active invite key at a time.</p>
                <input
                  className={`${field} mt-4`}
                  placeholder="Key label (optional)"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                />
                <button
                  className="mt-2 w-full rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  onClick={() =>
                    void createHouseKey({
                      label: newKeyLabel || undefined,
                    }).then(() => setNewKeyLabel(""))
                  }
                >
                  Generate new private key
                </button>

                <ul className="mt-3 space-y-2.5">
                  {me.houseKeys.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[22px] bg-zinc-50 p-3.5 text-xs"
                    >
                      <p className="font-semibold tracking-[0.16em] text-zinc-950">{item.key}</p>
                      <p className="mt-1 text-zinc-500">
                        {item.label ?? "No label"} · Active until rotated or deleted
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="rounded-xl bg-white px-2.5 py-1.5 font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
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
                          className="rounded-lg bg-red-50 px-2.5 py-1.5 font-medium text-red-700 transition hover:bg-red-100"
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

            {adminSidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[3px]"
                onClick={() => setAdminSidebarOpen(false)}
              >
                <aside
                  className="absolute left-0 top-0 flex h-full w-full max-w-sm flex-col border-r border-zinc-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="shrink-0 border-b border-zinc-100 bg-white px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={eyebrow}>Admin</p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Pages</h3>
                      </div>
                      <button
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        onClick={() => setAdminSidebarOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
                    {adminPages.map(([page, label]) => (
                      <button
                        key={page}
                        className={`block w-full shrink-0 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                          adminPage === page
                            ? "bg-zinc-950 text-white"
                            : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                        }`}
                        onClick={() => {
                          if (page === "manage") {
                            openHouseManagement();
                          } else {
                            setAdminPage(page);
                          }
                          setAdminSidebarOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </>
        ) : (
          <section className={`${surface} p-5`}>
            <p className={eyebrow}>Your house</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Overview</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <MetricTile label="Connection" value={status.online ? "Online" : "Offline"} live={status.online} />
              <MetricTile label="Motor" value={commanded === "START" ? "Started" : "Stopped"} live={commanded === "START"} />
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function friendlyError(err: unknown) {
  const data = err && typeof err === "object" && "data" in err ? (err as { data?: unknown }).data : undefined;
  const message = `${err instanceof Error ? err.message : ""} ${typeof data === "string" ? data : ""}`;
  const text = message.toLowerCase();
  if (text.includes("invalid house key")) {
    return "Invalid house key. Ask the admin for the current 6-character key.";
  }
  if (text.includes("already belong")) {
    return "You already belong to a house.";
  }
  if (text.includes("wrong name or email") || text.includes("invalidaccountid") || text.includes("invalid account")) {
    return "Wrong name or email. Please try again.";
  }
  if (
    text.includes("invalid credentials") ||
    text.includes("invalidsecret") ||
    text.includes("invalid secret") ||
    text.includes("invalid password") ||
    text.includes("wrong password")
  ) {
    return "Wrong password. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

function LoadingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {label}
    </span>
  );
}

function formatRemaining(ms: number, maxSeconds?: number) {
  let total = Math.max(0, Math.floor(ms / 1000));
  if (maxSeconds !== undefined && Number.isFinite(maxSeconds)) {
    total = Math.min(total, maxSeconds);
  }
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function MetricTile({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="rounded-[22px] bg-zinc-50 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-zinc-300"}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">{value}</p>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
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
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 shadow-sm">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
        {initials || "U"}
      </div>
      <div className="hidden sm:block">
        <p className="max-w-[9rem] truncate text-xs font-semibold text-zinc-900">{display}</p>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  if (!isAuthenticated) {
    return null;
  }
  return (
    <>
      <button
        className="rounded-xl bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        onClick={() => {
          setLogoutError(null);
          setConfirmOpen(true);
        }}
      >
        Logout
      </button>
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
          onClick={() => {
            if (!signingOut) setConfirmOpen(false);
          }}
        >
          <div className="grid min-h-full place-items-center p-4">
            <div
              className="w-full max-w-sm rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <p className={eyebrow}>Confirm</p>
              <h4 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                Are you sure you want to logout?
              </h4>
              <p className="mt-1 text-sm text-zinc-500">
                You will need to sign in again to control the motor.
              </p>
              {logoutError && <p className="mt-3 text-sm text-red-600">{logoutError}</p>}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={signingOut}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex items-center justify-center rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    setLogoutError(null);
                    void signOut().catch((err) => {
                      setSigningOut(false);
                      setLogoutError(friendlyError(err));
                    });
                  }}
                >
                  {signingOut ? <LoadingLabel label="Logging out..." /> : "Logout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileMenu({
  name,
  email,
  phone,
  open,
  setOpen,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const updateOwnName = useMutation(api.adminUsers.updateOwnName);
  const resetOwnPassword = useAction(api.adminUsers.resetOwnPassword);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(name ?? "");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}>
        <ProfilePill name={name} email={email} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(90vw,18rem)] rounded-[24px] border border-zinc-200 bg-white p-4 shadow-2xl">
          <p className={eyebrow}>Profile</p>
          <p className="mt-3 text-sm font-semibold text-zinc-950">{name || "Unnamed user"}</p>
          <p className="text-xs text-zinc-500">{email || "No email"}</p>
          <p className="text-xs text-zinc-500">{phone || "No phone"}</p>
          <button
            className="mt-4 w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            onClick={() => {
              setNameDraft(name ?? "");
              setPasswordDraft("");
              setPasswordAgain("");
              setProfileMessage(null);
              setProfilePageOpen(true);
              setOpen(false);
            }}
          >
            Profile
          </button>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <SignOutButton />
          </div>
        </div>
      )}

      {profilePageOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]"
          onClick={() => setProfilePageOpen(false)}
        >
          <div className="grid min-h-full place-items-center overflow-y-auto p-4">
            <div
              className="my-6 w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={eyebrow}>Account</p>
                  <h4 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">Profile</h4>
                  <p className="mt-1 text-xs text-zinc-500">{email || "No email"}</p>
                  <p className="text-xs text-zinc-500">{phone || "No phone"}</p>
                </div>
                <button
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  onClick={() => setProfilePageOpen(false)}
                >
                  Close
                </button>
              </div>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-500">Name</span>
                <input
                  className={field}
                  placeholder="Your name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </label>
              <button
                className="mt-3 w-full rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={!nameDraft.trim()}
                onClick={() =>
                  void updateOwnName({ name: nameDraft })
                    .then(() => setProfileMessage(name ? "Name changed" : "Name added"))
                    .catch((err) =>
                      setProfileMessage(err instanceof Error ? err.message : "Failed to save name"),
                    )
                }
              >
                {name ? "Change name" : "Add name"}
              </button>

              <div className="mt-5 space-y-2 border-t border-zinc-100 pt-5">
                <p className="text-sm font-semibold text-zinc-950">Reset password</p>
                <div className="relative">
                  <input
                    className={`${field} pr-16`}
                    type={showResetPassword ? "text" : "password"}
                    placeholder="New password"
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() => setShowResetPassword((value) => !value)}
                  >
                    {showResetPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  className={field}
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={passwordAgain}
                  onChange={(event) => setPasswordAgain(event.target.value)}
                />
                <button
                  className="w-full rounded-2xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  disabled={!passwordDraft || !passwordAgain}
                  onClick={() => {
                    if (passwordDraft !== passwordAgain) {
                      setProfileMessage("Passwords do not match");
                      return;
                    }
                    void resetOwnPassword({ newPassword: passwordDraft })
                      .then(() => {
                        setPasswordDraft("");
                        setPasswordAgain("");
                        setProfileMessage("Password reset");
                      })
                      .catch((err) =>
                        setProfileMessage(
                          err instanceof Error ? err.message : "Failed to reset password",
                        ),
                      );
                  }}
                >
                  Reset password
                </button>
              </div>

              {profileMessage && (
                <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{profileMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthCard() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const convex = useConvex();

  const submitLogin = async () => {
    const accountExists = await convex.query(api.adminUsers.loginIdentifierExists, { identifier });
    if (!accountExists) {
      throw new Error("Wrong name or email");
    }
    const loginEmail = (await convex.query((api as any).adminUsers.resolveLoginEmail, {
      identifier,
    })) as string;
    const formData = new FormData();
    formData.set("flow", "signIn");
    formData.set("email", (loginEmail || identifier).trim().toLowerCase());
    formData.set("password", password);
    await signIn("password", formData);
  };

  return (
    <div className={`${surface} mx-auto w-full max-w-md p-6 sm:p-7`}>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 w-fit overflow-hidden rounded-2xl border border-zinc-200 bg-black p-1">
          <img src="/motor-logo.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Sign in</h2>
        <p className="mt-1 text-sm text-zinc-500">Control the motor for your house.</p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSigningIn(true);
          void submitLogin()
            .catch((err) => {
              setError(friendlyError(err));
            })
            .finally(() => setSigningIn(false));
        }}
      >
        <input
          className={field}
          type="text"
          placeholder="Username or Email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <div className="relative">
          <input
            className={`${field} pr-11`}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition hover:text-zinc-700"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.72-2.02 1.9-3.78 3.4-5.16" />
                <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.98 10.98 0 0 1-1.67 2.68" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <button
          className="flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-3 py-2.5 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          type="submit"
          disabled={signingIn}
        >
          {signingIn ? <LoadingLabel label="Signing in..." /> : "Sign in"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
