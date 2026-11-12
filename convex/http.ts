import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

function readEnv(name: string) {
	const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	return processEnv?.[name];
}

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
	path: "/device/poll",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const token = readEnv("DEVICE_TOKEN") ?? "";
		const headerToken = request.headers.get("x-device-token") ?? "";

		if (!token || headerToken !== token) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "content-type": "application/json" },
			});
		}

		let payload: { ackId?: string; amps?: number };
		try {
			const parsed = await request.json();
			payload = {
				ackId: typeof parsed?.ackId === "string" ? parsed.ackId : undefined,
				amps: typeof parsed?.amps === "number" ? parsed.amps : undefined,
			};
		} catch {
			return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}

		const result = await ctx.runMutation(internal.commands.devicePoll, payload);

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}),
});

export default http;
