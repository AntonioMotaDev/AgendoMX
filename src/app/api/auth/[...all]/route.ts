import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// The auth instance depends on the request's bindings, so build it per call.
const handler = toNextJsHandler(async (request: Request) => (await getAuth()).handler(request));

export const { GET, POST } = handler;
