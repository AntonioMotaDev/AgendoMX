import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/backup/retention.sh");
const NOW = Date.parse("2026-12-31T12:00:00Z") / 1000;

function expired(keys: string[], env: Record<string, string> = {}): string[] {
  const out = execFileSync("bash", [script], { input: keys.join("\n") + "\n", env: { ...process.env, NOW: String(NOW), ...env }, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

/** One backup per day for the last `days` days, newest first. */
function daily(days: number, env = "production"): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date((NOW - i * 86400) * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    return `${env}/agendomx-${env}-${d.slice(0, 8)}T081700Z.dump`;
  });
}

describe("backup retention", () => {
  it("expires nothing while the history is short", () => {
    expect(expired(daily(20))).toEqual([]);
    expect(expired(daily(7), { KEEP_DAYS: "1" })).toEqual([]);
  });

  it("expires only backups older than KEEP_DAYS", () => {
    const keys = daily(40);
    const out = expired(keys);
    expect(out.length).toBeGreaterThan(0);
    for (const key of out) {
      const day = key.match(/(\d{8})T/)![1]!;
      const age = (NOW - Date.parse(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00Z`) / 1000) / 86400;
      expect(age).toBeGreaterThan(29);
    }
    // The newest 30 days survive.
    for (const key of keys.slice(0, 30)) expect(out).not.toContain(key);
  });

  it("always keeps the newest MIN_KEEP, however old they are", () => {
    // Backups stopped a year ago: everything is "old", but the last 7 must stay.
    const oldKeys = Array.from({ length: 12 }, (_, i) => `production/agendomx-production-202501${String(i + 1).padStart(2, "0")}T081700Z.dump`);
    const out = expired(oldKeys);
    expect(out).toHaveLength(5);
    for (const kept of oldKeys.slice(-7)) expect(out).not.toContain(kept);
  });

  it("ignores keys that are not backups (manifests, other files, odd names)", () => {
    const junk = [
      "production/agendomx-production-20250101T081700Z.json",
      "production/notes.txt",
      "production/agendomx-production-20250101.dump",
      "agendomx-production-20250101T081700Z.dump",
      "production/AGENDOMX-production-20250101T081700Z.dump",
      "../production/agendomx-production-20250101T081700Z.dump",
    ];
    expect(expired([...junk, ...daily(40)]).every((k) => !junk.includes(k))).toBe(true);
    expect(expired(junk)).toEqual([]);
  });

  it("counts each environment's prefix independently only through the keys it is given", () => {
    const prod = daily(40, "production");
    const out = expired([...prod, ...daily(3, "staging")]);
    expect(out.every((k) => k.startsWith("production/"))).toBe(true);
  });

  it("honors custom KEEP_DAYS and MIN_KEEP", () => {
    const out = expired(daily(10), { KEEP_DAYS: "3", MIN_KEEP: "2" });
    // Cutoff is Dec 28 12:00; the backups are made at 08:17, so Dec 31, 30 and 29 stay and the other 7 expire.
    expect(out).toHaveLength(7);
  });
});
