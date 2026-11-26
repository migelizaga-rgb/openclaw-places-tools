/** Narrow structural shape consumed by the OpenClaw plugin tool registry. */
export interface AnyAgentTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: unknown,
  ) => Promise<{ content: Array<{ type: "text"; text: string }>; details?: unknown }>;
}

export interface OpenClawPluginApi {
  registerTool(factory: () => AnyAgentTool): void;
}

export function getApiKey(): string {
  const key = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY environment variable is not set");
  return key;
}

export const PLACES_BASE_URL = "https://places.googleapis.com/v1";
