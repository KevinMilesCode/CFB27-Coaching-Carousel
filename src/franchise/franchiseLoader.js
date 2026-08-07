const fs = require('fs');
const os = require('os');
const path = require('path');
const FranchiseModule = require('madden-franchise');

const { FranchiseFile } = FranchiseModule;
const SAVE_DIRECTORY_PARTS = ['Documents', 'EA SPORTS College Football 27', 'saves'];

// Version-aware schema selection — NOT a hard pin.
//
// A save's header declares the schema version the game wrote it with. We read
// that, then pick a bundled schema for it: exact CFB27_<major>_<minor>.gz if we
// ship that build, else the NEWEST full CFB27_* schema whose major is <= the
// declared version, else a C27_* fallback by the same rule.
//
// The "<= declared" bound is load-bearing, not a nicety. Before the 2026-08-06
// game patch every schema was a superset of its predecessor, so "newest wins"
// was safe. That patch changed the Coach table's layout INCOMPATIBLY in both
// directions (measured: CFB27_833_0 reads zero named Coach fields on a
// pre-patch save, and CFB27_472_0 reads zero on a post-patch one). Coach is the
// table this whole tool is built on, so handing a save the wrong era's schema
// doesn't degrade gracefully — every field read comes back missing.
//
// A future game update (say 840) resolves automatically to the newest schema
// <= 840 with no code change; that is the point of the contract. Drop the new
// CFB27_<major>_<minor>.gz into schema/ and selection picks it up.
//
// Shared contract — the same picker ships in Dynasty Engine
// (app/src/saveio/cfb27/schema.ts, test/src/openSave.js). The schema files
// themselves come from CFB27-Modding-Knowledge/schemas/, which is their source
// of truth; copy from there rather than extracting a private copy.
const SCHEMA_DIRECTORY = path.resolve(__dirname, '..', '..', 'schema');

/**
 * Full save schemas in the schema dir matching `prefix`, newest first. The \d+
 * immediately after the prefix keeps FTC-tagged files (CFB27_FTC_*) out of save
 * selection by construction — those are mod-build schemas, never save schemas.
 */
function schemaVersionsIn(prefix) {
  let files = [];

  try {
    files = fs.readdirSync(SCHEMA_DIRECTORY);
  } catch (error) {
    return [];
  }

  const pattern = new RegExp(`^${prefix}_(\\d+)_(\\d+)\\.gz$`, 'i');
  const found = [];

  for (const fileName of files) {
    const match = pattern.exec(fileName);
    if (match) {
      found.push({
        name: fileName,
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10)
      });
    }
  }

  return found.sort((a, b) => b.major - a.major || b.minor - a.minor);
}

/**
 * Choose a schema file for a save's declared version. Exact build match wins;
 * otherwise the newest full CFB27_* schema with major <= the declared version;
 * if every bundled schema is newer than the save, the oldest bundled one
 * (nearest above); C27_* only as a last resort.
 */
function pickSchemaFile(declared) {
  const exactNames = [
    `CFB27_${declared.major}_${declared.minor}.gz`,
    `C27_${declared.major}_${declared.minor}.gz`
  ];

  for (const name of exactNames) {
    const candidate = path.join(SCHEMA_DIRECTORY, name);
    if (fs.existsSync(candidate)) {
      return { path: candidate, name, exact: true };
    }
  }

  for (const prefix of ['CFB27', 'C27']) {
    const all = schemaVersionsIn(prefix);
    if (!all.length) {
      continue;
    }

    const atOrBelow = all.find((schema) => schema.major <= declared.major); // list is newest-first
    const chosen = atOrBelow || all[all.length - 1];
    return { path: path.join(SCHEMA_DIRECTORY, chosen.name), name: chosen.name, exact: false };
  }

  throw new Error(`No CFB27 schema (.gz) was found in "${SCHEMA_DIRECTORY}".`);
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function getSaveDirectory() {
  return path.join(os.homedir(), ...SAVE_DIRECTORY_PARTS);
}

function getDynastyFiles(customSaveDirectory = null) {
  const saveDirectory = customSaveDirectory || getSaveDirectory();
  
  if (!fs.existsSync(saveDirectory)) {
    return [];
  }

  try {
    return fs
      .readdirSync(saveDirectory)
      .filter((fileName) => fileName.toLowerCase().startsWith('dynasty-'))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    return [];
  }
}

function normalizeDynastyName(input) {
  const dynastyName = String(input || '').trim().replace(/^["']|["']$/g, '');

  if (!dynastyName) {
    throw new Error('Enter a dynasty name or full path.');
  }

  return dynastyName;
}

function resolveDynastyPath(input, customSaveDirectory = null) {
  const sourceValue = normalizeDynastyName(input);
  const saveDirectory = customSaveDirectory || getSaveDirectory();

  if (sourceValue.includes('/') || sourceValue.includes('\\') || sourceValue.includes(':')) {
    if (fs.existsSync(sourceValue)) {
      return sourceValue;
    }

    throw new Error(`Dynasty file was not found: ${sourceValue}`);
  }

  if (!fs.existsSync(saveDirectory)) {
    throw new Error(`Save directory was not found: ${saveDirectory}`);
  }

  const directPath = path.join(saveDirectory, sourceValue);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const matchingFile = fs
    .readdirSync(saveDirectory)
    .find((fileName) => fileName.toLowerCase() === sourceValue.toLowerCase());

  if (matchingFile) {
    return path.join(saveDirectory, matchingFile);
  }

  throw new Error(`Dynasty file was not found: ${directPath}`);
}

function createBackup(filePath) {
  const backupPath = `${filePath}_backup_${getTimestamp()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Open a save with the schema its declared version calls for. `autoParse:false`
 * lets us read that version (the constructor computes it) before parsing, then
 * supply the chosen schema explicitly — madden-franchise's built-in picker would
 * otherwise fall back to an unrelated Madden/old-CFB schema and mis-parse.
 */
function createFranchise(filePath) {
  return new Promise((resolve, reject) => {
    let franchise;

    try {
      franchise = new FranchiseFile(filePath, {
        autoParse: false,
        schemaDirectory: SCHEMA_DIRECTORY,
        gameTypeOverride: 'college',
        gameYearOverride: 27
      });

      const declared = franchise.expectedSchemaVersion;
      const choice = pickSchemaFile(declared);

      franchise.settings.schemaOverride = {
        major: declared.major,
        minor: declared.minor,
        gameYear: declared.gameYear,
        path: choice.path
      };
    } catch (error) {
      reject(error);
      return;
    }

    franchise.on('ready', () => resolve(franchise));
    franchise.on('error', reject);
    franchise.parse();
  });
}

async function loadDynasty(input, customSaveDirectory = null) {
  const filePath = resolveDynastyPath(input, customSaveDirectory);
  const backupPath = createBackup(filePath);
  const franchise = await createFranchise(filePath);

  return {
    backupPath,
    filePath,
    franchise,
    saveDirectory: customSaveDirectory || getSaveDirectory()
  };
}

module.exports = {
  SCHEMA_DIRECTORY,
  getDynastyFiles,
  getSaveDirectory,
  loadDynasty,
  normalizeDynastyName,
  pickSchemaFile,
  resolveDynastyPath
};
