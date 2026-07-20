#!/usr/bin/env node
/**
 * Uninstall team sync daemon (admin-only).
 * Usage: node bin/uninstall-daemon.mjs [--service-name com.company.devmetrics] [--purge]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const serviceName = arg('--service-name') || 'com.company.devmetrics';
const purge = args.includes('--purge');
const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${serviceName}.plist`);

if (process.platform === 'darwin' && fs.existsSync(plistPath)) {
  try { execSync(`launchctl bootout gui/${process.getuid()} "${plistPath}"`, { stdio: 'ignore' }); } catch { /* ignore */ }
  fs.unlinkSync(plistPath);
  console.log(`removed LaunchAgent: ${plistPath}`);
}

if (purge) {
  const configDir = path.join(os.homedir(), '.devmetrics');
  for (const f of ['config.json', 'sync-state.json', 'sync.log', 'daemon.log']) {
    const p = path.join(configDir, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`removed ${p}`);
    }
  }
}

console.log('uninstall complete');
