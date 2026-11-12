import { ConvexError, v } from "convex/values";
import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function readEnv(name: string) {
  const processEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return processEnv?.[name];
}

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db.get("users", userId);
  const adminEmail = readEnv("ADMIN_EMAIL")?.trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();

  if (!adminEmail) {
    throw new ConvexError("ADMIN_EMAIL is not configured");
  }

  if (!userEmail || userEmail !== adminEmail) {
    throw new ConvexError("Only admin can manage users");
  }

  return { userId, user };
}

export const currentAdminState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { isAdmin: false };
    }
    const user = await ctx.db.get("users", userId);
    const adminEmail = readEnv("ADMIN_EMAIL")?.trim().toLowerCase();
    return {
      isAdmin:
        !!adminEmail && user?.email?.trim().toLowerCase() === adminEmail,
    };
  },
});

export const resolveLoginEmail = query({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const value = args.identifier.trim();
    if (!value) {
      return "";
    }

    if (value.includes("@")) {
      return value.toLowerCase();
    }

    const users = await ctx.db.query("users").collect();
    const match = users.find(
      (user) => user.name?.trim().toLowerCase() === value.toLowerCase(),
    );

    return match?.email?.trim().toLowerCase() ?? value.toLowerCase();
  },
});

export const loginIdentifierExists = query({
  args: {
    identifier: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const value = args.identifier.trim().toLowerCase();
    if (!value) {
      return false;
    }

    if (value.includes("@")) {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", value),
        )
        .first();
      return account !== null;
    }

    const users = await ctx.db.query("users").take(200);
    return users.some(
      (user) => user.name?.trim().toLowerCase() === value && !!user.email,
    );
  },
});

export const bootstrapAdmin = action({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminEmail = readEnv("ADMIN_EMAIL")?.trim().toLowerCase();
    const email = (args.email ?? "thorragnar.hulk@gmail.com").trim().toLowerCase();
    const password = args.password ?? "password123";

    if (!adminEmail) {
      throw new ConvexError("ADMIN_EMAIL is not configured");
    }
    if (email !== adminEmail) {
      throw new ConvexError("Email must match ADMIN_EMAIL");
    }

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: {
        id: email,
        secret: password,
      },
      profile: {
        email,
        ...(args.name?.trim() ? { name: args.name.trim() } : {}),
        ...(args.phone?.trim() ? { phone: args.phone.trim() } : {}),
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    return { ok: true, alreadyExists: false, userId: user._id };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").order("desc").collect();
    const accounts = await ctx.db.query("authAccounts").collect();

    return users
      .map((user) => {
        const account = accounts.find(
          (item) => item.userId === user._id && item.provider === "password",
        );

        return {
          id: user._id,
          name: user.name ?? "",
          email: user.email ?? account?.providerAccountId ?? "",
          phone: user.phone ?? "",
          hasPassword: !!account,
          knownPassword: user.knownPassword ?? "",
          createdAt: user._creationTime,
        };
      })
      .filter((user) => user.hasPassword);
  },
});

export const createUser = action({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const adminState = await ctx.runQuery(api.adminUsers.currentAdminState, {});
    if (!adminState.isAdmin) {
      throw new ConvexError("Only admin can manage users");
    }

    const email = args.email.trim().toLowerCase();
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: {
        id: email,
        secret: args.password,
      },
      profile: {
        email,
        ...(args.name.trim() ? { name: args.name.trim() } : {}),
        ...(args.phone.trim() ? { phone: args.phone.trim() } : {}),
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    await ctx.runMutation(internal.adminUsers.saveKnownPassword, {
      userId: user._id,
      password: args.password,
    });

    return { userId: user._id };
  },
});

export const ownAccount = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      email: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get("users", userId);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "password"),
      )
      .first();
    const email = user?.email ?? account?.providerAccountId ?? "";
    if (!email) {
      return null;
    }

    return { userId, email };
  },
});

export const saveKnownPassword = internalMutation({
  args: {
    userId: v.id("users"),
    password: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const password = args.password.trim();
    if (!password) {
      throw new ConvexError("Password is required");
    }
    await ctx.db.patch("users", args.userId, { knownPassword: password });
    return null;
  },
});

export const updateOwnName = mutation({
  args: {
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Name is required");
    }
    await ctx.db.patch("users", userId, { name });
    return null;
  },
});

export const resetOwnPassword = action({
  args: {
    newPassword: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const password = args.newPassword.trim();
    if (!password) {
      throw new ConvexError("Password is required");
    }

    const account: { userId: Id<"users">; email: string } | null = await ctx.runQuery(
      internal.adminUsers.ownAccount,
      {},
    );
    if (!account) {
      throw new ConvexError("Not authenticated");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: account.email,
        secret: password,
      },
    });
    await ctx.runMutation(internal.adminUsers.saveKnownPassword, {
      userId: account.userId,
      password,
    });

    return { ok: true };
  },
});

export const updateUserData = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.userId).eq("provider", "password"),
      )
      .first();

    if (!account) {
      throw new ConvexError("Password account not found");
    }

    if (args.email) {
      const nextEmail = args.email.trim().toLowerCase();
      const duplicate = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", nextEmail),
        )
        .first();

      if (duplicate && duplicate._id !== account._id) {
        throw new ConvexError("Email already in use");
      }

      await ctx.db.patch("users", args.userId, { email: nextEmail });
      await ctx.db.patch("authAccounts", account._id, {
        providerAccountId: nextEmail,
      });
    }

    await ctx.db.patch("users", args.userId, {
      name: args.name?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
    });

    return {
      ok: true,
      accountEmail: args.email?.trim().toLowerCase() ?? account.providerAccountId,
    };
  },
});

export const updateUser = action({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    newPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminState = await ctx.runQuery(api.adminUsers.currentAdminState, {});
    if (!adminState.isAdmin) {
      throw new ConvexError("Only admin can manage users");
    }

    const updateResult = await ctx.runMutation(api.adminUsers.updateUserData, {
      userId: args.userId,
      name: args.name,
      phone: args.phone,
      email: args.email,
    });

    if (args.newPassword) {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: {
          id: updateResult.accountEmail,
          secret: args.newPassword,
        },
      });
      await ctx.runMutation(internal.adminUsers.saveKnownPassword, {
        userId: args.userId,
        password: args.newPassword,
      });
    }

    return { ok: true };
  },
});

export const deleteUserData = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId: adminUserId } = await requireAdmin(ctx);

    if (adminUserId === args.userId) {
      throw new ConvexError("Admin account cannot be deleted");
    }

    const targetUser = await ctx.db.get("users", args.userId);
    if (!targetUser) {
      throw new ConvexError("User not found");
    }

    const ownedHouses = await ctx.db
      .query("houses")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();

    if (ownedHouses.length > 0) {
      throw new ConvexError("Cannot delete a house owner");
    }

    const memberships = await ctx.db
      .query("houseMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const membership of memberships) {
      await ctx.db.delete("houseMembers", membership._id);
    }

    const accounts = await ctx.db.query("authAccounts").collect();
    for (const account of accounts) {
      if (account.userId === args.userId) {
        await ctx.db.delete("authAccounts", account._id);
      }
    }

    await ctx.db.delete("users", args.userId);
    return { ok: true };
  },
});

export const deleteUser = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminState = await ctx.runQuery(api.adminUsers.currentAdminState, {});
    if (!adminState.isAdmin) {
      throw new ConvexError("Only admin can manage users");
    }

    await ctx.runMutation(api.adminUsers.deleteUserData, {
      userId: args.userId,
    });

    return { ok: true };
  },
});
