import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const NEVER_EXPIRES_AT = 253402300799000;

function readEnv(name: string) {
  const processEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return processEnv?.[name];
}

async function requireAdminUser(ctx: any, userId: any) {
  const user = await ctx.db.get("users", userId);
  const adminEmail = readEnv("ADMIN_EMAIL")?.trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();
  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
    throw new ConvexError("Only admin can perform this action");
  }
}

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }
  return userId;
}

function generateHouseKey() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function getMembership(ctx: any, userId: any) {
  return await ctx.db
    .query("houseMembers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        user: {
          id: null,
          name: null,
          phone: null,
          email: null,
        },
        isAdmin: false,
        membership: null,
        house: null,
        houseKeys: [],
      };
    }
    const user = await ctx.db.get("users", userId);
    const membership = await getMembership(ctx, userId);
    const house = membership
      ? await ctx.db.get("houses", membership.houseId)
      : null;
    const keys = membership
      ? await ctx.db
          .query("houseKeys")
          .withIndex("by_house", (q) => q.eq("houseId", membership.houseId))
          .order("desc")
          .take(10)
      : [];
    const adminEmail = readEnv("ADMIN_EMAIL")?.trim().toLowerCase();
    const isAdmin =
      !!adminEmail && user?.email?.trim().toLowerCase() === adminEmail;

    return {
      user: {
        id: userId,
        name: user?.name ?? null,
        phone: user?.phone ?? null,
        email: user?.email ?? null,
      },
      isAdmin,
      membership: membership
        ? {
            houseId: membership.houseId,
            role: membership.role,
          }
        : null,
      house: house
        ? {
            id: house._id,
            name: house.name,
            ownerId: house.ownerId,
          }
        : null,
      houseKeys: keys.map((item) => ({
        id: item._id,
        key: item.key,
        label: item.label ?? null,
        expiresAt: item.expiresAt,
      })),
    };
  },
});

export const createHouse = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const existingMembership = await getMembership(ctx, userId);

    const now = Date.now();
    const houseId = await ctx.db.insert("houses", {
      name: args.name.trim(),
      ownerId: userId,
      createdAt: now,
    });

    if (existingMembership) {
      await ctx.db.patch("houseMembers", existingMembership._id, {
        houseId,
        role: "owner",
      });
    } else {
      await ctx.db.insert("houseMembers", {
        houseId,
        userId,
        role: "owner",
        createdAt: now,
      });
    }

    return { houseId };
  },
});

export const joinHouseWithKey = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existingMembership = await getMembership(ctx, userId);
    if (existingMembership) {
      throw new ConvexError("You already belong to a house");
    }

    const now = Date.now();
    const normalizedKey = args.key.trim().toUpperCase();

    const invite = await ctx.db
      .query("houseKeys")
      .withIndex("by_key", (q) => q.eq("key", normalizedKey))
      .first();

    if (!invite) {
      throw new ConvexError("Invalid house key");
    }

    const alreadyInHouse = await ctx.db
      .query("houseMembers")
      .withIndex("by_house_user", (q) =>
        q.eq("houseId", invite.houseId).eq("userId", userId),
      )
      .first();

    if (!alreadyInHouse) {
      await ctx.db.insert("houseMembers", {
        houseId: invite.houseId,
        userId,
        role: "member",
        createdAt: now,
      });
    }

    return { houseId: invite.houseId };
  },
});

export const createHouseKey = mutation({
  args: {
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Admin must be the house owner");
    }

    const now = Date.now();
    const existingKeys = await ctx.db
      .query("houseKeys")
      .withIndex("by_house", (q) => q.eq("houseId", membership.houseId))
      .collect();
    for (const item of existingKeys) {
      await ctx.db.delete("houseKeys", item._id);
    }

    const key = generateHouseKey();
    const id = await ctx.db.insert("houseKeys", {
      houseId: membership.houseId,
      key,
      label: args.label?.trim() || undefined,
      expiresAt: NEVER_EXPIRES_AT,
      createdAt: now,
      createdBy: userId,
    });

    return { id, key, expiresAt: NEVER_EXPIRES_AT };
  },
});

export const updateHouseKey = mutation({
  args: {
    id: v.id("houseKeys"),
    label: v.optional(v.string()),
    regenerate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Admin must be the house owner");
    }

    const target = await ctx.db.get("houseKeys", args.id);
    if (!target || target.houseId !== membership.houseId) {
      throw new ConvexError("Key not found");
    }

    if (args.regenerate) {
      const existingKeys = await ctx.db
        .query("houseKeys")
        .withIndex("by_house", (q) => q.eq("houseId", membership.houseId))
        .collect();
      for (const item of existingKeys) {
        await ctx.db.delete("houseKeys", item._id);
      }
      await ctx.db.insert("houseKeys", {
        houseId: membership.houseId,
        key: generateHouseKey(),
        label: args.label?.trim() || target.label,
        expiresAt: NEVER_EXPIRES_AT,
        createdAt: Date.now(),
        createdBy: userId,
      });
      return { ok: true };
    }

    await ctx.db.patch("houseKeys", args.id, {
      label: args.label?.trim() || undefined,
      expiresAt: NEVER_EXPIRES_AT,
    });

    return { ok: true };
  },
});

export const deleteHouseKey = mutation({
  args: {
    id: v.id("houseKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Admin must be the house owner");
    }

    const target = await ctx.db.get("houseKeys", args.id);
    if (!target || target.houseId !== membership.houseId) {
      throw new ConvexError("Key not found");
    }

    await ctx.db.delete("houseKeys", args.id);
    return { ok: true };
  },
});

export const renameCurrentHouse = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Admin must be the house owner");
    }

    await ctx.db.patch("houses", membership.houseId, {
      name: args.name.trim(),
    });
    return { ok: true };
  },
});

export const deleteCurrentHouse = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await requireAdminUser(ctx, userId);
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Admin must be the house owner");
    }

    const houseId = membership.houseId;

    const keys = await ctx.db
      .query("houseKeys")
      .withIndex("by_house", (q) => q.eq("houseId", houseId))
      .collect();
    for (const key of keys) {
      await ctx.db.delete("houseKeys", key._id);
    }

    const members = await ctx.db
      .query("houseMembers")
      .withIndex("by_house", (q) => q.eq("houseId", houseId))
      .collect();
    for (const member of members) {
      await ctx.db.delete("houseMembers", member._id);
    }

    const commands = await ctx.db
      .query("commands")
      .withIndex("by_house_createdAt", (q) => q.eq("houseId", houseId))
      .collect();
    for (const command of commands) {
      await ctx.db.delete("commands", command._id);
    }

    const deviceState = await ctx.db.query("deviceState").first();
    if (deviceState && deviceState.houseId === houseId) {
      await ctx.db.patch("deviceState", deviceState._id, { houseId: undefined });
    }

    await ctx.db.delete("houses", houseId);
    return { ok: true };
  },
});
