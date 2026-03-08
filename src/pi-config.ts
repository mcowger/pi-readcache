import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// Configuration constants following Pi standards
const CONFIG_DIR_NAME = ".pi";
const ENV_AGENT_DIR = "PI_CODING_AGENT_DIR";

/**
 * Returns the standard agent config directory (~/.pi/agent/).
 */
export function getAgentDir(): string {
	const envDir = process.env[ENV_AGENT_DIR];
	if (envDir) {
		if (envDir === "~") return homedir();
		if (envDir.startsWith("~/")) return homedir() + envDir.slice(1);
		return envDir;
	}
	return join(homedir(), CONFIG_DIR_NAME, "agent");
}

/**
 * Returns the standard path to settings.json (~/.pi/agent/settings.json).
 */
export function getSettingsPath(): string {
	return join(getAgentDir(), "settings.json");
}

/**
 * Reads the settings.json file and returns the 'readcacheDir' key,
 * defaulting to the standard local cache path if not set.
 */
export async function getReadcacheCacheDir(): Promise<string> {
	const defaultDir = ".pi/readcache";
	try {
		const content = await readFile(getSettingsPath(), "utf-8");
		const settings = JSON.parse(content);
		return settings.readcacheDir || defaultDir;
	} catch {
		return defaultDir;
	}
}
