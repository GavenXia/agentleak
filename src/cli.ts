#!/usr/bin/env node
import { Command } from 'commander';
import { runScan } from './commands/scan.js';
import { runGuard } from './commands/guard.js';
import { runList, runMark } from './commands/baseline.js';
import { getVersion } from './version.js';

const program = new Command();

program
  .name('agentleak')
  .description(
    'Find secrets you already leaked into AI agent chat sessions — offline, local-first.',
  )
  .version(getVersion());

program
  .command('scan')
  .description('discover and scan all local AI agent sessions for leaked secrets')
  .option('--reveal', 'show full secret values (default: masked)')
  .option('--json', 'machine-readable JSON output (values still masked unless --reveal)')
  .option('--export <path>', 'also scan a web-chat export (.zip / conversations.json / directory)')
  .option('--path <dir>', 'working directory for project files (default: cwd)')
  .option('--rules <file>', 'custom rules file (gitleaks-style TOML)')
  .option('--no-baseline', 'do not read/write the local baseline')
  .option('--all', 'include findings marked as false-positive')
  .option('--exit-zero', 'always exit 0, even when findings exist (for cron/notifiers)')
  .action((flags) => {
    process.exitCode = runScan(flags);
  });

program
  .command('mark <fingerprint>')
  .description('update baseline status of a finding')
  .option('--rotated', 'you have rotated this credential')
  .option('--false-positive', 'this is not a real secret')
  .option('--open', 'reset back to open')
  .action(
    (fingerprint: string, opts: { rotated?: boolean; falsePositive?: boolean; open?: boolean }) => {
      const status = opts.rotated
        ? 'rotated'
        : opts.falsePositive
          ? 'false-positive'
          : opts.open
            ? 'open'
            : undefined;
      if (!status) {
        console.error('pick one: --rotated | --false-positive | --open');
        process.exitCode = 2;
        return;
      }
      process.exitCode = runMark(fingerprint, status);
    },
  );

program
  .command('list')
  .description('list known finding fingerprints and their baseline status')
  .option('--json', 'JSON output')
  .action((opts: { json?: boolean }) => {
    process.exitCode = runList(Boolean(opts.json));
  });

program
  .command('guard')
  .description(
    'read a prompt from stdin and fail (exit 2) if it contains secrets — for agent hooks',
  )
  .option('--rules <file>', 'custom rules file (gitleaks-style TOML)')
  .action((opts: { rules?: string }) => {
    process.exitCode = runGuard(opts.rules);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 2;
});
