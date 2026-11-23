// Lets the build scripts skip steps whose inputs haven't changed since they last succeeded.
//   node scripts/build-steps.mjs need <step>   exit code 0 = the step must run, 1 = up to date
//   node scripts/build-steps.mjs done <step>   record that the step just succeeded
//   node scripts/build-steps.mjs changed <step> exit code 0 = it ran before with different inputs
//                                               (not just "never recorded"), 1 = otherwise
// Each step's fingerprint is a hash of its input files, stored next to what the step produces, so
// deleting that output (e.g. node_modules or android/) makes the step run again.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Inputs of each step, and where its fingerprint lives (inside what the step creates). */
const STEPS = {
  // Downloading packages: only the package lists matter.
  install: { inputs: ['package.json', 'package-lock.json'], stamp: 'node_modules/.build-stamp-install', output: 'node_modules' },
  // Generating android/: app settings, config plugins and the installed packages.
  prebuild: {
    inputs: ['app.json', 'package.json', 'package-lock.json', 'plugins', 'assets'],
    stamp: 'android/.build-stamp-prebuild',
    output: 'android',
  },
  // Building the app file: everything that goes into it.
  apk: {
    inputs: ['app.json', 'package.json', 'package-lock.json', 'plugins', 'assets', 'src', 'babel.config.js', 'metro.config.js', 'tsconfig.json'],
    stamp: '.build-stamp-apk',
    output: 'Workout.apk',
  },
};

function files(path) {
  const full = join(root, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full)
    .sort()
    .flatMap((name) => files(join(path, name)));
}

export function fingerprint(step) {
  const hash = createHash('sha256');
  for (const input of STEPS[step].inputs) {
    for (const file of files(input)) {
      hash.update(relative(root, file).replaceAll('\\', '/'));
      // Ignore line-ending differences (Windows checkouts use CRLF).
      hash.update(readFileSync(file).toString('latin1').replaceAll('\r\n', '\n'));
    }
  }
  return hash.digest('hex');
}

const [command, step] = process.argv.slice(2);
const def = STEPS[step];
if (!def || !['need', 'done', 'changed'].includes(command)) {
  console.error(`usage: build-steps.mjs need|done|changed ${Object.keys(STEPS).join('|')}`);
  process.exit(2);
}
const stampPath = join(root, def.stamp);
if (command === 'done') {
  writeFileSync(stampPath, fingerprint(step));
} else if (command === 'changed') {
  process.exit(existsSync(stampPath) && readFileSync(stampPath, 'utf8') !== fingerprint(step) ? 0 : 1);
} else {
  const upToDate =
    existsSync(join(root, def.output)) && existsSync(stampPath) && readFileSync(stampPath, 'utf8') === fingerprint(step);
  process.exit(upToDate ? 1 : 0);
}
