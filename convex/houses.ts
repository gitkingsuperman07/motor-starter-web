import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

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

    return {
      user: {
        id: userId,
        name: user?.name ?? null,
        phone: user?.phone ?? null,
        email: user?.email ?? null,
      },
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
    const existingMembership = await getMembership(ctx, userId);
    if (existingMembership) {
      throw new ConvexError("You already belong to a house");
    }

    const now = Date.now();
    const houseId = await ctx.db.insert("houses", {
      name: args.name.trim(),
      ownerId: userId,
      createdAt: now,
    });

    await ctx.db.insert("houseMembers", {
      houseId,
      userId,
      role: "owner",
      createdAt: now,
    });

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

    if (!invite || invite.expiresAt < now) {
      throw new ConvexError("Invalid or expired house key");
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
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Only the house owner can create keys");
    }

    const now = Date.now();
    const key = generateHouseKey();
    const id = await ctx.db.insert("houseKeys", {
      houseId: membership.houseId,
      key,
      label: args.label?.trim() || undefined,
      expiresAt: now + KEY_TTL_MS,
      createdAt: now,
      createdBy: userId,
    });

    return { id, key, expiresAt: now + KEY_TTL_MS };
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
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Only the house owner can edit keys");
    }

    const target = await ctx.db.get("houseKeys", args.id);
    if (!target || target.houseId !== membership.houseId) {
      throw new ConvexError("Key not found");
    }

    await ctx.db.patch("houseKeys", args.id, {
      label: args.label?.trim() || undefined,
      key: args.regenerate ? generateHouseKey() : target.key,
      expiresAt: Date.now() + KEY_TTL_MS,
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
    const membership = await getMembership(ctx, userId);
    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Only the house owner can delete keys");
    }

    const target = await ctx.db.get("houseKeys", args.id);
    if (!target || target.houseId !== membership.houseId) {
      throw new ConvexError("Key not found");
    }

    await ctx.db.delete("houseKeys", args.id);
    return { ok: true };
  },
});
