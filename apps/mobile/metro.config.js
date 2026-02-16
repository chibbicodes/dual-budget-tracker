const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `auto` to automatically find the workspace root
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

// 4. Exclude Electron/Vite desktop directories from Metro bundling
const exclusionList = require('metro-config/src/defaults/exclusionList');
config.resolver.blockList = exclusionList([
  new RegExp(path.resolve(monorepoRoot, 'dist-electron').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'electron').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'src').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'build').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'scripts').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
]);

module.exports = config;
