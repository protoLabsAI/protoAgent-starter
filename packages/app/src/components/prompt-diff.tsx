/**
 * PromptDiff — Inline line-by-line diff viewer.
 *
 * Compares two strings line-by-line and renders:
 *   - Removed lines with a red background (prefixed with "−")
 *   - Added lines with a green background (prefixed with "+")
 *   - Unchanged lines in the default foreground colour (prefixed with " ")
 *
 * Usage:
 *   <PromptDiff current={currentText} historical={historicalText} />
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a simple line-by-line diff using the Longest Common Subsequence
 * algorithm.  Returns an array of DiffLine objects describing how to transform
 * `historical` into `current`.
 *
 * Lines present in `current` but not `historical` → "added"   (green)
 * Lines present in `historical` but not `current` → "removed" (red)
 * Lines present in both                           → "unchanged"
 */
function diffLines(current: string, historical: string): DiffLine[] {
  const a = historical.split('\n');
  const b = current.split('\n');

  // Build LCS table
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'unchanged', text: a[i - 1] ?? '' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: b[j - 1] ?? '' });
      j--;
    } else {
      result.unshift({ type: 'removed', text: a[i - 1] ?? '' });
      i--;
    }
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PromptDiffProps {
  /** The current (latest) version of the prompt body. */
  current: string;
  /** The historical version to compare against. */
  historical: string;
}

export function PromptDiff({ current, historical }: PromptDiffProps) {
  const lines = diffLines(current, historical);

  if (lines.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontStyle: 'italic',
        }}
      >
        No differences.
      </div>
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: '8px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {lines.map((line, idx) => {
        let prefix: string;
        let bg: string;
        let color: string;

        if (line.type === 'added') {
          prefix = '+';
          bg = 'rgba(34,197,94,0.15)';
          color = 'var(--success, #22c55e)';
        } else if (line.type === 'removed') {
          prefix = '−';
          bg = 'rgba(248,113,113,0.15)';
          color = 'var(--error, #f87171)';
        } else {
          prefix = ' ';
          bg = 'transparent';
          color = 'var(--foreground)';
        }

        return (
          <div
            key={idx}
            style={{
              padding: '0 12px',
              background: bg,
              color,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {prefix} {line.text}
          </div>
        );
      })}
    </pre>
  );
}
