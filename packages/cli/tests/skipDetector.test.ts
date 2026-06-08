import { describe, expect, test } from "vitest";
import { detectSkipReason } from "../src/parser/skipDetector.js";

describe("detectSkipReason", () => {
  test.each([
    ['client = Client("YOUR_API_KEY")', "placeholder pattern"],
    ["first()\n...\nlast()", "placeholder ellipsis"],
    ["# TODO", "incomplete TODO"],
    ["$ npm install\n$ npm test", "shell transcript"],
    ["> successful output", "output transcript"],
    ["https://example.com/docs", "single URL"],
    ["#!/usr/bin/env zsh\necho zsh", "unsupported shebang"],
  ])("skips %s", (code, reason) => {
    expect(detectSkipReason(code)).toContain(reason);
  });

  test("uses configured literal patterns before built-in heuristics", () => {
    expect(detectSkipReason("call LIVE_SERVICE", ["LIVE_SERVICE"])).toBe(
      "configured skip pattern `LIVE_SERVICE`",
    );
  });

  test("does not skip runnable scripts or allowed shebangs", () => {
    expect(detectSkipReason("echo https://example.com")).toBeNull();
    expect(detectSkipReason("#!/bin/bash\necho ready")).toBeNull();
    expect(
      detectSkipReason("#!/usr/bin/env python\nprint('ready')"),
    ).toBeNull();
  });
});
