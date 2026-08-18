export type OutputFormat = "png" | "jpeg" | "webp";

export type InputImage = {
  id: string;
  name: string;
  url: string;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type ParameterSpec =
  | { type: "enum"; values: string[] }
  | { type: "range"; min: number; max: number }
  | { type: "boolean" };

export type SupportedParameters = Record<string, ParameterSpec>;

export type ImageModel = {
  id: string;
  name: string;
  description?: string;
  created?: number;
  supported_parameters: SupportedParameters;
  supports_streaming?: boolean;
};

export type ImageModelEndpoint = {
  provider_name: string;
  provider_tag: string;
  supported_parameters: SupportedParameters;
  supports_streaming?: boolean;
};

export type ProviderPreference = {
  providerTag: string | null;
  allowFallbacks: boolean;
};

export type GenerationUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** Credits charged by OpenRouter (for BYOK requests this is only the fee). */
  costUsd: number | null;
  /** Actual upstream provider cost for BYOK requests. */
  upstreamCostUsd: number | null;
};

/** Total spend for a request: OpenRouter credits plus BYOK upstream cost. */
export function totalUsageCostUsd(usage: GenerationUsage | null | undefined): number | null {
  if (!usage) {
    return null;
  }

  const cost = usage.costUsd ?? 0;
  const upstream = usage.upstreamCostUsd ?? 0;
  if (usage.costUsd === null && usage.upstreamCostUsd === null) {
    return null;
  }

  return cost + upstream;
}

function parseNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeUsage(payload: unknown): GenerationUsage | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const usage = payload as {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
    cost?: unknown;
    cost_details?: { upstream_inference_cost?: unknown } | null;
  };

  return {
    promptTokens: parseNullableNumber(usage.prompt_tokens),
    completionTokens: parseNullableNumber(usage.completion_tokens),
    totalTokens: parseNullableNumber(usage.total_tokens),
    costUsd: parseNullableNumber(usage.cost),
    upstreamCostUsd: parseNullableNumber(usage.cost_details?.upstream_inference_cost),
  };
}

export function combineUsages(usages: Array<GenerationUsage | null>): GenerationUsage | null {
  const present = usages.filter((usage): usage is GenerationUsage => usage !== null);
  if (present.length === 0) {
    return null;
  }

  const sumNullable = (selector: (usage: GenerationUsage) => number | null) => {
    let sawValue = false;
    const total = present.reduce((sum, usage) => {
      const value = selector(usage);
      if (value === null) {
        return sum;
      }
      sawValue = true;
      return sum + value;
    }, 0);
    return sawValue ? total : null;
  };

  return {
    promptTokens: sumNullable((usage) => usage.promptTokens),
    completionTokens: sumNullable((usage) => usage.completionTokens),
    totalTokens: sumNullable((usage) => usage.totalTokens),
    costUsd: sumNullable((usage) => usage.costUsd),
    upstreamCostUsd: sumNullable((usage) => usage.upstreamCostUsd),
  };
}

function isParameterSpec(value: unknown): value is ParameterSpec {
  if (!value || typeof value !== "object") {
    return false;
  }

  const spec = value as { type?: unknown; values?: unknown; min?: unknown; max?: unknown };
  if (spec.type === "enum") {
    return Array.isArray(spec.values);
  }
  if (spec.type === "range") {
    return typeof spec.min === "number" && typeof spec.max === "number";
  }
  return spec.type === "boolean";
}

function normalizeSupportedParameters(value: unknown): SupportedParameters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const parameters: SupportedParameters = {};
  for (const [key, spec] of Object.entries(value as Record<string, unknown>)) {
    if (isParameterSpec(spec)) {
      parameters[key] = spec;
    }
  }
  return parameters;
}

export function getEnumValues(
  parameters: SupportedParameters | undefined,
  key: string,
): string[] | null {
  const spec = parameters?.[key];
  if (spec?.type !== "enum") {
    return null;
  }

  return spec.values.filter((value): value is string => typeof value === "string");
}

export function getRangeMax(
  parameters: SupportedParameters | undefined,
  key: string,
  fallback: number,
): number {
  const spec = parameters?.[key];
  if (spec?.type !== "range") {
    return fallback;
  }

  return Math.max(0, Math.round(spec.max));
}

export function isValidModelId(value: string): boolean {
  return /^[\w.\-]+\/[\w.\-:]+$/.test(value);
}

export async function fetchImageModels(): Promise<ImageModel[]> {
  const response = await fetch("/api/openrouter/models", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load the OpenRouter model catalog (${response.status}).`);
  }

  const json = (await response.json()) as { data?: unknown };
  if (!Array.isArray(json.data)) {
    throw new Error("Unexpected OpenRouter model catalog response.");
  }

  return json.data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.id === "string" && isValidModelId(item.id))
    .map((item) => ({
      id: item.id as string,
      name: typeof item.name === "string" && item.name.trim() ? item.name : (item.id as string),
      description: typeof item.description === "string" ? item.description : undefined,
      created: typeof item.created === "number" ? item.created : undefined,
      supported_parameters: normalizeSupportedParameters(item.supported_parameters),
      supports_streaming: item.supports_streaming === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchModelEndpoints(modelId: string): Promise<ImageModelEndpoint[]> {
  const response = await fetch(
    `/api/openrouter/models/endpoints?model=${encodeURIComponent(modelId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Unable to load providers for ${modelId} (${response.status}).`);
  }

  const json = (await response.json()) as { endpoints?: unknown };
  if (!Array.isArray(json.endpoints)) {
    return [];
  }

  return json.endpoints
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.provider_tag === "string" && item.provider_tag.length > 0)
    .map((item) => ({
      provider_name:
        typeof item.provider_name === "string" && item.provider_name.trim()
          ? item.provider_name
          : (item.provider_tag as string),
      provider_tag: item.provider_tag as string,
      supported_parameters: normalizeSupportedParameters(item.supported_parameters),
      supports_streaming: item.supports_streaming === true,
    }));
}
