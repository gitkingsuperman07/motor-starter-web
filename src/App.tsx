"use client";

import {
  Authenticated,
  Unauthenticated,
  useAction,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const me = useQuery(api.houses.me);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(1100px_500px_at_20%_-5%,#e0e7ff_0%,transparent_60%),radial-gradient(900px_400px_at_100%_0%,#dbeafe_0%,transparent_55%),linear-gradient(to_bottom,#f8fafc,#eef2ff_65%,#f8fafc)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Authenticated>
              {me?.isAdmin && (
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/90 text-slate-700 shadow-sm shadow-indigo-100 transition hover:bg-white"
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
            <div className="rounded-xl border border-white/60 bg-white p-1.5 shadow-sm shadow-indigo-100">
              <img src="/motor-logo.svg" alt="Motor Starter logo" className="h-8 w-8" />
            </div>
            <h1 className="text-sm font-semibold tracking-wide text-indigo-700 sm:text-lg">
              SMART MOTOR STARTER
            </h1>
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

      <main className="mx-auto w-full max-w-[1400px] px-3 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-5 lg:px-6">
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
  const createManagedUser = useAction(api.adminUsers.createUser);
  const updateManagedUser = useAction(api.adminUsers.updateUser);
  const deleteManagedUser = useAction(api.adminUsers.deleteUser);
  const [busy, setBusy] = useState<"START" | "STOP" | null>(null);
  const [confirmCommandType, setConfirmCommandType] = useState<"START" | "STOP" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("10");
  const [timerNotice, setTimerNotice] = useState<string | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);
  const [houseName, setHouseName] = useState("");
  const [joinKey, setJoinKey] = useState("");
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
  const [adminPage, setAdminPage] = useState<"overview" | "houses" | "users">("houses");
  const [houseManagerOpen, setHouseManagerOpen] = useState(false);
  const [houseEditName, setHouseEditName] = useState("");

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
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!status || !status.house) {
      return {
        text: "Waiting for house setup",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
    }
    if (!status.online) {
      return {
        text: "Status unknown - offline",
        className: "bg-rose-50 text-rose-800 border border-rose-200",
      };
    }
    if (status.readingFresh && status.running) {
      return {
        text: `Running (${status.amps.toFixed(1)} A)`,
        className: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      };
    }
    return {
      text: "Stopped",
      className: "bg-slate-100 text-slate-800 border border-slate-200",
    };
  }, [status]);

  const submitCommand = async (type: "START" | "STOP") => {
    setError(null);
    setBusy(type);
    try {
      await sendCommand({ type });

      if (type === "STOP") {
        if (autoStopTimerRef.current !== null) {
          window.clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }
        setTimerNotice(null);
      }

      if (type === "START" && timerEnabled) {
        const minutes = Number(timerMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
          if (autoStopTimerRef.current !== null) {
            window.clearTimeout(autoStopTimerRef.current);
          }
          autoStopTimerRef.current = window.setTimeout(() => {
            void sendCommand({ type: "STOP" })
              .then(() => setTimerNotice("Timer ended. STOP command sent."))
              .catch(() => setTimerNotice("Timer ended, but STOP command failed."));
            autoStopTimerRef.current = null;
          }, minutes * 60 * 1000);
          setTimerNotice(`Auto STOP set for ${minutes} minute${minutes > 1 ? "s" : ""}.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setBusy(null);
    }
  };

  if (status === undefined) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-indigo-100/40 backdrop-blur">
        Loading dashboard...
      </div>
    );
  }

  if (!me || !status.house || !me.membership || !me.house) {
    const showCreateHouse = !!me?.isAdmin;
    return (
      <section className={`grid gap-5 ${showCreateHouse ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {showCreateHouse && (
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-indigo-100/40 backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-900">Create house</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Create your house to enable shared motor control.
            </p>
            <input
              className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-indigo-200 transition focus:ring"
              placeholder="House name"
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
            />
            <button
              className="mt-3 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              onClick={() => void createHouse({ name: houseName })}
            >
              Create house
            </button>
          </div>
        )}

        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-indigo-100/40 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">Join with private key</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Enter the active key shared by the admin.
          </p>
          <input
            className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase outline-none ring-indigo-200 transition focus:ring"
            placeholder="Enter house key"
            value={joinKey}
            onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
          />
          <button
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            onClick={() => void joinHouseWithKey({ key: joinKey })}
          >
            Join house
          </button>
        </div>
      </section>
    );
  }

  const isAdmin = !!me.isAdmin;
  const showHousesPage = !isAdmin || adminPage === "houses";

  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[2fr_1fr]">
      <div className="space-y-5">
        {showHousesPage && (
          <>
            <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">House</p>
                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-900">{me.house.name}</h2>
                    {isAdmin && (
                      <button
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          if (houseManagerOpen) {
                            setHouseManagerOpen(false);
                            setHouseEditName("");
                            setAdminMessage(null);
                          } else {
                            setHouseManagerOpen(true);
                            setHouseEditName(me.house?.name ?? "");
                          }
                        }}
                      >
                        {houseManagerOpen ? "Back" : "Manage"}
                      </button>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {me.membership.role}
                </span>
              </div>
              <div className="mt-5">
                <div className={`rounded-2xl px-4 py-4 text-sm font-semibold ${statusLabel.className}`}>
                  {statusLabel.text}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">{status.activityMessage}</p>
              <p className="mt-1 text-xs text-slate-500">
                Last seen: {status.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString() : "-"}
              </p>
            </section>

            {status.startNotConfirmed && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                START sent but the motor has not started. It may be the starter&apos;s
                restart delay, a dry run, or no power.
              </section>
            )}

            {error && (
              <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                {error}
              </section>
            )}

            <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Motor controls</h3>
              </div>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={timerEnabled}
                      onChange={(e) => setTimerEnabled(e.target.checked)}
                    />
                    Optional timer
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Auto STOP after</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(e.target.value)}
                      disabled={!timerEnabled}
                    >
                      <option value="1">1 min</option>
                      <option value="5">5 min</option>
                      <option value="10">10 min</option>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                </div>
                {timerNotice && <p className="mt-2 text-xs text-indigo-700">{timerNotice}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  className="group relative h-20 overflow-hidden rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  disabled={busy !== null}
                  onClick={() => setConfirmCommandType("START")}
                >
                  <span className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15" />
                  <span className="relative">{busy === "START" ? "Sending..." : "START"}</span>
                </button>
                <button
                  className="group relative h-20 overflow-hidden rounded-2xl bg-red-600 text-lg font-bold text-white shadow-md shadow-red-200 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
                  disabled={busy !== null}
                  onClick={() => setConfirmCommandType("STOP")}
                >
                  <span className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15" />
                  <span className="relative">{busy === "STOP" ? "Sending..." : "STOP"}</span>
                </button>
              </div>
            </section>

            {confirmCommandType && (
              <div
                className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px]"
                onClick={() => setConfirmCommandType(null)}
              >
                <div className="grid min-h-full place-items-center p-4">
                  <div
                    className="w-full max-w-sm rounded-3xl border border-white/70 bg-white p-5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 className="text-base font-semibold text-slate-900">Confirm action</h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Send {confirmCommandType} command?
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => setConfirmCommandType(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${confirmCommandType === "START" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
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

            {isAdmin && houseManagerOpen && (
              <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">House management</h3>
                <p className="mt-1 text-xs text-slate-500">Create, edit, or delete house settings.</p>

                <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="House name"
                    value={houseEditName}
                    onChange={(e) => setHouseEditName(e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
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
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
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
                {adminMessage && <p className="mt-3 text-xs text-slate-600">{adminMessage}</p>}
              </section>
            )}

            <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Recent commands</h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                  Instant command panel
                </span>
              </div>
              {status.recentCommands.length === 0 ? (
                <p className="text-sm text-slate-500">No commands yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {status.recentCommands.map((command) => (
                    <li
                      key={command.id}
                      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3.5 py-3 text-sm shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {command.type} · {command.actorName}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                          {mapState(command.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(command.createdAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {isAdmin && adminPage === "overview" && (
          <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
            <h3 className="text-base font-semibold text-slate-900">Overview</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Connection</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{status.online ? "Online" : "Offline"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Motor</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{status.running ? "Running" : "Stopped"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">{status.activityMessage}</p>
          </section>
        )}

        {isAdmin && adminPage === "users" && (
          <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
            <h3 className="text-base font-semibold text-slate-900">Users management</h3>
            <p className="mt-1 text-xs text-slate-500">Create, edit, and delete user accounts.</p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                type="password"
                placeholder="Password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <button
                className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
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

            {adminMessage && <p className="mt-3 text-xs text-slate-600">{adminMessage}</p>}

            <ul className="mt-4 space-y-2.5">
              {(adminUsers ?? []).map((user) => {
                const isEditing = editingUserId === user.id;
                return (
                  <li
                    key={user.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{user.name || "Unnamed"}</p>
                        <p className="text-slate-500">{user.email}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Added {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        User
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200"
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditName(user.name || "");
                          setEditEmail(user.email);
                          setEditPassword("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 font-medium text-red-700 transition hover:bg-red-100"
                        onClick={() => {
                          const ok = window.confirm(`Delete user ${user.email}?`);
                          if (!ok) return;
                          void deleteManagedUser({ userId: user.id })
                            .then(() => {
                              setAdminMessage("User deleted");
                              if (editingUserId === user.id) {
                                setEditingUserId(null);
                                setEditName("");
                                setEditEmail("");
                                setEditPassword("");
                              }
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

                    {isEditing && (
                      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                          placeholder="Name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                          placeholder="Email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                          type="password"
                          placeholder="New password (optional)"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            className="flex-1 rounded-lg bg-indigo-600 px-2 py-1.5 font-medium text-white transition hover:bg-indigo-500"
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
                                  setEditingUserId(null);
                                  setEditName("");
                                  setEditEmail("");
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
                            className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200"
                            onClick={() => {
                              setEditingUserId(null);
                              setEditName("");
                              setEditEmail("");
                              setEditPassword("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <aside className="space-y-4 sm:space-y-5">
        {isAdmin ? (
          <>
            <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
              <h3 className="text-base font-semibold text-slate-900">Admin dashboard</h3>
              <p className="mt-1 text-xs text-slate-500">Select a page to manage the system.</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition ${adminPage === "overview" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  onClick={() => setAdminPage("overview")}
                >
                  Overview
                </button>
                <button
                  className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition ${adminPage === "houses" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  onClick={() => setAdminPage("houses")}
                >
                  Houses
                </button>
                <button
                  className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition ${adminPage === "users" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  onClick={() => setAdminPage("users")}
                >
                  Users
                </button>
              </div>
            </section>

            {adminPage === "houses" && me.membership.role === "owner" && (
              <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">House private keys</h3>
                <p className="mt-1 text-xs text-slate-500">Generate one active invite key at a time.</p>
                <input
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-indigo-200 transition focus:ring"
                  placeholder="Key label (optional)"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                />
                <button
                  className="mt-2 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
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
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-xs"
                    >
                      <p className="font-semibold tracking-[0.12em] text-slate-900">{item.key}</p>
                      <p className="mt-1 text-slate-500">
                        {item.label ?? "No label"} · Active until rotated or deleted
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200"
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
                className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[3px]"
                onClick={() => setAdminSidebarOpen(false)}
              >
                <aside
                  className="absolute left-0 top-0 h-full w-full max-w-md overflow-y-auto border-r border-white/70 bg-white/95 p-5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Admin pages</h3>
                        <p className="text-xs text-slate-500">Navigate to overview, houses, and users</p>
                      </div>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setAdminSidebarOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAdminPage("overview");
                        setAdminSidebarOpen(false);
                      }}
                    >
                      Overview page
                    </button>
                    <button
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAdminPage("houses");
                        setAdminSidebarOpen(false);
                      }}
                    >
                      Houses page
                    </button>
                    <button
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAdminPage("users");
                        setAdminSidebarOpen(false);
                      }}
                    >
                      Users page
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </>
        ) : (
          <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-indigo-100/40 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Overview</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">Connection</p>
                <p className="mt-1 font-semibold text-slate-900">{status.online ? "Online" : "Offline"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">Motor</p>
                <p className="mt-1 font-semibold text-slate-900">{status.running ? "Running" : "Stopped"}</p>
              </div>
            </div>
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
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
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
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      onClick={() => {
        const ok = window.confirm("Are you sure you want to logout?");
        if (!ok) return;
        void signOut();
      }}
    >
      Logout
    </button>
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
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}>
        <ProfilePill name={name} email={email} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(90vw,18rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Profile</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{name || "Unnamed user"}</p>
          <p className="text-xs text-slate-500">{email || "No email"}</p>
          <p className="text-xs text-slate-500">{phone || "No phone"}</p>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <SignOutButton />
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
  const resolvedLoginEmail = useQuery((api as any).adminUsers.resolveLoginEmail, {
    identifier,
  }) as string | undefined;

  const submitLogin = async () => {
    const formData = new FormData();
    formData.set("flow", "signIn");
    const loginEmail = (resolvedLoginEmail ?? identifier).trim().toLowerCase();
    formData.set("email", loginEmail);
    formData.set("password", password);
    await signIn("password", formData);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-indigo-100/50 backdrop-blur">
      <h2 className="mb-5 text-center text-lg font-semibold text-slate-900">
        Sign in
      </h2>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          void submitLogin().catch((err) => {
            setError(err instanceof Error ? err.message : "Authentication failed");
          });
        }}
      >
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-indigo-200 transition focus:ring"
          type="text"
          placeholder="Username or Email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <div className="relative">
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-11 outline-none ring-indigo-200 transition focus:ring"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition hover:text-slate-700"
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
          className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          type="submit"
        >
          Sign in
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
