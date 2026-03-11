const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [
    /ENOENT.*spawn/i,
    'Command not found. Check that the CLI adapter is installed and on your PATH.',
  ],
  [
    /EACCES/i,
    'Permission denied. Check file/directory permissions or run with appropriate access.',
  ],
  [
    /authentication|auth.*fail|401|403/i,
    'Authentication failed. Run `gh auth status` or check your API token.',
  ],
  [/TOML|parse error|Expected/i, 'Config parse error. Check your sweteam.toml for syntax issues.'],
  [/rate.?limit|429|too many requests/i, 'Rate limited by the API. Wait a moment and try again.'],
  [/ECONNREFUSED|ENOTFOUND|network/i, 'Network error. Check your internet connection.'],
  [
    /timed?\s*out/i,
    'Operation timed out. The task may be too large — try breaking it into smaller steps.',
  ],
];

export function friendlyError(raw: string): string {
  for (const [pattern, hint] of ERROR_PATTERNS) {
    if (pattern.test(raw)) {
      return `${raw}\n  Hint: ${hint}`;
    }
  }
  return raw;
}
