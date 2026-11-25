import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Until the marketing landing exists, "/" just sends people where they belong:
 * signed in -> the panel (which itself continues to onboarding if needed),
 * signed out -> login. If the session lookup fails we fall back to login
 * rather than showing an error on the front door.
 */
export default async function Home() {
  let signedIn = false;
  try {
    signedIn = (await getSession()) !== null;
  } catch (error) {
    console.error("home session check failed", error instanceof Error ? error.message : "unknown error");
  }
  redirect(signedIn ? "/app" : "/login");
}
