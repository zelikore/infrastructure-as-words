import {
  webRuntimeConfigSchema,
  type WebRuntimeConfig
} from "@infrastructure-as-words/contracts";

let runtimeConfigPromise: Promise<WebRuntimeConfig> | undefined;

export const getRuntimeConfig = (): Promise<WebRuntimeConfig> => {
  runtimeConfigPromise ??= fetch("/runtime-config.json", {
    cache: "no-store"
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Runtime configuration is not available yet.");
      }
      return response.json() as Promise<unknown>;
    })
    .then((payload) => webRuntimeConfigSchema.parse(payload));

  return runtimeConfigPromise;
};

