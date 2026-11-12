import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type CommandType = "START" | "STOP";

type CommandStatus = "pending" | "sent" | "acked" | "expired";

const ONLINE_WINDOW_MS = 40_000;
const START_EXPIRES_MS = 20_000;
const STOP_EXPIRES_MS = 120_000;
const FAST_WINDOW_MS = 60_000;
const FAST_POLL_MS = 2_000;
const SLOW_POLL_MS = 15_000;

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }
  return userId;
}

async function getUserMembership(ctx: any, userId: Id<"users">) {
  return await ctx.db
    .query("houseMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

async function ensureDeviceState(ctx: any) {
  const existing = await ctx.db.query("deviceState").first();
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("deviceState", {
    lastSeenAt: 0,
    fastUntil: 0,
    amps: 0,
    running: false,
    lastReadingAt: 0,
    lowAmpStreak: 0,
  });
  return (await ctx.db.get("deviceState", id))!;
}

async function readDeviceState(ctx: any) {
  const existing = await ctx.db.query("deviceState").first();
  if (existing) {
    return existing;
  }
  return {
    _id: null,
    lastSeenAt: 0,
    fastUntil: 0,
    amps: 0,
    running: false,
    lastReadingAt: 0,
    lowAmpStreak: 0,
  };
}

function formatCommand(command: {
  _id: Id<"commands">;
  houseId?: Id<"houses">;
  type: CommandType;
  status: CommandStatus;
  createdAt: number;
  expiresAt: number;
  sentAt?: number;
  ackedAt?: number;
}) {
  return {
    id: command._id,
    houseId: command.houseId ?? null,
    type: command.type,
    status: command.status,
    createdAt: command.createdAt,
    expiresAt: command.expiresAt,
    sentAt: command.sentAt ?? null,
    ackedAt: command.ackedAt ?? null,
  };
}

export const sendCommand = mutation({
  args: {
    type: v.union(v.literal("START"), v.literal("STOP")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const membership = await getUserMembership(ctx, userId);
    if (!membership) {
      throw new ConvexError("Create or join a house first");
    }

    const now = Date.now();
    const deviceState = await ensureDeviceState(ctx);
    if (deviceState.houseId && deviceState.houseId !== membership.houseId) {
      throw new ConvexError("This board is linked to a different house");
    }

    const online = now - deviceState.lastSeenAt < ONLINE_WINDOW_MS;

    if (args.type === "START" && !online) {
      throw new ConvexError("Board is offline, START is blocked");
    }

    if (args.type === "STOP") {
      const pendingStarts = await ctx.db
        .query("commands")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
      for (const command of pendingStarts) {
        if (command.type === "START" && command.houseId === membership.houseId) {
          await ctx.db.patch("commands", command._id, {
            status: "expired",
            expiresAt: now,
          });
        }
      }
    }

    const pendingOfSameType = await ctx.db
      .query("commands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const existingPending = pendingOfSameType.find(
      (command) =>
        command.houseId === membership.houseId &&
        command.type === args.type &&
        command.expiresAt > now,
    );

    if (existingPending) {
      await ctx.db.patch("deviceState", deviceState._id, {
        fastUntil: now + FAST_WINDOW_MS,
      });
      return formatCommand(existingPending);
    }

    const expiresAt =
      now + (args.type === "START" ? START_EXPIRES_MS : STOP_EXPIRES_MS);

    const id = await ctx.db.insert("commands", {
      houseId: membership.houseId,
      type: args.type,
      status: "pending",
      createdAt: now,
      expiresAt,
      createdBy: userId,
    });

    await ctx.db.patch("deviceState", deviceState._id, {
      fastUntil: now + FAST_WINDOW_MS,
      houseId: membership.houseId,
    });

    const inserted = await ctx.db.get("commands", id);
    return formatCommand(inserted!);
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const membership = await getUserMembership(ctx, userId);
    if (!membership) {
      throw new ConvexError("Create or join a house first");
    }
    const now = Date.now();
    const deviceState = await ensureDeviceState(ctx);
    await ctx.db.patch("deviceState", deviceState._id, {
      fastUntil: now + FAST_WINDOW_MS,
      houseId: membership.houseId,
    });
    return { ok: true };
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const membership = await getUserMembership(ctx, userId);
    if (!membership) {
      return {
        online: false,
        running: false,
        amps: 0,
        readingFresh: false,
        lastSeenAt: 0,
        lastReadingAt: 0,
        lastCommand: null,
        recentCommands: [],
        startNotConfirmed: false,
        house: null,
        activityMessage: "Create or join a house to control the motor",
      };
    }

    const now = Date.now();
    const deviceState = await readDeviceState(ctx);
    const house = await ctx.db.get("houses", membership.houseId);

    const commands = (await ctx.db
      .query("commands")
      .withIndex("by_house_createdAt", (q) => q.eq("houseId", membership.houseId))
      .order("desc")
      .take(20)) as Array<
      {
        _id: Id<"commands">;
        createdBy: Id<"users">;
        houseId?: Id<"houses">;
        type: CommandType;
        status: CommandStatus;
        createdAt: number;
        expiresAt: number;
        sentAt?: number;
        ackedAt?: number;
      }
    >;

    const lastCommand = commands[0] ?? null;
    const online =
      now - deviceState.lastSeenAt < ONLINE_WINDOW_MS &&
      (!deviceState.houseId || deviceState.houseId === membership.houseId);
    const readingFresh = now - deviceState.lastReadingAt < ONLINE_WINDOW_MS;

    const startAckedNotRunning = commands.find(
      (command) =>
        command.type === "START" &&
        command.status === "acked" &&
        command.ackedAt !== undefined,
    );

    const startNotConfirmed =
      !!startAckedNotRunning &&
      now - (startAckedNotRunning.ackedAt ?? now) > 20_000 &&
      !deviceState.running;

    let activityMessage = "No activity yet";
    if (lastCommand) {
      const actor = await ctx.db.get("users", lastCommand.createdBy);
      const actorLabel = actor?.name ?? actor?.email ?? "Someone";
      if (deviceState.running) {
        activityMessage = `Motor is ON by ${actorLabel}`;
      } else {
        activityMessage = `Motor is STOPPED by ${actorLabel}`;
      }
    }

    const commandUsers = await Promise.all(
      commands.map(async (command) => {
        const actor = await ctx.db.get("users", command.createdBy);
        return {
          ...formatCommand(command),
          actorName: actor?.name ?? actor?.email ?? "Unknown",
        };
      }),
    );

    return {
      online,
      running: deviceState.running,
      amps: deviceState.amps,
      readingFresh,
      lastSeenAt: deviceState.lastSeenAt,
      lastReadingAt: deviceState.lastReadingAt,
      lastCommand: lastCommand ? formatCommand(lastCommand) : null,
      recentCommands: commandUsers,
      startNotConfirmed,
      house: house
        ? {
            id: house._id,
            name: house.name,
            role: membership.role,
          }
        : null,
      activityMessage,
    };
  },
});

export const devicePoll = internalMutation({
  args: {
    ackId: v.optional(v.string()),
    amps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const deviceState = await ensureDeviceState(ctx);

    let running = deviceState.running;
    let lowAmpStreak = deviceState.lowAmpStreak;
    let amps = deviceState.amps;
    let lastReadingAt = deviceState.lastReadingAt;

    if (typeof args.amps === "number") {
      amps = args.amps;
      lastReadingAt = now;

      if (amps > 1.0) {
        running = true;
        lowAmpStreak = 0;
      } else if (amps < 0.5) {
        lowAmpStreak += 1;
        if (lowAmpStreak >= 2) {
          running = false;
        }
      } else {
        lowAmpStreak = 0;
      }

      await ctx.db.insert("readings", { at: now, amps });
      const readings = await ctx.db
        .query("readings")
        .withIndex("by_at")
        .order("desc")
        .take(201);
      if (readings.length > 200) {
        for (const reading of readings.slice(200)) {
          await ctx.db.delete("readings", reading._id);
        }
      }
    }

    await ctx.db.patch("deviceState", deviceState._id, {
      lastSeenAt: now,
      amps,
      running,
      lastReadingAt,
      lowAmpStreak,
    });

    if (args.ackId) {
      const ackCommandId = ctx.db.normalizeId("commands", args.ackId);
      if (ackCommandId) {
        const ackCommand = await ctx.db.get("commands", ackCommandId);
        if (ackCommand && ackCommand.status !== "acked") {
          await ctx.db.patch("commands", ackCommand._id, {
            status: "acked",
            ackedAt: now,
          });
        }
      }
    }

    const pendingCommands = await ctx.db
      .query("commands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    for (const command of pendingCommands) {
      if (command.expiresAt <= now) {
        await ctx.db.patch("commands", command._id, { status: "expired" });
      }
    }

    const validPending = (await ctx.db
      .query("commands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect())
      .filter(
        (command) =>
          command.expiresAt > now &&
          (!deviceState.houseId || command.houseId === deviceState.houseId),
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    const nextCommand = validPending[0] ?? null;
    if (nextCommand) {
      if (!deviceState.houseId && nextCommand.houseId) {
        await ctx.db.patch("deviceState", deviceState._id, {
          houseId: nextCommand.houseId,
        });
      }
      await ctx.db.patch("commands", nextCommand._id, {
        status: "sent",
        sentAt: now,
      });
    }

    const hasFastPoll =
      now < deviceState.fastUntil ||
      (nextCommand !== null && now - nextCommand.createdAt < FAST_WINDOW_MS);

    return {
      command: nextCommand
        ? {
            id: nextCommand._id,
            type: nextCommand.type,
          }
        : null,
      nextPollMs: hasFastPoll ? FAST_POLL_MS : SLOW_POLL_MS,
    };
  },
});
