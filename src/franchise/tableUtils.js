const EMPTY_REFERENCE = '00000000000000000000000000000000';

function getFieldNames(record) {
  if (!record || !record.fieldsArray) {
    return [];
  }

  return record.fieldsArray.map((field) => field.key);
}

function findFieldName(record, names) {
  if (!record) {
    return null;
  }

  for (const name of names) {
    if (record.getFieldByKey && record.getFieldByKey(name)) {
      return name;
    }
  }

  const fieldNames = getFieldNames(record);
  const lowerToActual = new Map(fieldNames.map((name) => [name.toLowerCase(), name]));

  for (const name of names) {
    const match = lowerToActual.get(name.toLowerCase());
    if (match) {
      return match;
    }
  }

  return null;
}

function getRecordValue(record, names, fallback = null) {
  const fieldName = Array.isArray(names) ? findFieldName(record, names) : findFieldName(record, [names]);
  if (!fieldName) {
    return fallback;
  }

  const value = record[fieldName];
  return value === null || value === undefined ? fallback : value;
}

function setRecordValue(record, names, value) {
  const fieldName = Array.isArray(names) ? findFieldName(record, names) : findFieldName(record, [names]);
  if (!fieldName) {
    throw new Error(`Missing field: ${Array.isArray(names) ? names.join(', ') : names}`);
  }

  record[fieldName] = value;
  return fieldName;
}

function hasUsableString(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim();
  return text.length > 0 && text.toLowerCase() !== 'none' && text.toLowerCase() !== 'null';
}

function firstUsableString(...values) {
  for (const value of values) {
    if (hasUsableString(value)) {
      return String(value).trim();
    }
  }

  return '';
}

function numberValue(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

function clampInteger(value, min, max) {
  const parsed = numberValue(value, min);
  return Math.max(min, Math.min(max, parsed));
}

function normalizeEnum(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPendingStatus(value) {
  const text = String(value || '').toLowerCase();
  return text === 'pending' || text.endsWith(':pending');
}

function normalizeReference(value) {
  if (typeof value !== 'string') {
    return EMPTY_REFERENCE;
  }

  return /^[01]{32}$/.test(value) ? value : EMPTY_REFERENCE;
}

function isEmptyReference(value) {
  return normalizeReference(value) === EMPTY_REFERENCE;
}

function parseReference(value) {
  const reference = normalizeReference(value);
  return {
    tableId: Number.parseInt(reference.slice(0, 15), 2),
    rowNumber: Number.parseInt(reference.slice(15), 2)
  };
}

function resolveTable(franchise, uniqueId, label = '') {
  const table = franchise.getTableByUniqueId && franchise.getTableByUniqueId(uniqueId);

  if (!table) {
    throw new Error(
      `Could not find franchise table${label ? ` (${label})` : ''} by uniqueId ${uniqueId}. The save schema may have changed.`
    );
  }

  return table;
}

function getTableDescriptor(table) {
  return {
    name: table.name,
    tableId: table.header && table.header.tableId,
    uniqueId: table.header && table.header.uniqueId,
    recordCapacity: table.header && table.header.recordCapacity,
    isArray: Boolean(table.isArray)
  };
}

module.exports = {
  EMPTY_REFERENCE,
  clampInteger,
  findFieldName,
  firstUsableString,
  getFieldNames,
  getRecordValue,
  getTableDescriptor,
  hasUsableString,
  isEmptyReference,
  isPendingStatus,
  normalizeEnum,
  normalizeReference,
  numberValue,
  parseReference,
  resolveTable,
  setRecordValue
};
