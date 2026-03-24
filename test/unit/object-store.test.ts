import { mkdtemp, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	getStoreStats,
	hashText,
	loadObject,
	objectPathForHash,
	persistObjectIfAbsent,
	pruneObjectsOlderThan,
} from "../../src/object-store.js";

vi.mock("../../src/constants.js", () => {
	return {
		READCACHE_META_VERSION: 1,
		READCACHE_CUSTOM_TYPE: "pi-readcache",
		SCOPE_FULL: "full",
		MAX_DIFF_FILE_BYTES: 2 * 1024 * 1024,
		MAX_DIFF_FILE_LINES: 12_000,
		MAX_DIFF_TO_BASE_RATIO: 0.9,
		MAX_DIFF_TO_BASE_LINE_RATIO: 0.85,
		DEFAULT_EXCLUDED_PATH_PATTERNS: [],
		READCACHE_ROOT_DIR: ".pi/readcache",
		READCACHE_OBJECT_MAX_AGE_MS: 24 * 60 * 60 * 1000,
		scopeRange: (start: number, end: number) => `r:${start}:${end}`,
	};
});

const TEST_CACHE_ROOT = ".pi/readcache";

describe("object-store", () => {
	it("persists and loads content by hash", async () => {
		const repoRoot = await mkdtemp(join(tmpdir(), "pi-readcache-store-"));
		const text = "hello object store";
		const hash = hashText(text);

		const objectsDir = join(repoRoot, TEST_CACHE_ROOT, "objects");
		const tmpDir = join(repoRoot, TEST_CACHE_ROOT, "tmp");

		const persisted = await persistObjectIfAbsent(repoRoot, hash, text);
		expect(persisted.written).toBe(true);
		expect(persisted.path).toBe(join(objectsDir, `sha256-${hash}.txt`));

		const loaded = await loadObject(repoRoot, hash);
		expect(loaded).toBe(text);

		const persistedAgain = await persistObjectIfAbsent(repoRoot, hash, text);
		expect(persistedAgain.written).toBe(false);
	});

	it("handles parallel writes of identical hashes safely", async () => {
		const repoRoot = await mkdtemp(join(tmpdir(), "pi-readcache-store-"));
		const text = "same text across concurrent writers";
		const hash = hashText(text);

		const writes = await Promise.all(
			Array.from({ length: 20 }, () => persistObjectIfAbsent(repoRoot, hash, text)),
		);

		expect(writes.some((result) => result.written)).toBe(true);
		expect(await loadObject(repoRoot, hash)).toBe(text);
	});

	it("reports object store stats", async () => {
		const repoRoot = await mkdtemp(join(tmpdir(), "pi-readcache-store-"));
		const one = "alpha";
		const two = "beta";

		await persistObjectIfAbsent(repoRoot, hashText(one), one);
		await persistObjectIfAbsent(repoRoot, hashText(two), two);

		const stats = await getStoreStats(repoRoot);
		expect(stats.objects).toBe(2);
		expect(stats.bytes).toBeGreaterThan(0);
	});

	it("prunes object files older than max age", async () => {
		const repoRoot = await mkdtemp(join(tmpdir(), "pi-readcache-store-"));
		const freshText = "fresh";
		const staleText = "stale";
		const freshHash = hashText(freshText);
		const staleHash = hashText(staleText);

		await persistObjectIfAbsent(repoRoot, freshHash, freshText);
		await persistObjectIfAbsent(repoRoot, staleHash, staleText);

		const stalePath = objectPathForHash(repoRoot, staleHash);
		const nowMs = Date.now();
		const staleMs = nowMs - 25 * 60 * 60 * 1000;
		await utimes(stalePath, staleMs / 1000, staleMs / 1000);

		const result = await pruneObjectsOlderThan(repoRoot, 24 * 60 * 60 * 1000, nowMs);
		expect(result.scanned).toBe(2);
		expect(result.deleted).toBe(1);
		expect(await loadObject(repoRoot, staleHash)).toBeUndefined();
		expect(await loadObject(repoRoot, freshHash)).toBe(freshText);
		await expect(stat(stalePath)).rejects.toMatchObject({ code: "ENOENT" });
	});
});