import fs from "node:fs";
import process from "node:process";

export const appendStepSummary = (markdown: string): void => {
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (!summaryPath) {
    return;
  }

  fs.appendFileSync(summaryPath, `${markdown}\n`);
};

const requestGitHub = async (
  method: string,
  endpoint: string,
  token: string,
  body: unknown,
): Promise<unknown> => {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "infrastructure-as-words-pr-review",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API ${method} ${endpoint} failed: ${response.status}`,
    );
  }

  return response.status === 204
    ? undefined
    : ((await response.json()) as unknown);
};

export const syncPullRequestComment = async (
  markdown: string,
  marker: string,
): Promise<void> => {
  const token = process.env["GITHUB_TOKEN"];
  const repository = process.env["GITHUB_REPOSITORY"];
  const prNumber = process.env["PR_NUMBER"];
  if (!token || !repository || !prNumber) {
    return;
  }

  const comments = (await requestGitHub(
    "GET",
    `/repos/${repository}/issues/${prNumber}/comments?per_page=100`,
    token,
    undefined,
  )) as Array<{ id: number; body?: string }>;

  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) {
    await requestGitHub(
      "PATCH",
      `/repos/${repository}/issues/comments/${existing.id}`,
      token,
      { body: markdown },
    );
    return;
  }

  await requestGitHub(
    "POST",
    `/repos/${repository}/issues/${prNumber}/comments`,
    token,
    { body: markdown },
  );
};
