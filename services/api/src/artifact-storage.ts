import { Buffer } from "node:buffer";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  GeneratedFileManifest,
  SubmissionArtifact
} from "@infrastructure-as-words/contracts";
import { strToU8, zipSync } from "fflate";
import type { GeneratedFile } from "./generation-schema.js";
import { getEnvironment } from "./environment.js";

const s3Client = new S3Client({});

const languageByPath = (path: string): GeneratedFileManifest["language"] => {
  if (path.endsWith(".tf")) {
    return "hcl";
  }
  if (path.endsWith(".md")) {
    return "md";
  }
  if (path.endsWith(".json")) {
    return "json";
  }
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return "yaml";
  }
  return "text";
};

const sanitizePath = (value: string): string =>
  value
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/\.\./g, "")
    .replace(/\/{2,}/g, "/");

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "stack";

const buildArtifactFileName = (submissionId: string, name: string): string =>
  `${slugify(name)}-${submissionId.slice(0, 8)}.zip`;

const buildArtifactKey = (submissionId: string, fileName: string): string =>
  `submissions/${submissionId}/${fileName}`;

export const createFileManifest = (files: GeneratedFile[]): GeneratedFileManifest[] =>
  files.map((file) => {
    const path = sanitizePath(file.path);
    return {
      path,
      language: languageByPath(path),
      sizeBytes: Buffer.byteLength(file.content, "utf8")
    };
  });

export const uploadTerraformArtifact = async (input: {
  submissionId: string;
  name: string;
  files: GeneratedFile[];
}): Promise<{
  artifact: SubmissionArtifact;
  manifest: GeneratedFileManifest[];
}> => {
  const environment = getEnvironment();
  const fileName = buildArtifactFileName(input.submissionId, input.name);
  const key = buildArtifactKey(input.submissionId, fileName);

  const manifest = createFileManifest(input.files);
  const archiveEntries = Object.fromEntries(
    input.files.map((file) => [sanitizePath(file.path), strToU8(file.content)])
  );
  const archiveBytes = zipSync(archiveEntries, {
    level: 9
  });
  const body = Buffer.from(archiveBytes);
  const createdAt = new Date().toISOString();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: environment.ARTIFACTS_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "application/zip"
    })
  );

  return {
    artifact: {
      fileName,
      sizeBytes: body.byteLength,
      createdAt
    },
    manifest
  };
};

export const createArtifactDownloadUrl = async (input: {
  submissionId: string;
  artifact: SubmissionArtifact;
}): Promise<SubmissionArtifact> => {
  const environment = getEnvironment();
  const expiresAt = new Date(
    Date.now() + environment.ARTIFACT_DOWNLOAD_TTL_SECONDS * 1_000
  ).toISOString();

  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: environment.ARTIFACTS_BUCKET_NAME,
      Key: buildArtifactKey(input.submissionId, input.artifact.fileName),
      ResponseContentType: "application/zip",
      ResponseContentDisposition: `attachment; filename="${input.artifact.fileName}"`
    }),
    {
      expiresIn: environment.ARTIFACT_DOWNLOAD_TTL_SECONDS
    }
  );

  return {
    ...input.artifact,
    downloadUrl,
    downloadUrlExpiresAt: expiresAt
  };
};
