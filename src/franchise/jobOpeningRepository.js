const { EMPTY_REFERENCE, findFieldName, normalizeEnum, resolveTable } = require('./tableUtils');
const { formatPosition } = require('../services/formatService');

const JOB_OPENING_TABLE_UNIQUE_ID = 263453863;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function normalizeReasonKey(value) {
  const text = normalizeText(value);

  if (!text) {
    return 'unknown';
  }

  if (/fired|fire/.test(text)) {
    return 'fired';
  }

  if (/retired|retire/.test(text)) {
    return 'retired';
  }

  if (/pro|went pro|professional/.test(text)) {
    return 'pro';
  }

  if (/contract ending|contract end|contract expiring|expiring|expired|end of contract/.test(text)) {
    return 'contract-ending';
  }

  if (/resign|resigned/.test(text)) {
    return 'resigned';
  }

  return 'unknown';
}

function getReasonLabel(value) {
  const key = normalizeReasonKey(value);
  const labels = {
    fired: 'Fired',
    retired: 'Retired',
    pro: 'Went Pro',
    'contract-ending': 'Contract Ending',
    resigned: 'Resigned',
    unknown: 'Open Search'
  };

  return labels[key] || normalizeEnum(value) || 'Open Search';
}

function getFieldValues(record) {
  if (!record || !record.fieldsArray) {
    return [];
  }

  return record.fieldsArray
    .map((field) => ({
      key: field.key,
      value: record[field.key]
    }))
    .filter((field) => field.value !== null && field.value !== undefined && field.value !== '');
}

function getRecordFieldValue(record, aliases) {
  const fieldName = findFieldName(record, aliases);
  if (!fieldName) {
    return null;
  }

  return record[fieldName];
}

function compareTeamMatch(candidateTeamRef, candidateTeamName, recordValue) {
  if (!recordValue) {
    return false;
  }

  const text = String(recordValue).trim();
  if (!text) {
    return false;
  }

  if (candidateTeamRef && String(recordValue).trim() === String(candidateTeamRef).trim()) {
    return true;
  }

  if (candidateTeamName) {
    const normalizedValue = normalizeText(text);
    const teamName = normalizeText(candidateTeamName);
    if (normalizedValue === teamName || normalizedValue.includes(teamName) || teamName.includes(normalizedValue)) {
      return true;
    }
  }

  return false;
}

function getPositionAliases(candidatePosition) {
  const aliases = [];
  const values = [candidatePosition, formatPosition(candidatePosition, false), formatPosition(candidatePosition, true), normalizeEnum(candidatePosition)]
    .filter(Boolean)
    .map((value) => normalizeText(value));

  for (const value of values) {
    if (!value) {
      continue;
    }

    aliases.push(value);
    if (value.includes('head')) {
      aliases.push('headcoach');
      aliases.push('head coach');
      aliases.push('hc');
    }
    if (value.includes('offensive')) {
      aliases.push('offensive coordinator');
      aliases.push('oc');
    }
    if (value.includes('defensive')) {
      aliases.push('defensive coordinator');
      aliases.push('dc');
    }
  }

  return [...new Set(aliases)];
}

function comparePositionMatch(candidatePosition, recordValue) {
  if (!recordValue) {
    return false;
  }

  const candidateText = normalizeText(candidatePosition);
  const recordText = normalizeText(recordValue);

  if (!candidateText || !recordText) {
    return false;
  }

  const candidateValues = new Set([
    candidateText,
    normalizeText(formatPosition(candidatePosition, false)),
    normalizeText(formatPosition(candidatePosition, true)),
    normalizeText(normalizeEnum(candidatePosition))
  ]);

  return [...candidateValues].some((value) => value && (recordText === value || recordText.includes(value) || value.includes(recordText)));
}

function findBestOpeningRecord(records, candidate) {
  let bestRecord = null;
  let bestScore = -1;

  for (const record of records || []) {
    let score = 0;
    let hasTeamMatch = false;
    let hasPositionMatch = false;

    for (const field of getFieldValues(record)) {
      const key = normalizeText(field.key);
      if (!key) {
        continue;
      }

      if (!hasTeamMatch && (key.includes('team') || key.includes('school'))) {
        hasTeamMatch = compareTeamMatch(candidate.teamRef, candidate.teamName, field.value);
        if (hasTeamMatch) {
          score += 2;
        }
      }

      if (!hasPositionMatch && (key.includes('position') || key.includes('contract'))) {
        hasPositionMatch = comparePositionMatch(candidate.position, field.value);
        if (hasPositionMatch) {
          score += 1;
        }
      }
    }

    if (score > bestScore && (hasTeamMatch || hasPositionMatch)) {
      bestScore = score;
      bestRecord = record;
    }
  }

  return bestRecord;
}

function getOpeningReasonInfo(records, candidate) {
  const openingRecord = findBestOpeningRecord(records, candidate);
  const reasonValue = openingRecord ? getRecordFieldValue(openingRecord, ['Reason', 'OpeningReason', 'JobOpeningReason', 'VacancyReason', 'ReasonType', 'Cause']) : null;
  const normalizedKey = normalizeReasonKey(reasonValue);
  const label = getReasonLabel(reasonValue);

  return {
    label,
    reasonKey: normalizedKey,
    isFired: normalizedKey === 'fired',
    isRetired: normalizedKey === 'retired',
    isPro: normalizedKey === 'pro'
  };
}

class JobOpeningRepository {
  constructor(franchise) {
    this.franchise = franchise;
    this.table = null;
    this.records = [];
    this.previousJobFiredCache = new Map();
  }

  async load() {
    try {
      this.table = resolveTable(this.franchise, JOB_OPENING_TABLE_UNIQUE_ID, 'JobOpening');
    } catch (error) {
      console.warn('Failed to resolve JobOpening table:', error.message);
      this.table = null;
    }

    if (!this.table) {
      return;
    }

    await this.table.readRecords();
    this.records = (this.table.records || []).filter((record) => record && !record.isEmpty);
  }

  getOpeningReasonInfo(candidate) {
    return getOpeningReasonInfo(this.records, candidate);
  }

  getPreviousJobFiredInfo({ coach, currentTeam }) {
    const key = [coach && coach.ref, coach && coach.name, currentTeam && currentTeam.ref, currentTeam && currentTeam.name]
      .filter(Boolean)
      .join('|');

    if (this.previousJobFiredCache.has(key)) {
      return this.previousJobFiredCache.get(key);
    }

    const result = {
      isFired: false,
      reasonKey: ''
    };

    if (!coach || !this.records.length) {
      this.previousJobFiredCache.set(key, result);
      return result;
    }

    const teamRef = currentTeam && currentTeam.ref ? currentTeam.ref : coach.currentTeamRef;
    const teamName = currentTeam && currentTeam.name ? currentTeam.name : coach.currentTeamName;
    const headCoachAliases = getPositionAliases('HeadCoach');

    for (const record of this.records) {
      const fieldValues = getFieldValues(record);
      const teamMatches = fieldValues.some((field) => {
        const keyName = normalizeText(field.key);
        return (keyName.includes('team') || keyName.includes('school')) && compareTeamMatch(teamRef, teamName, field.value);
      });

      if (!teamMatches) {
        continue;
      }

      const headCoachMatches = fieldValues.some((field) => {
        const keyName = normalizeText(field.key);
        return (keyName.includes('position') || keyName.includes('contract')) && headCoachAliases.some((alias) => comparePositionMatch(alias, field.value));
      });

      if (!headCoachMatches) {
        continue;
      }

      const reasonValue = getRecordFieldValue(record, ['Reason', 'OpeningReason', 'JobOpeningReason', 'VacancyReason', 'ReasonType', 'Cause']);
      const reasonKey = normalizeReasonKey(reasonValue);
      if (reasonKey === 'fired') {
        result.isFired = true;
        result.reasonKey = reasonKey;
        break;
      }
    }

    this.previousJobFiredCache.set(key, result);
    return result;
  }
}

module.exports = {
  JOB_OPENING_TABLE_UNIQUE_ID,
  JobOpeningRepository,
  getOpeningReasonInfo
};
