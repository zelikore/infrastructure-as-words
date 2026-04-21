import type { GenerationSettings, ModuleVisibility } from "@infrastructure-as-words/contracts";
import { normalizeDiagram } from "./diagram-normalizer.js";
import {
  generationDraftSchema,
  type GeneratedFile,
  type GenerationDraft
} from "./generation-schema.js";
import {
  asRecord,
  combineText,
  defaultFileContent,
  defaultModuleReason,
  readText,
  readTextFromKeys,
  titleize,
  toSlug,
  trimToLength
} from "./generation-normalizer-shared.js";

const normalizeName = (value: unknown): string => {
  const name = readText(value) ?? "generated-aws-platform";
  return name.includes(" ") ? trimToLength(name, 120) : trimToLength(titleize(name), 120);
};

const normalizeSummary = (value: unknown): string =>
  trimToLength(readText(value) ?? "Generated AWS platform starter.", 320);

const normalizeExplanation = (value: unknown): GenerationDraft["explanation"] => {
  if (!Array.isArray(value)) {
    return [
      {
        title: "Overview",
        detail: "Generated Terraform starter with architecture notes and delivery artifacts."
      }
    ];
  }

  const items = value
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          title: `Layer ${index + 1}`,
          detail: trimToLength(entry, 400)
        };
      }

      const record = asRecord(entry);
      return {
        title: trimToLength(
          readTextFromKeys(record, ["title", "label", "heading", "name"]) ?? `Layer ${index + 1}`,
          80
        ),
        detail: trimToLength(
          readTextFromKeys(record, ["detail", "description", "body", "summary", "text", "reason"]) ??
            "Generated infrastructure component.",
          400
        )
      };
    })
    .filter((entry) => entry.detail.length > 0)
    .slice(0, 8);

  return items.length > 0
    ? items
    : [
        {
          title: "Overview",
          detail: "Generated Terraform starter with architecture notes and delivery artifacts."
        }
      ];
};

const normalizeLimitations = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return ["Generated infrastructure still needs human review before apply."];
  }

  const items = value
    .map((entry) => {
      if (typeof entry === "string") {
        return trimToLength(entry, 320);
      }

      const record = asRecord(entry);
      return combineText(
        readTextFromKeys(record, ["title", "label", "heading"]),
        readTextFromKeys(record, ["detail", "description", "body", "text"]),
        320
      );
    })
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .slice(0, 8);

  return items.length > 0
    ? items
    : ["Generated infrastructure still needs human review before apply."];
};

const normalizeVisibility = (
  value: string | undefined,
  fallback: ModuleVisibility
): ModuleVisibility => {
  if (value === "private" || value === "public") {
    return value;
  }

  return fallback;
};

const normalizeModules = (
  value: unknown,
  settings: GenerationSettings
): GenerationDraft["modules"] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const catalogBySource = new Map(
    settings.modules.map((module) => [module.source.toLowerCase(), module])
  );
  const catalogById = new Map(
    settings.modules.map((module) => [module.moduleId.toLowerCase(), module])
  );
  const seen = new Set<string>();

  return value
    .map((entry) => {
      const record = asRecord(entry);
      const rawSource = readTextFromKeys(record, [
        "source",
        "moduleSource",
        "registry",
        "registrySource",
        "terraformSource"
      ]);
      const rawId = readTextFromKeys(record, ["moduleId", "id", "name", "module"]);
      const catalogMatch = rawSource
        ? catalogBySource.get(rawSource.toLowerCase())
        : rawId
          ? catalogById.get(rawId.toLowerCase())
          : undefined;
      const source = trimToLength(rawSource ?? catalogMatch?.source ?? "", 240);
      if (!source) {
        return undefined;
      }

      const generatedModuleId = toSlug(source).slice(0, 64);
      const moduleId = trimToLength(
        rawId ?? catalogMatch?.moduleId ?? (generatedModuleId || "terraform-module"),
        64
      );
      const dedupeKey = `${moduleId}:${source}`;
      if (seen.has(dedupeKey)) {
        return undefined;
      }

      seen.add(dedupeKey);
      const version = readTextFromKeys(record, ["version", "moduleVersion"]);
      return {
        moduleId,
        label: trimToLength(
          readTextFromKeys(record, ["label", "title", "name"]) ??
            catalogMatch?.label ??
            titleize(moduleId),
          80
        ),
        source,
        visibility: normalizeVisibility(
          readTextFromKeys(record, ["visibility", "scope"]),
          catalogMatch?.visibility ?? "public"
        ),
        reason: trimToLength(
          readTextFromKeys(record, ["reason", "why", "rationale", "detail", "description"]) ??
            (catalogMatch
              ? `Matched prioritized module catalog entry ${catalogMatch.label}.`
              : version
                ? `Selected module source ${source} at version ${version}.`
                : defaultModuleReason),
          320
        )
      };
    })
    .filter((entry): entry is GenerationDraft["modules"][number] => entry !== undefined)
    .slice(0, 12);
};

const enforceRequiredModules = (
  modules: GenerationDraft["modules"],
  settings: GenerationSettings
): GenerationDraft["modules"] => {
  const enforced = [...modules];
  const seen = new Set(enforced.map((module) => `${module.moduleId}:${module.source}`));

  for (const requiredModule of settings.modules) {
    if (!requiredModule.required) {
      continue;
    }

    const key = `${requiredModule.moduleId}:${requiredModule.source}`;
    if (seen.has(key)) {
      continue;
    }

    enforced.unshift({
      moduleId: requiredModule.moduleId,
      label: requiredModule.label,
      source: requiredModule.source,
      visibility: requiredModule.visibility,
      reason: trimToLength(
        `Required by organization policy. ${requiredModule.documentation.summary}`,
        320
      )
    });
    seen.add(key);
  }

  return enforced.slice(0, 12);
};

const detectFileLanguage = (
  path: string,
  value: string | undefined
): GeneratedFile["language"] => {
  const normalized = value?.toLowerCase();
  if (normalized === "markdown" || normalized === "md") {
    return "md";
  }
  if (normalized === "terraform" || normalized === "hcl" || normalized === "tf") {
    return "hcl";
  }
  if (normalized === "yaml" || normalized === "yml") {
    return "yaml";
  }
  if (normalized === "json") {
    return "json";
  }
  if (normalized === "text" || normalized === "txt" || normalized === "plaintext") {
    return "text";
  }
  if (path.endsWith(".md")) {
    return "md";
  }
  if (path.endsWith(".tf")) {
    return "hcl";
  }
  if (path.endsWith(".json")) {
    return "json";
  }
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return "yaml";
  }
  return "text";
};

const isSourceLikePath = (path: string): boolean =>
  !/\.(zip|tar|tgz|gz|7z|rar)$/i.test(path);

const normalizeFiles = (value: unknown): GenerationDraft["files"] => {
  if (!Array.isArray(value)) {
    return [
      {
        path: "README.md",
        language: "md",
        content: defaultFileContent
      }
    ];
  }

  const files = value
    .map((entry, index) => {
      const record = asRecord(entry);
      const path = trimToLength(
        readTextFromKeys(record, ["path", "filePath", "filename", "name"]) ??
          `generated-${index + 1}.tf`,
        160
      );

      return {
        path,
        language: detectFileLanguage(path, readTextFromKeys(record, ["language", "type", "format"])),
        content: trimToLength(
          readTextFromKeys(record, ["content", "body", "text", "source"]) ?? defaultFileContent,
          60_000
        )
      };
    })
    .filter((file) => file.path.length > 0 && file.content.length > 0 && isSourceLikePath(file.path))
    .slice(0, 16);

  return files.length > 0
    ? files
    : [
        {
          path: "README.md",
          language: "md",
          content: defaultFileContent
        }
      ];
};

export const normalizeGenerationDraft = (
  value: unknown,
  settings: GenerationSettings
): GenerationDraft => {
  const record = asRecord(value);
  const files = normalizeFiles(record?.["files"]);
  const modules = enforceRequiredModules(
    normalizeModules(record?.["modules"], settings),
    settings
  );

  return generationDraftSchema.parse({
    name: normalizeName(record?.["name"]),
    summary: normalizeSummary(record?.["summary"]),
    explanation: normalizeExplanation(record?.["explanation"]),
    limitations: normalizeLimitations(record?.["limitations"]),
    modules,
    files,
    diagram: normalizeDiagram(record?.["diagram"], modules, files)
  });
};
