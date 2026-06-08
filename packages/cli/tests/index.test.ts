import { mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { isEntrypoint } from "../src/index.js";

describe("isEntrypoint", () => {
  test("recognizes a symlink to the CLI entry module", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "docrunner-bin-"));
    const link = join(cwd, "docrunner");
    const source = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    await symlink(source, link);

    expect(isEntrypoint(link)).toBe(true);
  });

  test("rejects absent and unrelated entrypoints", () => {
    expect(isEntrypoint(undefined)).toBe(false);
    expect(isEntrypoint(import.meta.filename)).toBe(false);
  });
});
