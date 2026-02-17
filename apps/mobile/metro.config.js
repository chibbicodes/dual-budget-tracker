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

// 3. Deduplicate react — the root has React 18.x (Electron) and mobile needs
//    React 19.x. Packages hoisted to root (like @react-navigation/core) resolve
//    React 18 via standard node_modules lookup. resolveRequest intercepts ALL
//    react imports and forces them to the mobile app's React 19.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    try {
      // require.resolve runs from apps/mobile/, so it finds React 19.x
      return { type: 'sourceFile', filePath: require.resolve(moduleName) };
    } catch {}
  }
  // Use the default resolver for everything else
  const resolve = defaultResolveRequest || context.resolveRequest;
  return resolve(context, moduleName, platform);
};

// 4. Block Electron/desktop directories from Metro resolution as a safety net
config.resolver.blockList = [
  /[/\\]dist-electron[/\\].*/,
  /[/\\]electron[/\\].*/,
  new RegExp(path.resolve(monorepoRoot, 'src').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'build').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'scripts').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
];

module.exports = config;
