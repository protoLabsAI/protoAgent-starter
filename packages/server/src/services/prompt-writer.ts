/**
 * PromptWriter — writes prompt Markdown files to the `prompts/` directory and
 * auto-commits each change via git.
 *
 * File format:
 *
 *   ---
 *   role: <role>
 *   name: <name>
 *   version: <version>
 *   ---
 *   <template body>
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface WritePromptOptions {
  /** URL-safe identifier (filename without `.md`). */
  role: string;
  /** Human-readable display name. */
  name: string;
  /** Semantic version string, e.g. "1.0.0". */
  version: string;
  /** The prompt template body (written after the frontmatter). */
  template: string;
}

export interface WritePromptResult {
  /** Absolute path of the written file. */
  filepath: string;
  /** Git commit hash (short) of the auto-commit, or null if commit was skipped. */
  commitHash: string | null;
}

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

/**
 * Build the full file content: YAML frontmatter + template body.
 */
function buildFileContent(opts: WritePromptOptions): string {
  const { role, name, version, template } = opts;
  const frontmatter = `---\nrole: ${role}\nname: ${name}\nversion: ${version}\n---\n`;
  return frontmatter + template;
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
 * Write a prompt file to `prompts/<role>.md` and auto-commit it with git.
 *
 * The commit message follows the pattern:
 *   prompt(<role>): save <name> v<version> [<ISO timestamp>]
 */
export function writePrompt(opts: WritePromptOptions): WritePromptResult {
  const { role, name, version } = opts;

  // Ensure the prompts directory exists
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }

  const filepath = path.join(PROMPTS_DIR, `${role}.md`);
  const content = buildFileContent(opts);

  fs.writeFileSync(filepath, content, 'utf-8');

  // Auto-commit: git add + git commit
  const repoRoot = runCommand('git rev-parse --show-toplevel', PROMPTS_DIR) ?? process.cwd();
  const relPath = path.relative(repoRoot, filepath);
  const timestamp = new Date().toISOString();
  const commitMessage = `prompt(${role}): save ${name} v${version} [${timestamp}]`;

  runCommand(`git add "${relPath}"`, repoRoot);
  runCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoRoot);

  const commitHash = runCommand('git rev-parse --short HEAD', repoRoot);

  return { filepath, commitHash };
}
