const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'm')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function walkPngFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPngFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(fullPath);
    }
  }

  return files;
}

class AssetService {
  constructor(resourcesRoot) {
    this.resourcesRoot = resourcesRoot;
    this.teamLogoIndex = this.createIndex(path.join(resourcesRoot, 'teams'));
    this.conferenceLogoIndex = this.createIndex(path.join(resourcesRoot, 'conferences'));
  }

  createIndex(root) {
    const index = new Map();
    const files = walkPngFiles(root);

    for (const filePath of files) {
      const baseName = path.basename(filePath, '.png');
      const slug = slugify(baseName);

      if (!index.has(slug)) {
        index.set(slug, pathToFileURL(filePath).href);
      }
    }

    return index;
  }

  getTeamLogoUrl(team) {
    if (!team) {
      return '';
    }

    // Direct Texas A&M check - bypass all slugification
    const nameFields = [team.name, team.longName, team.shortName, team.displayName, team.nickName];
    for (const name of nameFields) {
      if (name && name.toLowerCase().includes('texas') && (name.toLowerCase().includes('a&m') || name.toLowerCase().includes('am'))) {
        if (this.teamLogoIndex.has('texas-am')) {
          return this.teamLogoIndex.get('texas-am');
        }
      }
    }

    const candidates = [
      team.assetName,
      team.logoAssetName,
      team.databaseAssetName,
      team.displayName,
      team.longName,
      team.shortName,
      team.nickName,
      `${team.longName || ''} ${team.nickName || ''}`,
      `${team.shortName || ''} ${team.nickName || ''}`
    ];

    for (const candidate of candidates) {
      const slug = slugify(candidate);
      if (slug && this.teamLogoIndex.has(slug)) {
        return this.teamLogoIndex.get(slug);
      }
    }

    return this.teamLogoIndex.get('fbs-generic') || this.teamLogoIndex.get('fcs-generic') || '';
  }

  getConferenceLogoUrl(conferenceName) {
    if (!conferenceName) {
      return '';
    }

    const slug = slugify(conferenceName);
    if (slug && this.conferenceLogoIndex.has(slug)) {
      return this.conferenceLogoIndex.get(slug);
    }

    return '';
  }

  getIconUrl(iconName) {
    const iconPath = path.resolve(this.resourcesRoot, '..', 'node_modules', 'lucide-static', 'icons', `${iconName}.svg`);
    return fs.existsSync(iconPath) ? pathToFileURL(iconPath).href : '';
  }
}

module.exports = {
  AssetService,
  slugify
};
