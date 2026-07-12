const { AssetService } = require('../services/assetService');
const { formatPosition } = require('../services/formatService');
const {
  EMPTY_REFERENCE,
  firstUsableString,
  getFieldNames,
  getRecordValue,
  isEmptyReference,
  numberValue,
  resolveTable
} = require('./tableUtils');

const TEAM_TABLE_UNIQUE_ID = 3359508968;
const CONFERENCE_TABLE_UNIQUE_ID = 3820706130;
const TEAM_SLOTS_TABLE_UNIQUE_ID = 2477738738;

const TEAM_FIELDS = [
  'AssetName',
  'Conference',
  'DisplayName',
  'LongName',
  'NickName',
  'NickNameAlt',
  'ShortName',
  'TEAM_DBASSETNAME',
  'TEAM_LOGO_ASSETNAME',
  'TEAM_PREFIX_NAME',
  'TEAM_VISIBLE',
  'TeamIndex',
  'TeamRank',
  'TeamPrestige',
  'HeadCoach',
  'OffensiveCoordinator',
  'DefensiveCoordinator',
  'SpecialTeamsCoach'
];

const CONFERENCE_FIELDS = [
  'name'
];

const TEAM_SLOTS_FIELDS = [
  'teamslots'
];

function getTeamSlotFields() {
  const fields = [];
  for (let i = 0; i <= 19; i++) {
    fields.push(`Team${i}`);
  }
  return fields;
}

const COACH_ASSIGNMENT_FIELDS = [
  ['HeadCoach', 'HeadCoach'],
  ['OffensiveCoordinator', 'OffensiveCoordinator'],
  ['DefensiveCoordinator', 'DefensiveCoordinator'],
  ['SpecialTeamsCoach', 'SpecialTeams']
];

class TeamRepository {
  constructor(franchise, resourcesRoot) {
    this.franchise = franchise;
    this.table = resolveTable(franchise, TEAM_TABLE_UNIQUE_ID, 'Team');
    this.conferenceTable = resolveTable(franchise, CONFERENCE_TABLE_UNIQUE_ID, 'Conference');
    this.teamSlotsTable = resolveTable(franchise, TEAM_SLOTS_TABLE_UNIQUE_ID, 'TeamSlots');
    this.assets = new AssetService(resourcesRoot);
    this.teams = [];
    this.byRef = new Map();
    this.byRecordIndex = new Map();
    this.byTeamIndex = new Map();
    this.assignmentByCoachRef = new Map();
    this.conferences = new Map();
    this.teamByLongName = new Map();
  }

  async load() {
    await this.table.readRecords(TEAM_FIELDS);

    try {
      await this.conferenceTable.readRecords();
    } catch (error) {
      console.warn('Failed to load conference table:', error.message);
    }

    try {
      await this.teamSlotsTable.readRecords([...TEAM_SLOTS_FIELDS, ...getTeamSlotFields()]);
    } catch (error) {
      console.warn('Failed to load teamSlots table:', error.message);
    }

    this.teams = [];
    this.byRef.clear();
    this.byRecordIndex.clear();
    this.byTeamIndex.clear();
    this.assignmentByCoachRef.clear();
    this.conferences.clear();
    this.teamByLongName.clear();

    // Load conferences
    for (const record of this.conferenceTable.records) {
      if (!record || record.isEmpty) {
        continue;
      }
      const conferenceName = firstUsableString(
        getRecordValue(record, 'Name'),
        getRecordValue(record, 'name'),
        getRecordValue(record, 'LongName'),
        getRecordValue(record, 'DisplayName'),
        getRecordValue(record, 'ConferenceName')
      );
      if (conferenceName) {
        this.conferences.set(record.index, {
          name: conferenceName,
          ref: this.conferenceTable.getBinaryReferenceToRecord(record.index)
        });
      }
    }

    // Load teams and index by LongName for conference matching
    for (const record of this.table.records) {
      if (!record || record.isEmpty) {
        continue;
      }

      const team = this.createTeam(record);
      this.teams.push(team);
      this.byRef.set(team.ref, team);
      this.byRecordIndex.set(record.index, team);

      if (team.teamIndex !== null) {
        this.byTeamIndex.set(team.teamIndex, team);
      }

      // Index by LongName for conference matching
      if (team.longName) {
        this.teamByLongName.set(team.longName.toLowerCase(), team);
      }
    }

    // Map teams to conferences using TeamSlots
    this.mapTeamsToConferences();

    this.indexCoachAssignments();
  }

  createTeam(record) {
    const longName = firstUsableString(getRecordValue(record, 'LongName'));
    const displayName = firstUsableString(getRecordValue(record, 'DisplayName'));
    const shortName = firstUsableString(getRecordValue(record, 'ShortName'));
    const prefixName = firstUsableString(getRecordValue(record, 'TEAM_PREFIX_NAME'));
    const nickName = firstUsableString(getRecordValue(record, 'NickName'), getRecordValue(record, 'NickNameAlt'));
    const assetName = firstUsableString(getRecordValue(record, 'AssetName'));
    const conference = firstUsableString(getRecordValue(record, ['Conference', 'ConferenceName']));
    const logoAssetName = firstUsableString(getRecordValue(record, 'TEAM_LOGO_ASSETNAME'));
    const databaseAssetName = firstUsableString(getRecordValue(record, 'TEAM_DBASSETNAME'));
    const name = firstUsableString(longName, displayName, prefixName, shortName, nickName, assetName, `Team ${record.index}`);
    const ref = this.table.getBinaryReferenceToRecord(record.index);
    const teamIndexRaw = getRecordValue(record, 'TeamIndex', null);
    const teamIndex = teamIndexRaw === null ? null : numberValue(teamIndexRaw, null);

    const team = {
      assetName,
      conference,
      conferenceLogoUrl: '',
      conferenceRef: null,
      databaseAssetName,
      displayName,
      index: record.index,
      logoAssetName,
      logoUrl: '',
      longName,
      name,
      nickName,
      prefixName,
      prestige: numberValue(getRecordValue(record, 'TeamPrestige', 0), 0),
      rank: numberValue(getRecordValue(record, 'TeamRank', 0), 0),
      ref,
      shortName,
      teamIndex,
      visible: getRecordValue(record, 'TEAM_VISIBLE', true)
    };

    team.logoUrl = this.assets.getTeamLogoUrl(team);
    return team;
  }

  mapTeamsToConferences() {
    // Build a map of TeamSlots records by their binary reference
    const teamSlotsByRef = new Map();
    for (const record of this.teamSlotsTable.records) {
      if (!record || record.isEmpty) {
        continue;
      }
      const ref = this.teamSlotsTable.getBinaryReferenceToRecord(record.index);
      teamSlotsByRef.set(ref, record);
    }

    // Build a map of Team records by their binary reference
    const teamByRef = new Map();
    for (const record of this.table.records) {
      if (!record || record.isEmpty) {
        continue;
      }
      const ref = this.table.getBinaryReferenceToRecord(record.index);
      teamByRef.set(ref, record);
    }

    // Track which teams get assigned to a conference
    const assignedTeamIndices = new Set();

    // Iterate through conferences and their TeamSlots references
    for (const [conferenceIndex, conference] of this.conferences) {
      const conferenceRecord = this.conferenceTable.records[conferenceIndex];
      if (!conferenceRecord) {
        continue;
      }

      // Get the TeamSlots reference from the Conference record
      const teamSlotsRef = getRecordValue(conferenceRecord, 'TeamSlots', EMPTY_REFERENCE);
      if (isEmptyReference(teamSlotsRef)) {
        continue;
      }

      // Find the TeamSlots record by reference
      const teamSlotsRecord = teamSlotsByRef.get(teamSlotsRef);
      if (!teamSlotsRecord) {
        continue;
      }

      // Match teams by Team0-Team19 fields
      for (let i = 0; i <= 19; i++) {
        const teamRef = getRecordValue(teamSlotsRecord, `Team${i}`, EMPTY_REFERENCE);
        if (isEmptyReference(teamRef)) {
          continue;
        }

        const teamRecord = teamByRef.get(teamRef);
        if (!teamRecord) {
          continue;
        }

        const team = this.byRecordIndex.get(teamRecord.index);
        if (team) {
          team.conference = conference.name;
          team.conferenceRef = conference.ref;
          team.conferenceLogoUrl = this.assets.getConferenceLogoUrl(conference.name);
          assignedTeamIndices.add(teamRecord.index);
        }
      }
    }

    // Mark unassigned teams as Independents
    for (const team of this.teams) {
      if (!assignedTeamIndices.has(team.index)) {
        team.conference = 'Independents';
        team.conferenceRef = null;
        team.conferenceLogoUrl = this.assets.getConferenceLogoUrl('Independents');
      }
    }
  }

  indexCoachAssignments() {
    for (const record of this.table.records) {
      if (!record || record.isEmpty) {
        continue;
      }

      const team = this.byRecordIndex.get(record.index);
      if (!team) {
        continue;
      }

      for (const [fieldName, position] of COACH_ASSIGNMENT_FIELDS) {
        const coachRef = getRecordValue(record, fieldName, EMPTY_REFERENCE);
        if (isEmptyReference(coachRef)) {
          continue;
        }

        if (!this.assignmentByCoachRef.has(coachRef)) {
          this.assignmentByCoachRef.set(coachRef, {
            position,
            positionLabel: formatPosition(position, false),
            team
          });
        }
      }
    }
  }

  getByRef(ref) {
    return this.byRef.get(ref) || null;
  }

  getByTeamIndex(teamIndex) {
    return this.byTeamIndex.get(numberValue(teamIndex, -1)) || null;
  }

  getAssignmentForCoach(coachRef) {
    return this.assignmentByCoachRef.get(coachRef) || null;
  }

  getUnknownTeam(ref = EMPTY_REFERENCE) {
    return {
      index: null,
      logoUrl: this.assets.getTeamLogoUrl(null),
      name: isEmptyReference(ref) ? 'No School' : 'Unknown School',
      ref
    };
  }

  toFilterOptions(teams) {
    return [...teams]
      .filter((team) => team && team.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({
        label: team.name,
        logoUrl: team.logoUrl,
        value: team.ref
      }));
  }
}

module.exports = {
  TEAM_TABLE_UNIQUE_ID,
  TeamRepository
};
