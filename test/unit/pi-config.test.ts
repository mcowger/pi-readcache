import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getReadcacheCacheDir } from "../../src/pi-config.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

vi.mock("node:fs/promises");

describe("getReadcacheCacheDir", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		vi.resetAllMocks();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns default path when settings.json does not exist", async () => {
		vi.mocked(readFile).mockRejectedValue(new Error("File not found"));
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe(".pi/readcache");
	});

	it("returns default path when readcacheDir is missing in settings", async () => {
		vi.mocked(readFile).mockResolvedValue("{}");
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe(".pi/readcache");
	});

	it("returns custom path from settings.json", async () => {
		vi.mocked(readFile).mockResolvedValue(JSON.stringify({ readcacheDir: "/tmp/custom-cache" }));
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("/tmp/custom-cache");
	});

	it("respects PI_CODING_AGENT_DIR override for settings location", async () => {
		process.env.PI_CODING_AGENT_DIR = "/custom/agent";
		vi.mocked(readFile).mockImplementation(async (path: string) => {
			if (path === join("/custom/agent", "settings.json")) {
				return JSON.stringify({ readcacheDir: "/env/cache" });
			}
			throw new Error("File not found");
		});

		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("/env/cache");
	});
});
