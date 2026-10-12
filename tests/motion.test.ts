import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTION_MS } from "../src/lib/motion";

describe("motion tokens", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  for (const [name, ms] of Object.entries(MOTION_MS)) {
    it(`--dur-${name} in globals.css matches MOTION_MS.${name}`, () => {
      const m = css.match(new RegExp(`--dur-${name}:\\s*(\\d+)ms`));
      expect(m, `--dur-${name} missing`).not.toBeNull();
      expect(Number(m![1])).toBe(ms);
    });
  }
});
