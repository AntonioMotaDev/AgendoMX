import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { limitAuthRequest } from "@/lib/rate-limit";

// The auth instance depends on the request's bindings, so build it per call.
const handler = toNextJsHandler(async (request: Request) => {
  const limited = await limitAuthRequest(request);
  if (limited) return limited;
  return (await getAuth()).handler(request);
});

export const { GET, POST } = handler;
