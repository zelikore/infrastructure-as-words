import type {
  ModuleCategory,
  ModuleCatalogEntry,
  ModulePriority,
  ModuleVisibility
} from "@infrastructure-as-words/contracts";

type GovernanceModuleEditorProps = {
  modules: ModuleCatalogEntry[];
  onChange: (modules: ModuleCatalogEntry[]) => void;
};

const priorityOptions: ModulePriority[] = ["preferred", "allowed", "fallback"];
const visibilityOptions: ModuleVisibility[] = ["private", "public"];
const categoryOptions: ModuleCategory[] = [
  "platform",
  "identity",
  "edge",
  "network",
  "compute",
  "data",
  "observability",
  "security",
  "delivery"
];

const blankModule = (): ModuleCatalogEntry => ({
  moduleId: `module-${Math.random().toString(36).slice(2, 8)}`,
  label: "New module",
  source: "terraform-aws-modules/example/aws",
  visibility: "public",
  priority: "allowed",
  description: "Describe where this module should be used.",
  category: "platform",
  required: false,
  capabilities: ["general"],
  documentation: {
    summary: "Short summary for AI guidance.",
    howItWorks: "Explain how this module works, what it provisions, and when to use it."
  }
});

const updateModule = (
  modules: ModuleCatalogEntry[],
  index: number,
  patch: Partial<ModuleCatalogEntry>
): ModuleCatalogEntry[] =>
  modules.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));

const parseCapabilities = (value: string): string[] => {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const capability of value.split(",")) {
    const trimmed = capability.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    items.push(trimmed);
  }

  return items.length > 0 ? items : ["general"];
};

export function GovernanceModuleEditor({
  modules,
  onChange
}: GovernanceModuleEditorProps) {
  return (
    <div className="iaw-governanceModules">
      <div className="iaw-governanceModulesHeader">
        <p className="iaw-sectionLabel">Modules</p>
        <button
          type="button"
          className="iaw-secondaryButton"
          onClick={() => {
            onChange([...modules, blankModule()]);
          }}
        >
          Add
        </button>
      </div>

      <div className="iaw-governanceModuleList">
        {modules.map((module, index) => (
          <article key={module.moduleId} className="iaw-governanceModuleCard">
            <div className="iaw-governanceModuleMeta">
              <select
                className="iaw-selectField"
                value={module.visibility}
                onChange={(event) => {
                  onChange(
                    updateModule(modules, index, {
                      visibility: event.target.value as ModuleVisibility
                    })
                  );
                }}
              >
                {visibilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="iaw-selectField"
                value={module.priority}
                onChange={(event) => {
                  onChange(
                    updateModule(modules, index, {
                      priority: event.target.value as ModulePriority
                    })
                  );
                }}
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="iaw-selectField"
                value={module.category}
                onChange={(event) => {
                  onChange(
                    updateModule(modules, index, {
                      category: event.target.value as ModuleCategory
                    })
                  );
                }}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label className="iaw-governanceRequiredToggle">
                <input
                  type="checkbox"
                  checked={module.required}
                  onChange={(event) => {
                    onChange(
                      updateModule(modules, index, {
                        required: event.target.checked
                      })
                    );
                  }}
                />
                Required
              </label>
            </div>

            <input
              className="iaw-inlineField"
              value={module.label}
              placeholder="Module label"
              onChange={(event) => {
                onChange(updateModule(modules, index, { label: event.target.value }));
              }}
            />
            <input
              className="iaw-inlineField"
              value={module.moduleId}
              placeholder="module-id"
              onChange={(event) => {
                onChange(updateModule(modules, index, { moduleId: event.target.value }));
              }}
            />
            <input
              className="iaw-inlineField"
              value={module.source}
              placeholder="terraform module source"
              onChange={(event) => {
                onChange(updateModule(modules, index, { source: event.target.value }));
              }}
            />
            <textarea
              className="iaw-stackArea iaw-stackAreaCompact"
              placeholder="Short description"
              value={module.description}
              onChange={(event) => {
                onChange(updateModule(modules, index, { description: event.target.value }));
              }}
            />
            <input
              className="iaw-inlineField"
              value={module.capabilities.join(", ")}
              placeholder="capability-a, capability-b"
              onChange={(event) => {
                onChange(
                  updateModule(modules, index, {
                    capabilities: parseCapabilities(event.target.value)
                  })
                );
              }}
            />
            <input
              className="iaw-inlineField"
              value={module.documentation.summary}
              placeholder="Documentation summary for AI context"
              onChange={(event) => {
                onChange(
                  updateModule(modules, index, {
                    documentation: {
                      ...module.documentation,
                      summary: event.target.value
                    }
                  })
                );
              }}
            />
            <textarea
              className="iaw-stackArea iaw-stackAreaCompact"
              value={module.documentation.howItWorks}
              placeholder="How the module works and when to use it"
              onChange={(event) => {
                onChange(
                  updateModule(modules, index, {
                    documentation: {
                      ...module.documentation,
                      howItWorks: event.target.value
                    }
                  })
                );
              }}
            />
            <textarea
              className="iaw-stackArea iaw-stackAreaCompact"
              value={module.documentation.usageNotes ?? ""}
              placeholder="Optional usage notes"
              onChange={(event) => {
                const value = event.target.value.trim();
                onChange(
                  updateModule(modules, index, {
                    documentation: {
                      ...module.documentation,
                      ...(value ? { usageNotes: value } : { usageNotes: undefined })
                    }
                  })
                );
              }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
