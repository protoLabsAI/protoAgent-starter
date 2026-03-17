/**
 * PromptHistory — reads git history for a prompt's Markdown file.
 *
 * Uses `git log` to find the last N commits that touched the file, then
 * `git show` to retrieve the file content at each commit.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

export interface PromptVersion {
  /** Full commit hash. */
  commitHash: string;
  /** ISO 8601 timestamp of the commit. */
  timestamp: string;
  /** Author name. */
  author: string;
  /** Commit message subject. */
  message: string;
  /** Full file content at this commit. */
  content: string;
}

/**
 * Run a shell command synchronously, capturing stdout.
 * Returns stdout on success or null on error.
 */
function runCommand(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Return the last `limit` committed versions of a prompt file.
 *
 * @param role  - The prompt role (filename without `.md`).
 * @param limit - Number of versions to return (default: 2).
 * @returns     Array of PromptVersion objects, newest first.
 *              Returns an empty array if no git history exists or the file
 *              has never been committed.
 */
export function getPromptHistory(role: string, limit = 2): PromptVersion[] {
  const filename = `${role}.md`;
  const filepath = path.join(PROMPTS_DIR, filename);

  // Determine the repository root so git commands work regardless of cwd.
  const repoRoot = runCommand('git rev-parse --show-toplevel', PROMPTS_DIR) ?? process.cwd();

  // Path to the file relative to the repo root, used in git commands.
  const relPath = path.relative(repoRoot, filepath);

  // Fetch the last `limit` commits that touched this file.
  // Format: "hash|ISO-timestamp|author-name|subject"
  const logOutput = runCommand(
    `git log --pretty=format:"%H|%ai|%an|%s" -n ${limit} -- "${relPath}"`,
    repoRoot,
  );

  if (!logOutput) {
    // No commits found (file never committed, or git not available).
    return [];
  }

  const versions: PromptVersion[] = [];

  for (const line of logOutput.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split on the first three pipes only — the subject may contain pipes.
    const firstPipe = trimmed.indexOf('|');
    const secondPipe = trimmed.indexOf('|', firstPipe + 1);
    const thirdPipe = trimmed.indexOf('|', secondPipe + 1);

    if (firstPipe === -1 || secondPipe === -1 || thirdPipe === -1) continue;

    const commitHash = trimmed.slice(0, firstPipe);
    const timestamp = trimmed.slice(firstPipe + 1, secondPipe);
    const author = trimmed.slice(secondPipe + 1, thirdPipe);
    const message = trimmed.slice(thirdPipe + 1);

    // Retrieve file content at this commit.
    const content = runCommand(`git show "${commitHash}:${relPath}"`, repoRoot);

    if (content === null) {
      // File may not have existed at this commit (e.g. a deletion commit) — skip.
      continue;
    }

    versions.push({ commitHash, timestamp, author, message, content });
  }

  return versions;
}
