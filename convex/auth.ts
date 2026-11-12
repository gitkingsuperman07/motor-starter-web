import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name =
          typeof params.name === "string" ? params.name.trim() : undefined;
        const phone =
          typeof params.phone === "string" ? params.phone.trim() : undefined;

        return {
          email,
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
        };
      },
    }),
  ],
});
