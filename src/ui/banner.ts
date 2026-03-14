import os from 'os';
import { createRequire } from 'module';
import { brandGradient, c, border, box, icons, divider, vLen, rPad } from './theme.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };
const VERSION = pkg.version;

// Re-export helpers that other modules import from banner
export { vLen, rPad };

/** Shorten cwd by replacing homedir with ~. */
function shortCwd(): string {
  const cwd = process.cwd();
  const home = os.homedir();
  return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
}

// ── ASCII Art Logo (block style, same as original SWE) ─────────────
const LOGO_LINES = [
  ' ███████╗██╗    ██╗███████╗████████╗███████╗ █████╗ ███╗   ███╗',
  ' ██╔════╝██║    ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗████╗ ████║',
  ' ███████╗██║ █╗ ██║█████╗     ██║   █████╗  ███████║██╔████╔██║',
  ' ╚════██║██║███╗██║██╔══╝     ██║   ██╔══╝  ██╔══██║██║╚██╔╝██║',
  ' ███████║╚███╔███╔╝███████╗   ██║   ███████╗██║  ██║██║ ╚═╝ ██║',
  ' ╚══════╝ ╚══╝╚══╝ ╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝',
];

// ── Public API ──────────────────────────────────────────────────────

export interface RecentSession {
  id: string;
  goal: string;
}

export function renderBanner(sessions: RecentSession[] = []): string {
  const termW = process.stdout.columns || 80;
  const IW = Math.max(termW - 3, 60);

  // ── Version label in top border ──
  const versionLabel = ` sweteam v${VERSION} `;
  const topDashes = Math.max(IW - 3 - vLen(versionLabel), 0);
  const topLine =
    border.primary(box.topLeft + box.horizontal.repeat(2) + ' ') +
    brandGradient(versionLabel) +
    border.primary(' ' + box.horizontal.repeat(topDashes - 1) + box.topRight);

  const botLine = border.primary(box.bottomLeft + box.horizontal.repeat(IW) + box.bottomRight);
  const outerBorder = border.primary(box.vertical);

  const rows: string[] = [topLine];

  // ── Full-width logo section ──
  rows.push(outerBorder + rPad('', IW) + outerBorder);
  for (const line of LOGO_LINES) {
    rows.push(outerBorder + rPad('  ' + brandGradient(line), IW) + outerBorder);
  }
  rows.push(
    outerBorder +
      rPad(
        `  ${c.muted(icons.dot)} ${c.subtle(`v${VERSION}`)} ${c.muted(icons.dot)} ${c.subtle('orchestrator')} ${c.muted(icons.dot)} ${c.dim(shortCwd())}`,
        IW,
      ) +
      outerBorder,
  );
  rows.push(outerBorder + rPad('', IW) + outerBorder);

  // ── Separator ──
  rows.push(border.primary(box.teeLeft + box.horizontal.repeat(IW) + box.teeRight));

  // ── Two-column bottom section: commands + sessions ──
  const LW = Math.min(46, Math.floor(IW * 0.45));
  const RW = IW - 1 - LW;
  const midBorder = border.dim(box.vertical);

  const left: string[] = [''];
  left.push(' ' + c.brightBold('Quick Start'));
  left.push('');

  const cmds = [
    { key: '/create', arg: ' [repo]', desc: 'Start a new session' },
    { key: '/list', arg: '', desc: 'See all sessions' },
    { key: '/enter', arg: ' <id>', desc: 'Resume a session' },
    { key: '/help', arg: '', desc: 'Show all commands' },
  ];

  for (const cmd of cmds) {
    const cmdStr = c.cyan(cmd.key) + c.muted(cmd.arg);
    const cmdLen = vLen(cmdStr);
    const gap = Math.max(1, LW - cmdLen - cmd.desc.length - 4);
    left.push(` ${c.muted(icons.pointer)} ${cmdStr}${' '.repeat(gap)}${c.subtle(cmd.desc)}`);
  }
  left.push('');

  // ── Right column: recent sessions ──
  const right: string[] = [''];
  right.push(' ' + divider(RW - 2, 'recent'));
  right.push('');

  if (sessions.length > 0) {
    const maxGoal = RW - 18;
    for (const s of sessions.slice(0, 3)) {
      const g = s.goal.length > maxGoal ? s.goal.slice(0, maxGoal - 1) + '…' : s.goal;
      right.push(` ${c.muted(icons.pointerEmpty)} ${c.info(s.id.slice(0, 8))} ${c.dim(g)}`);
    }
  } else {
    right.push(` ${c.muted('  No recent sessions')}`);
  }
  right.push('');

  // ── Keyboard hints ──
  right.push(` ${c.muted('Tab')} ${c.dim('autocomplete')}  ${c.muted('Esc')} ${c.dim('back')}`);
  right.push('');

  // ── Equalise row count ──
  const h = Math.max(left.length, right.length);
  while (left.length < h) left.push('');
  while (right.length < h) right.push('');

  // ── Assemble bottom rows ──
  for (let i = 0; i < h; i++) {
    rows.push(outerBorder + rPad(left[i], LW) + midBorder + rPad(right[i], RW) + outerBorder);
  }
  rows.push(botLine);

  return rows.join('\n');
}
