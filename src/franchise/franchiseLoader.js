const fs = require('fs');
const os = require('os');
const path = require('path');
const FranchiseModule = require('madden-franchise');

const Franchise = FranchiseModule.default || FranchiseModule;
const SAVE_DIRECTORY_PARTS = ['Documents', 'EA SPORTS College Football 27', 'saves'];
const CFB27_SCHEMA_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'node_modules',
  'madden-franchise',
  'data',
  'schemas',
  '27',
  'C27_468_2.gz'
);

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

async function createFranchise(filePath) {
  const settings = {
    gameTypeOverride: 'college',
    gameYearOverride: 27
  };

  if (fs.existsSync(CFB27_SCHEMA_PATH)) {
    settings.schemaOverride = {
      major: 468,
      minor: 2,
      gameYear: 27,
      path: CFB27_SCHEMA_PATH
    };
  }

  try {
    return await Franchise.create(filePath, settings);
  } catch (error) {
    if (!settings.schemaOverride) {
      throw error;
    }

    return Franchise.create(filePath, {
      gameTypeOverride: 'college',
      gameYearOverride: 27
    });
  }
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
  CFB27_SCHEMA_PATH,
  getDynastyFiles,
  getSaveDirectory,
  loadDynasty,
  normalizeDynastyName,
  resolveDynastyPath
};
