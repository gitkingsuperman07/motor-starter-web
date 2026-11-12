import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  commands: defineTable({
    houseId: v.optional(v.id("houses")),
    type: v.union(v.literal("START"), v.literal("STOP")),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("acked"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    sentAt: v.optional(v.number()),
    ackedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_house_createdAt", ["houseId", "createdAt"]),
  deviceState: defineTable({
    houseId: v.optional(v.id("houses")),
    lastSeenAt: v.number(),
    fastUntil: v.number(),
    amps: v.number(),
    running: v.boolean(),
    lastReadingAt: v.number(),
    lowAmpStreak: v.number(),
  }),
  readings: defineTable({
    at: v.number(),
    amps: v.number(),
  }).index("by_at", ["at"]),
  houses: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),
  houseMembers: defineTable({
    houseId: v.id("houses"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_house", ["houseId"])
    .index("by_house_user", ["houseId", "userId"]),
  houseKeys: defineTable({
    houseId: v.id("houses"),
    key: v.string(),
    label: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_house", ["houseId"])
    .index("by_key", ["key"]),
});
