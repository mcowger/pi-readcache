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

	it("expands environment variables with $VAR syntax", async () => {
		process.env.TMPDIR = "/tmp/testdir";
		vi.mocked(readFile).mockResolvedValue(JSON.stringify({ readcacheDir: "$TMPDIR/pi-readcache" }));
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("/tmp/testdir/pi-readcache");
	});

	it("expands environment variables with ${VAR} syntax", async () => {
		process.env.TMPDIR = "/tmp/testdir";
		vi.mocked(readFile).mockResolvedValue(JSON.stringify({ readcacheDir: "${TMPDIR}/pi-readcache" }));
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("/tmp/testdir/pi-readcache");
	});

	it("leaves undefined environment variables unchanged", async () => {
		delete process.env.UNDEFINED_VAR;
		vi.mocked(readFile).mockResolvedValue(JSON.stringify({ readcacheDir: "$UNDEFINED_VAR/cache" }));
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("$UNDEFINED_VAR/cache");
	});

	it("expands multiple environment variables in path", async () => {
		process.env.HOME = "/Users/testuser";
		process.env.CACHE_SUBDIR = "mycache";
		vi.mocked(readFile).mockResolvedValue(
			JSON.stringify({ readcacheDir: "$HOME/.cache/$CACHE_SUBDIR" }),
		);
		const dir = await getReadcacheCacheDir();
		expect(dir).toBe("/Users/testuser/.cache/mycache");
	});
});
