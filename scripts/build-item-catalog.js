const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(
  process.env.ISAAC_SOURCE_ROOT
    || path.join(projectRoot, '..', '以撒资源素材', 'extracted_resources', 'resources')
);
const sourceCharacters = path.join(sourceRoot, 'gfx', 'characters');
const targetRoot = path.join(projectRoot, 'assets', 'isaac');
const targetCharacters = path.join(targetRoot, 'gfx', 'characters');
const targetCollectibles = path.join(targetRoot, 'gfx', 'collectibles');
const brimstoneId = 118;
const skinColorSuffixes = ['white', 'black', 'blue', 'red', 'green', 'grey'];
const recolorableCharacterSprites = [
  'character_001_isaac.png',
  'character_002_magdalene.png',
  'character_003_cain.png',
  'character_004_judas.png',
  'character_005_eve.png',
  'character_007_samson.png',
  'character_009_lazarus.png',
  'character_010_lazarus2.png',
  'character_009_eden.png',
  'character_001x_bethany.png',
  'character_002x_jacob.png',
  'character_003x_esau.png'
];
let discoveredCostumeCharacterSuffixes;

const localizedNames = new Map([
  [1, '悲伤洋葱'],
  [2, '内眼'],
  [101, '光环'],
  [118, '硫磺火']
]);

function attributes(text) {
  const result = {};
  const pattern = /([A-Za-z][\w:-]*)\s*=\s*"([^"]*)"/g;
  for (const match of text.matchAll(pattern)) result[match[1]] = match[2];
  return result;
}

function resolveCaseInsensitive(root, relativePath) {
  const segments = relativePath.replaceAll('\\', '/').split('/').filter(Boolean);
  let current = root;
  for (const segment of segments) {
    const match = fs.readdirSync(current, { withFileTypes: true })
      .find(entry => entry.name.toLowerCase() === segment.toLowerCase());
    if (!match) throw new Error(`找不到素材：${path.join(current, segment)}`);
    current = path.join(current, match.name);
  }
  return current;
}

function tryResolveCaseInsensitive(root, relativePath) {
  try {
    return resolveCaseInsensitive(root, relativePath);
  } catch {
    return null;
  }
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function englishNameFromIcon(iconName) {
  const stem = path.basename(iconName, path.extname(iconName))
    .replace(/^collectibles_\d+_/i, '')
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return stem.replace(/\s+/g, ' ').trim();
}

function parseItems() {
  const xml = fs.readFileSync(path.join(sourceRoot, 'items.xml'), 'utf8');
  const items = new Map();
  for (const match of xml.matchAll(/<(passive|active|familiar)\b([^>]*)\/>/g)) {
    const item = attributes(match[2]);
    const id = Number(item.id);
    if (Number.isInteger(id) && item.gfx) items.set(id, { ...item, itemType: match[1] });
  }
  return items;
}

function parsePassiveCostumes() {
  const xml = fs.readFileSync(path.join(sourceRoot, 'costumes2.xml'), 'utf8');
  const costumes = new Map();
  for (const match of xml.matchAll(/<costume\b([^>]*)>/g)) {
    const costume = attributes(match[1]);
    const id = Number(costume.id);
    if (costume.type === 'passive' && Number.isInteger(id) && costume.anm2path) {
      costumes.set(id, costume);
    }
  }
  return costumes;
}

function inspectActor(actorPath) {
  const xml = fs.readFileSync(actorPath, 'utf8');
  const layerDefinitions = Array.from(xml.matchAll(/<Layer\b([^>]*)\/?\s*>/g), match => attributes(match[1]))
    .filter(layer => layer.Id !== undefined && layer.Name);
  const layers = layerDefinitions.map(layer => layer.Name);
  const layerNamesById = new Map(layerDefinitions.map(layer => [layer.Id, layer.Name.toLowerCase()]));
  const animations = Array.from(xml.matchAll(/<Animation\b([^>]*)>/g), match => attributes(match[1]).Name)
    .filter(Boolean);
  const animationLayers = new Map();
  for (const match of xml.matchAll(/<Animation\b([^>]*)>([\s\S]*?)<\/Animation>/g)) {
    const animationName = attributes(match[1]).Name;
    if (!animationName) continue;
    const usedLayers = new Set();
    for (const layerMatch of match[2].matchAll(
      /<LayerAnimation\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/LayerAnimation>)/g
    )) {
      if (!layerMatch[2]) continue;
      if (!/<Frame\b/.test(layerMatch[2])) continue;
      const layerName = layerNamesById.get(attributes(layerMatch[1]).LayerId);
      if (layerName) usedLayers.add(layerName);
    }
    animationLayers.set(animationName, usedLayers);
  }
  const spritesheets = Array.from(xml.matchAll(/<Spritesheet\b([^>]*)\/?\s*>/g), match => attributes(match[1]).Path)
    .filter(Boolean);
  return { layers, animations, animationLayers, spritesheets };
}

function layerUsesAnimation(actor, layerName, predicate) {
  const normalizedName = layerName.toLowerCase();
  return actor.animations.some(animationName => (
    predicate(animationName)
    && actor.animationLayers.get(animationName)?.has(normalizedName)
  ));
}

function placementForLayer(layerName) {
  if (/^(body|glow|back)$/i.test(layerName)) return 'beforeBase';
  if (/^body[01]$/i.test(layerName)) return 'afterBody';
  return 'afterBase';
}

function addTrackLayer(trackGroups, source, placement, layerName, offsetX = 0, offsetY = 0) {
  const key = `${source}:${placement}:${offsetX}:${offsetY}`;
  if (!trackGroups.has(key)) {
    trackGroups.set(key, {
      source,
      placement,
      layers: [],
      ...(offsetX ? { offsetX } : {}),
      ...(offsetY ? { offsetY } : {})
    });
  }
  trackGroups.get(key).layers.push(layerName);
}

function analyzeStandardCostume(costume, actor) {
  if (!actor.layers.length) {
    return { supported: false, reason: 'no-layers' };
  }

  const supportedLayerPattern = /^(head\d*|body|body[01]|top0|glow|back|main)$/i;
  const unsupportedLayers = actor.layers.filter(layer => !supportedLayerPattern.test(layer));
  if (unsupportedLayers.length) {
    return {
      supported: false,
      reason: 'unsupported-layers',
      details: { layers: unsupportedLayers }
    };
  }

  const trackGroups = new Map();
  for (const layer of actor.layers) {
    const placement = placementForLayer(layer);
    const offsetY = /^main$/i.test(layer) ? -16 : 0;
    const usesHead = layerUsesAnimation(actor, layer, name => /^Head(Down|Right|Up|Left)$/i.test(name));
    const usesMovement = layerUsesAnimation(actor, layer, name => /^Walk(Down|Right|Up|Left)$/i.test(name));
    const usesHeadOverlay = layerUsesAnimation(
      actor,
      layer,
      name => /^Head(Down|Right|Up|Left)_Overlay$/i.test(name)
    );
    if (usesHeadOverlay) addTrackLayer(trackGroups, 'headOverlay', placement, layer, 0, offsetY);
    if (/^(head\d*|glow|back)$/i.test(layer) && usesHead) {
      addTrackLayer(trackGroups, 'head', placement, layer, 0, offsetY);
    } else if (/^(body|body[01]|top0)$/i.test(layer) && usesMovement) {
      addTrackLayer(trackGroups, 'movement', placement, layer, 0, offsetY);
    } else if (usesHead) {
      addTrackLayer(trackGroups, 'head', placement, layer, 0, offsetY);
    } else if (usesMovement) {
      addTrackLayer(trackGroups, 'movement', placement, layer, 0, offsetY);
    } else if (!usesHeadOverlay) {
      addTrackLayer(trackGroups, 'default', placement, layer, 0, offsetY);
    }
  }
  const tracks = [...trackGroups.values()];
  if (!tracks.length) return { supported: false, reason: 'no-supported-animation' };

  const hasHead = actor.layers.some(layer => /^head\d*$/i.test(layer));
  const hasBody = actor.layers.some(layer => /^(body|body[01]|top0)$/i.test(layer));
  const parts = [hasHead ? 'head' : null, hasBody ? 'body' : null].filter(Boolean);
  const kind = hasHead && hasBody ? 'mixed' : hasHead ? 'head' : hasBody ? 'body' : 'other';

  return {
    supported: true,
    kind,
    appearance: {
      parts,
      tracks,
      ...(actor.layers.some(layer => /^body$/i.test(layer)) ? { hideBaseLayers: ['body'] } : {})
    }
  };
}

function copyActorAndDependencies(actorPath, actor) {
  copyFile(actorPath, path.join(targetCharacters, path.basename(actorPath)));
  for (const referencedPath of actor.spritesheets) {
    const sourceTexture = resolveCaseInsensitive(sourceCharacters, referencedPath);
    const relativeTexture = path.relative(sourceCharacters, sourceTexture);
    copyFile(sourceTexture, path.join(targetCharacters, relativeTexture));
  }
}

function costumeCharacterSuffixes() {
  if (!discoveredCostumeCharacterSuffixes) {
    discoveredCostumeCharacterSuffixes = fs.readdirSync(sourceCharacters, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^costumes_.+/i.test(entry.name))
      .map(entry => entry.name.slice('costumes_'.length).toLowerCase())
      .sort();
  }
  return discoveredCostumeCharacterSuffixes;
}

function copyActorAlternates(actor, costume) {
  const characterAlternates = {};
  const characterSkinColorAlternates = {};
  for (const characterSuffix of costumeCharacterSuffixes()) {
    const replacements = {};
    const colorReplacements = {};
    for (const referencedPath of actor.spritesheets) {
      const normalizedPath = referencedPath.replaceAll('\\', '/').replace(/^\/+/, '');
      if (!normalizedPath.toLowerCase().startsWith('costumes/')) continue;
      const alternatePath = normalizedPath.replace(/^costumes\//i, `costumes_${characterSuffix}/`);
      const sourceTexture = tryResolveCaseInsensitive(sourceCharacters, alternatePath);
      const sourceKey = `gfx/characters/${normalizedPath.toLowerCase()}`;
      if (sourceTexture) {
        const relativeTexture = path.relative(sourceCharacters, sourceTexture);
        copyFile(sourceTexture, path.join(targetCharacters, relativeTexture));
        replacements[sourceKey] = `gfx/characters/${relativeTexture.replaceAll('\\', '/')}`;
      }

      const extension = path.posix.extname(alternatePath);
      for (const [skinColor, colorSuffix] of skinColorSuffixes.entries()) {
        const colorPath = `${alternatePath.slice(0, -extension.length)}_${colorSuffix}${extension}`;
        const colorTexture = tryResolveCaseInsensitive(sourceCharacters, colorPath);
        if (!colorTexture) continue;
        const relativeTexture = path.relative(sourceCharacters, colorTexture);
        copyFile(colorTexture, path.join(targetCharacters, relativeTexture));
        if (!colorReplacements[skinColor]) colorReplacements[skinColor] = {};
        colorReplacements[skinColor][sourceKey] = (
          `gfx/characters/${relativeTexture.replaceAll('\\', '/')}`
        );
      }
    }
    if (Object.keys(replacements).length) characterAlternates[characterSuffix] = replacements;
    if (Object.keys(colorReplacements).length) {
      characterSkinColorAlternates[characterSuffix] = colorReplacements;
    }
  }

  const colorAlternates = {};
  if (costume.hasSkinAlt?.toLowerCase() === 'true') {
    for (const [skinColor, suffix] of skinColorSuffixes.entries()) {
      const replacements = {};
      for (const referencedPath of actor.spritesheets) {
        const normalizedPath = referencedPath.replaceAll('\\', '/').replace(/^\/+/, '');
        const extension = path.posix.extname(normalizedPath);
        const alternatePath = `${normalizedPath.slice(0, -extension.length)}_${suffix}${extension}`;
        const sourceTexture = tryResolveCaseInsensitive(sourceCharacters, alternatePath);
        if (!sourceTexture) continue;
        const relativeTexture = path.relative(sourceCharacters, sourceTexture);
        copyFile(sourceTexture, path.join(targetCharacters, relativeTexture));
        replacements[`gfx/characters/${normalizedPath.toLowerCase()}`] = (
          `gfx/characters/${relativeTexture.replaceAll('\\', '/')}`
        );
      }
      if (Object.keys(replacements).length) colorAlternates[skinColor] = replacements;
    }
  }

  return {
    character: Object.keys(characterAlternates).length ? characterAlternates : null,
    characterColor: Object.keys(characterSkinColorAlternates).length
      ? characterSkinColorAlternates
      : null,
    color: Object.keys(colorAlternates).length ? colorAlternates : null
  };
}

function copyIcon(item) {
  const sourceIcon = resolveCaseInsensitive(path.join(sourceRoot, 'gfx', 'items', 'collectibles'), item.gfx);
  const targetName = path.basename(sourceIcon).toLowerCase();
  copyFile(sourceIcon, path.join(targetCollectibles, targetName));
  return `assets/isaac/gfx/collectibles/${targetName}`;
}

function copyCharacterSkinVariants() {
  const sourceCostumes = path.join(sourceCharacters, 'costumes');
  const targetCostumes = path.join(targetCharacters, 'costumes');
  for (const sprite of recolorableCharacterSprites) {
    const stem = path.basename(sprite, path.extname(sprite));
    for (const suffix of skinColorSuffixes) {
      const fileName = `${stem}_${suffix}.png`;
      copyFile(
        resolveCaseInsensitive(sourceCostumes, fileName),
        path.join(targetCostumes, fileName.toLowerCase())
      );
    }
  }
  for (const portrait of [
    'playerportrait_darkjudas.png',
    'playerportrait_lazarus2.png',
    'playerportrait_theforgotten.png'
  ]) {
    copyFile(
      resolveCaseInsensitive(sourceRoot, `gfx/ui/stage/${portrait}`),
      path.join(targetRoot, 'gfx', 'ui', 'stage', portrait)
    );
  }
  for (const texture of ['ghost.png', 'chain.png']) {
    copyFile(
      resolveCaseInsensitive(sourceCharacters, `costumes_forgottensoul/${texture}`),
      path.join(targetCharacters, 'costumes_forgottensoul', texture)
    );
  }
}

function createCatalogItem(gameId, item, costume, actorPath, actor, appearance = {}) {
  copyActorAndDependencies(actorPath, actor);
  const skinAlternates = copyActorAlternates(actor, costume);
  const englishName = englishNameFromIcon(item.gfx);
  const catalogItem = {
    id: `item-${gameId}`,
    gameId,
    name: localizedNames.get(gameId) || englishName,
    englishName,
    animation: path.basename(actorPath),
    icon: copyIcon(item),
    parts: appearance.parts || ['head'],
    priority: Number(costume.priority) || 0
  };
  if (appearance.tracks) catalogItem.tracks = appearance.tracks;
  if (appearance.hideBaseLayers) catalogItem.hideBaseLayers = appearance.hideBaseLayers;
  if (costume.skinColor !== undefined) catalogItem.skinColor = Number(costume.skinColor);
  if (costume.overwriteColor !== undefined) {
    catalogItem.overwriteColor = costume.overwriteColor.toLowerCase() === 'true';
  }
  if (costume.forceBodyColor !== undefined) {
    catalogItem.forceBodyColor = costume.forceBodyColor.toLowerCase() === 'true';
  }
  if (costume.forceHeadColor !== undefined) {
    catalogItem.forceHeadColor = costume.forceHeadColor.toLowerCase() === 'true';
  }
  if (costume.isFlying?.toLowerCase() === 'true') catalogItem.grantsFlight = true;
  if (skinAlternates?.character) catalogItem.skinAlternates = skinAlternates.character;
  if (skinAlternates?.characterColor) {
    catalogItem.characterSkinColorAlternates = skinAlternates.characterColor;
  }
  if (skinAlternates?.color) catalogItem.skinColorAlternates = skinAlternates.color;
  return catalogItem;
}

function buildCatalog() {
  if (!fs.existsSync(sourceCharacters)) {
    throw new Error(`找不到提取资源目录：${sourceRoot}`);
  }

  const items = parseItems();
  const costumes = parsePassiveCostumes();
  const catalog = [];
  const supported = [];
  const unsupported = [];
  copyCharacterSkinVariants();
  const costumeEntries = [...costumes.entries()].sort(([left], [right]) => left - right);

  for (const [gameId, costume] of costumeEntries) {
    if (gameId === brimstoneId) continue;
    const item = items.get(gameId);
    const reportBase = {
      gameId,
      name: item?.gfx ? englishNameFromIcon(item.gfx) : null,
      animation: costume.anm2path
    };
    if (!item) {
      unsupported.push({ ...reportBase, reason: 'missing-item-definition' });
      continue;
    }
    let actorPath;
    let actor;
    try {
      actorPath = resolveCaseInsensitive(sourceCharacters, costume.anm2path);
      actor = inspectActor(actorPath);
    } catch (error) {
      unsupported.push({ ...reportBase, reason: 'missing-or-invalid-actor', details: { message: error.message } });
      continue;
    }
    const analysis = analyzeStandardCostume(costume, actor);
    if (!analysis.supported) {
      unsupported.push({
        ...reportBase,
        reason: analysis.reason,
        ...(analysis.details ? { details: analysis.details } : {})
      });
      continue;
    }
    try {
      catalog.push(createCatalogItem(
        gameId,
        item,
        costume,
        actorPath,
        actor,
        analysis.appearance
      ));
      supported.push({
        ...reportBase,
        kind: analysis.kind,
        parts: analysis.appearance.parts,
        layers: actor.layers,
        ...(costume.skinColor !== undefined ? { skinColor: Number(costume.skinColor) } : {})
      });
    } catch (error) {
      unsupported.push({ ...reportBase, reason: 'missing-dependency', details: { message: error.message } });
    }
  }

  const brimstoneItem = items.get(brimstoneId);
  const brimstoneCostume = costumes.get(brimstoneId);
  const brimstoneActorPath = resolveCaseInsensitive(sourceCharacters, brimstoneCostume.anm2path);
  const brimstoneActor = inspectActor(brimstoneActorPath);
  const brimstone = createCatalogItem(
    brimstoneId,
    brimstoneItem,
    brimstoneCostume,
    brimstoneActorPath,
    brimstoneActor
  );
  brimstone.parts = ['head', 'body'];
  brimstone.hideBaseLayers = ['body', 'head'];
  brimstone.renderOrder = -100;
  brimstone.tracks = [
    { source: 'movement', layers: ['body'], placement: 'beforeBase' },
    { source: 'head', layers: ['head'] }
  ];
  catalog.push(brimstone);
  supported.push({
    gameId: brimstoneId,
    name: brimstone.englishName,
    animation: brimstoneCostume.anm2path,
    kind: 'special',
    parts: brimstone.parts,
    layers: brimstoneActor.layers
  });
  catalog.sort((left, right) => left.gameId - right.gameId);
  supported.sort((left, right) => left.gameId - right.gameId);
  unsupported.sort((left, right) => left.gameId - right.gameId);

  const standardItems = supported.filter(entry => entry.kind !== 'special');
  const counts = {
    head: standardItems.filter(entry => entry.kind === 'head').length,
    body: standardItems.filter(entry => entry.kind === 'body').length,
    mixed: standardItems.filter(entry => entry.kind === 'mixed').length,
    other: standardItems.filter(entry => entry.kind === 'other').length,
    special: supported.filter(entry => entry.kind === 'special').length,
    animatedOverlay: catalog.filter(item => item.tracks?.some(track => track.source === 'headOverlay')).length,
    flightGrant: catalog.filter(item => item.grantsFlight).length,
    colorOverride: catalog.filter(item => item.overwriteColor && Number.isInteger(item.skinColor)).length,
    characterAlternate: catalog.filter(item => item.skinAlternates).length,
    characterSkinColorAlternate: catalog.filter(item => item.characterSkinColorAlternates).length,
    skinColorAlternate: catalog.filter(item => item.skinColorAlternates).length
  };
  const characterAlternatesBySuffix = Object.fromEntries(costumeCharacterSuffixes().map(suffix => [
    suffix,
    catalog.filter(item => item.skinAlternates?.[suffix]).length
  ]));
  const unsupportedByReason = Object.fromEntries(
    [...new Set(unsupported.map(entry => entry.reason))]
      .sort()
      .map(reason => [reason, unsupported.filter(entry => entry.reason === reason).length])
  );

  const output = {
    generatedFrom: 'items.xml + costumes2.xml + gfx/characters/*.anm2',
    supportedItemCount: catalog.length,
    counts,
    items: catalog
  };
  const report = {
    generatedFrom: output.generatedFrom,
    summary: {
      passiveCostumeCount: costumes.size,
      supportedCount: supported.length,
      unsupportedCount: unsupported.length,
      supportedBreakdown: counts,
      characterAlternatesBySuffix,
      unsupportedByReason
    },
    supported,
    unsupported
  };
  fs.writeFileSync(path.join(targetRoot, 'item-catalog.json'), `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(path.join(targetRoot, 'item-catalog-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `已生成 ${catalog.length} 个道具（头部 ${counts.head}、身体 ${counts.body}、混合 ${counts.mixed}、其他 ${counts.other}、特例 ${counts.special}）；`
    + `${unsupported.length} 个暂未支持，详见 item-catalog-report.json。\n`
  );
}

buildCatalog();
