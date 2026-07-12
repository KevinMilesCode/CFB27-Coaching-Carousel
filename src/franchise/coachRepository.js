const { formatCoachName, formatEnum, formatPosition } = require('../services/formatService');
const {
  EMPTY_REFERENCE,
  firstUsableString,
  getRecordValue,
  hasUsableString,
  isPendingStatus,
  numberValue,
  resolveTable
} = require('./tableUtils');

const COACH_TABLE_UNIQUE_ID = 1860529246;
const COACH_FIELDS = [
  'Age',
  'FirstName',
  'LastName',
  'Name',
  'TeamIndex',
  'Position',
  'PrevPosition',
  'ContractStatus',
  'ContractYearsRemaining',
  'ContractLength',
  'CurrentJobSecurityPercentage',
  'CurrentJobSecurityPercentageRank',
  'CurrentJobSecurityStatus',
  'SeasonStartJobSecurityStatus',
  'COACH_FIREREPORTED',
  'COACH_LASTTEAMFIRED',
  'COACH_LASTTEAMRESIGNED',
  'COACH_RESIGNREPORTED',
  'IsUserControlled',
  'Level',
  'SeasonsWithTeam',
  'YearsCoaching',
  'CoachPrestige',
  'CoachPrestigeScore',
  'NumContractOffers'
];

class CoachRepository {
  constructor(franchise, teamRepository) {
    this.franchise = franchise;
    this.teamRepository = teamRepository;
    this.table = resolveTable(franchise, COACH_TABLE_UNIQUE_ID, 'Coach');
    this.coaches = [];
    this.byRef = new Map();
    this.byRecordIndex = new Map();
  }

  async load() {
    await this.table.readRecords(COACH_FIELDS);

    this.coaches = [];
    this.byRef.clear();
    this.byRecordIndex.clear();

    for (const record of this.table.records) {
      if (!record || record.isEmpty) {
        continue;
      }

      const coach = this.createCoach(record);
      if (!coach) {
        continue;
      }

      this.coaches.push(coach);
      this.byRef.set(coach.ref, coach);
      this.byRecordIndex.set(record.index, coach);
    }
  }

  createCoach(record) {
    const firstName = firstUsableString(getRecordValue(record, 'FirstName'));
    const lastName = firstUsableString(getRecordValue(record, 'LastName'));
    const fallbackName = firstUsableString(getRecordValue(record, 'Name'));
    const name = formatCoachName(firstName, lastName, fallbackName);

    if (!hasUsableString(name) || name === 'Unknown Coach') {
      return null;
    }

    const ref = this.table.getBinaryReferenceToRecord(record.index);
    const teamAssignment = this.teamRepository.getAssignmentForCoach(ref);
    const teamFromIndex = this.teamRepository.getByTeamIndex(getRecordValue(record, 'TeamIndex', null));
    const currentTeam = teamAssignment ? teamAssignment.team : teamFromIndex;
    const rawPosition = firstUsableString(getRecordValue(record, 'Position'), teamAssignment && teamAssignment.position);
    const contractStatus = firstUsableString(getRecordValue(record, 'ContractStatus'));
    const jobSecurityStatus = firstUsableString(getRecordValue(record, 'CurrentJobSecurityStatus'));

    return {
      age: numberValue(getRecordValue(record, 'Age', 0), 0),
      contractLength: numberValue(getRecordValue(record, 'ContractLength', 0), 0),
      contractStatus,
      contractStatusLabel: formatEnum(contractStatus),
      contractYearsRemaining: numberValue(getRecordValue(record, 'ContractYearsRemaining', 0), 0),
      currentTeamName: currentTeam ? currentTeam.name : 'No School',
      currentTeamRef: currentTeam ? currentTeam.ref : EMPTY_REFERENCE,
      currentTeamLogoUrl: currentTeam ? currentTeam.logoUrl : this.teamRepository.getUnknownTeam().logoUrl,
      fireReported: Boolean(getRecordValue(record, 'COACH_FIREREPORTED', false)),
      firstName,
      isUserControlled: Boolean(getRecordValue(record, 'IsUserControlled', false)),
      jobSecurityPercentage: numberValue(getRecordValue(record, 'CurrentJobSecurityPercentage', 0), 0),
      jobSecurityRank: numberValue(getRecordValue(record, 'CurrentJobSecurityPercentageRank', 0), 0),
      jobSecurityStatus,
      jobSecurityStatusLabel: formatEnum(jobSecurityStatus),
      lastName,
      lastTeamFired: numberValue(getRecordValue(record, 'COACH_LASTTEAMFIRED', -1), -1),
      lastTeamResigned: numberValue(getRecordValue(record, 'COACH_LASTTEAMRESIGNED', -1), -1),
      level: numberValue(getRecordValue(record, 'Level', 0), 0),
      name,
      numContractOffers: numberValue(getRecordValue(record, 'NumContractOffers', 0), 0),
      position: rawPosition,
      positionLabel: formatPosition(rawPosition, false),
      prestige: firstUsableString(getRecordValue(record, 'CoachPrestige')),
      prestigeScore: numberValue(getRecordValue(record, 'CoachPrestigeScore', 0), 0),
      record,
      ref,
      resignReported: Boolean(getRecordValue(record, 'COACH_RESIGNREPORTED', false)),
      rowIndex: record.index,
      seasonsWithTeam: numberValue(getRecordValue(record, 'SeasonsWithTeam', 0), 0),
      teamAssignmentPosition: teamAssignment ? teamAssignment.positionLabel : '',
      teamIndex: numberValue(getRecordValue(record, 'TeamIndex', -1), -1),
      yearsCoaching: numberValue(getRecordValue(record, 'YearsCoaching', 0), 0)
    };
  }

  getByRef(ref) {
    return this.byRef.get(ref) || null;
  }

  getByRowIndex(rowIndex) {
    return this.byRecordIndex.get(numberValue(rowIndex, -1)) || null;
  }

  recalculateContractOfferCounts(carouselRecords) {
    const counts = new Map();

    for (const record of carouselRecords) {
      if (!record || record.isEmpty || !isPendingStatus(getRecordValue(record, 'Status'))) {
        continue;
      }

      const staffPersonRef = getRecordValue(record, 'StaffPerson', EMPTY_REFERENCE);
      counts.set(staffPersonRef, (counts.get(staffPersonRef) || 0) + 1);
    }

    for (const coach of this.coaches) {
      if (coach.record && coach.record.getFieldByKey && coach.record.getFieldByKey('NumContractOffers')) {
        const nextCount = counts.get(coach.ref) || 0;
        coach.record.NumContractOffers = nextCount;
        coach.numContractOffers = nextCount;
      }
    }
  }

  toDto(coach) {
    return {
      age: coach.age,
      contractStatus: coach.contractStatus,
      contractStatusLabel: coach.contractStatusLabel,
      contractYearsRemaining: coach.contractYearsRemaining,
      currentTeamLogoUrl: coach.currentTeamLogoUrl,
      currentTeamName: coach.currentTeamName,
      currentTeamRef: coach.currentTeamRef,
      fireReported: coach.fireReported,
      firstName: coach.firstName,
      isUserControlled: coach.isUserControlled,
      jobSecurityPercentage: coach.jobSecurityPercentage,
      jobSecurityStatus: coach.jobSecurityStatus,
      jobSecurityStatusLabel: coach.jobSecurityStatusLabel,
      lastName: coach.lastName,
      level: coach.level,
      name: coach.name,
      numContractOffers: coach.numContractOffers,
      position: coach.position,
      positionLabel: coach.positionLabel,
      prestige: coach.prestige,
      prestigeScore: coach.prestigeScore,
      ref: coach.ref,
      resignReported: coach.resignReported,
      rowIndex: coach.rowIndex,
      searchText: [
        coach.name,
        coach.currentTeamName,
        coach.positionLabel,
        coach.contractStatusLabel,
        coach.jobSecurityStatusLabel
      ]
        .join(' ')
        .toLowerCase(),
      seasonsWithTeam: coach.seasonsWithTeam,
      teamAssignmentPosition: coach.teamAssignmentPosition,
      yearsCoaching: coach.yearsCoaching
    };
  }

  getPickerCoaches() {
    return this.coaches
      .map((coach) => this.toDto(coach))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

module.exports = {
  COACH_TABLE_UNIQUE_ID,
  CoachRepository
};
