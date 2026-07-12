const {
  EMPTY_REFERENCE,
  clampInteger,
  findFieldName,
  getRecordValue,
  isPendingStatus,
  numberValue,
  resolveTable,
  setRecordValue
} = require('./tableUtils');

const CAROUSEL_TABLE_UNIQUE_ID = 674348040;
const FIELD_ALIASES = {
  adjustedInterest: ['AdjustedStaffPersonInterestInOffer'],
  baseInterest: ['BaseStaffPersonInterestInOffer', 'BaseStaffPersonInterestinOffer'],
  contractPosition: ['ContractPosition'],
  index: ['OfferIndex', 'Index'],
  staffPerson: ['StaffPerson'],
  staffPersonTeam: ['StaffPersonTeam'],
  status: ['Status'],
  team: ['Team'],
  teamInterest: ['TeamInterestInStaffPerson', 'TeamInterestinStaffPerson']
};

const CAROUSEL_FIELDS = [
  ...FIELD_ALIASES.adjustedInterest,
  ...FIELD_ALIASES.baseInterest,
  'ContractExpectationsByYear',
  ...FIELD_ALIASES.contractPosition,
  'ExpectedContractProgramPoints',
  'ExperiencePoints',
  'Length',
  'OfferedContractProgramPoints',
  ...FIELD_ALIASES.index,
  ...FIELD_ALIASES.staffPerson,
  ...FIELD_ALIASES.staffPersonTeam,
  ...FIELD_ALIASES.status,
  ...FIELD_ALIASES.team,
  ...FIELD_ALIASES.teamInterest
];

const EDITABLE_INTEREST_FIELDS = {
  adjustedInterest: {
    label: 'Adjusted Staff Interest',
    max: 100,
    min: 0
  },
  baseInterest: {
    label: 'Base Staff Interest',
    max: 280,
    min: 0
  },
  teamInterest: {
    label: 'Team Interest',
    max: 100,
    min: 0
  }
};

class CarouselRepository {
  constructor(franchise) {
    this.franchise = franchise;
    this.table = resolveTable(franchise, CAROUSEL_TABLE_UNIQUE_ID, 'StaffPersonContractOffer');
  }

  async load() {
    await this.table.readRecords(CAROUSEL_FIELDS);
  }

  getFieldName(record, key) {
    return findFieldName(record, FIELD_ALIASES[key] || [key]);
  }

  get(record, key, fallback = null) {
    return getRecordValue(record, FIELD_ALIASES[key] || [key], fallback);
  }

  set(record, key, value) {
    return setRecordValue(record, FIELD_ALIASES[key] || [key], value);
  }

  getPendingRecords() {
    return this.table.records.filter(
      (record) => record && !record.isEmpty && isPendingStatus(this.get(record, 'status'))
    );
  }

  getRecordByIndex(rowIndex) {
    const index = numberValue(rowIndex, -1);
    const record = this.table.records[index];

    if (!record || record.isEmpty) {
      throw new Error(`Offer row ${rowIndex} was not found.`);
    }

    return record;
  }

  getOfferReference(record) {
    return this.table.getBinaryReferenceToRecord(record.index);
  }

  getGroupKey(record) {
    return `${this.get(record, 'team', EMPTY_REFERENCE)}|${this.get(record, 'contractPosition', 'Unknown')}`;
  }

  updateInterest(rowIndex, interestKey, rawValue) {
    if (!EDITABLE_INTEREST_FIELDS[interestKey]) {
      throw new Error(`Field ${interestKey} is not editable.`);
    }

    const record = this.getRecordByIndex(rowIndex);
    const fieldName = this.getFieldName(record, interestKey);

    if (!fieldName) {
      throw new Error(`Field ${interestKey} was not found on the offer table.`);
    }

    const field = record.getFieldByKey(fieldName);
    const configured = EDITABLE_INTEREST_FIELDS[interestKey];
    const min = Number.isFinite(field && Number(field.offset.minValue)) ? Number(field.offset.minValue) : configured.min;
    const max = Number.isFinite(field && Number(field.offset.maxValue)) ? Number(field.offset.maxValue) : configured.max;
    const nextValue = clampInteger(rawValue, min, max);

    record[fieldName] = nextValue;
    return record;
  }

  replaceCoach(rowIndex, coachRef, coachTeamRef) {
    const record = this.getRecordByIndex(rowIndex);
    this.set(record, 'staffPerson', coachRef);
    this.set(record, 'staffPersonTeam', coachTeamRef || EMPTY_REFERENCE);
    return record;
  }

  setOfferIndex(record, index) {
    const fieldName = this.getFieldName(record, 'index');
    if (fieldName) {
      record[fieldName] = index;
    }
  }

  getOfferIndex(record) {
    return numberValue(this.get(record, 'index', 0), 0);
  }

  getTeamInterest(record) {
    return numberValue(this.get(record, 'teamInterest', 0), 0);
  }

  getBaseInterest(record) {
    return numberValue(this.get(record, 'baseInterest', 0), 0);
  }

  getAdjustedInterest(record) {
    return numberValue(this.get(record, 'adjustedInterest', 0), 0);
  }
}

module.exports = {
  CAROUSEL_TABLE_UNIQUE_ID,
  CarouselRepository,
  EDITABLE_INTEREST_FIELDS,
  FIELD_ALIASES
};
