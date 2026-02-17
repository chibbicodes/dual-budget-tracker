const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Only watch the shared package and root node_modules (NOT the entire monorepo
//    root, which would pull in dist-electron/, electron/, src/ etc.)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages', 'shared'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Block Electron/desktop directories from Metro resolution as a safety net
config.resolver.blockList = [
  /[/\\]dist-electron[/\\].*/,
  /[/\\]electron[/\\].*/,
  new RegExp(path.resolve(monorepoRoot, 'src').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'build').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'scripts').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
];

module.exports = config;
