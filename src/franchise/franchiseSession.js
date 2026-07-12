const path = require('path');
const { CoachRepository } = require('./coachRepository');
const { CarouselRepository } = require('./carouselRepository');
const { ContractOfferRepository } = require('./contractOfferRepository');
const { JobOpeningRepository } = require('./jobOpeningRepository');
const { TeamRepository } = require('./teamRepository');
const { getRecordValue, getTableDescriptor, EMPTY_REFERENCE } = require('./tableUtils');
const { loadDynasty } = require('./franchiseLoader');
const { formatEnum, formatPosition } = require('../services/formatService');
const { validateReplacement } = require('../services/replacementService');
const { saveCarousel } = require('../services/saveService');
const {
  applyAuthoritativeOrdering,
  buildGroupMap,
  moveRecordByInterest,
  sortOfferRecords
} = require('../services/sortingService');

class FranchiseSession {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.resourcesRoot = path.join(projectRoot, 'Resources');
    this.reset();
  }

  reset() {
    this.backupPath = '';
    this.carouselRepository = null;
    this.coachRepository = null;
    this.contractOfferRepository = null;
    this.jobOpeningRepository = null;
    this.dirty = false;
    this.filePath = '';
    this.franchise = null;
    this.lastWarnings = [];
    this.teamRepository = null;
  }

  ensureLoaded() {
    if (!this.franchise) {
      throw new Error('Load a dynasty before editing.');
    }
  }

  async load(dynastyName, customSaveDirectory = null) {
    this.reset();

    const loaded = await loadDynasty(dynastyName, customSaveDirectory);
    this.franchise = loaded.franchise;
    this.filePath = loaded.filePath;
    this.backupPath = loaded.backupPath;

    this.teamRepository = new TeamRepository(this.franchise, this.resourcesRoot);
    this.carouselRepository = new CarouselRepository(this.franchise);
    this.contractOfferRepository = new ContractOfferRepository(this.franchise, this.carouselRepository);
    this.jobOpeningRepository = new JobOpeningRepository(this.franchise);

    await Promise.all([
      this.teamRepository.load(),
      this.carouselRepository.load(),
      this.contractOfferRepository.load(),
      this.jobOpeningRepository.load()
    ]);

    this.coachRepository = new CoachRepository(this.franchise, this.teamRepository);
    await this.coachRepository.load();

    return this.getState({
      message: 'Dynasty loaded.',
      saveDirectory: loaded.saveDirectory
    });
  }

  getPendingRecords() {
    return this.carouselRepository.getPendingRecords();
  }

  syncOrdering() {
    const pendingRecords = this.getPendingRecords();
    const groupMap = applyAuthoritativeOrdering(this.carouselRepository, pendingRecords);
    this.lastWarnings = this.contractOfferRepository.updateOrderingForGroups(groupMap, (records) =>
      sortOfferRecords(records, this.carouselRepository)
    );
    this.dirty = true;
    return this.lastWarnings;
  }

  updateInterest({ rowIndex, field, value }) {
    this.ensureLoaded();

    this.carouselRepository.updateInterest(rowIndex, field, value);
    if (field === 'teamInterest') {
      this.syncOrdering();
    } else {
      this.dirty = true;
    }

    return this.getState({
      message: 'Interest updated.'
    });
  }

  moveCandidate({ rowIndex, direction }) {
    this.ensureLoaded();

    moveRecordByInterest(this.carouselRepository, rowIndex, direction);
    this.syncOrdering();

    return this.getState({
      message: 'Candidate order updated.'
    });
  }

  replaceCoach({ rowIndex, coachRowIndex, force = false }) {
    this.ensureLoaded();

    const candidateRecord = this.carouselRepository.getRecordByIndex(rowIndex);
    const replacementCoach = this.coachRepository.getByRowIndex(coachRowIndex);
    const pendingRecords = this.getPendingRecords();
    const validation = validateReplacement({
      candidateRecord,
      carouselRepository: this.carouselRepository,
      force,
      pendingRecords,
      replacementCoach
    });

    if (!validation.ok && validation.code === 'COACH_EXISTS_ELSEWHERE') {
      return {
        requiresConfirmation: true,
        message: validation.message,
        conflicts: validation.conflicts
      };
    }

    if (!validation.ok) {
      throw new Error(validation.message);
    }

    this.carouselRepository.replaceCoach(
      rowIndex,
      replacementCoach.ref,
      replacementCoach.currentTeamRef || EMPTY_REFERENCE
    );
    this.coachRepository.recalculateContractOfferCounts(this.carouselRepository.table.records);
    this.dirty = true;

    return this.getState({
      message: `${replacementCoach.name} selected.`
    });
  }

  async save() {
    this.ensureLoaded();

    const result = await saveCarousel({
      carouselRepository: this.carouselRepository,
      coachRepository: this.coachRepository,
      contractOfferRepository: this.contractOfferRepository,
      franchise: this.franchise
    });

    this.dirty = false;
    this.lastWarnings = result.warnings || [];

    return this.getState({
      message: result.message
    });
  }

  getState(extra = {}) {
    this.ensureLoaded();

    const pendingRecords = this.getPendingRecords();
    const groupMap = buildGroupMap(pendingRecords, this.carouselRepository);
    const rankByRowIndex = new Map();

    for (const groupRecords of groupMap.values()) {
      sortOfferRecords(groupRecords, this.carouselRepository).forEach((record, index) => {
        rankByRowIndex.set(record.index, index + 1);
      });
    }

    const candidates = pendingRecords
      .map((record) => this.toCandidateDto(record, rankByRowIndex))
      .filter((candidate) => candidate.isValidTeam);
    const hiringTeams = new Map();
    const positions = new Map();
    const conferences = new Map();
    const prestiges = new Map();

    const renderPrestigeLabel = (value) => {
      const prestigeValue = Number(value || 0);
      const normalized = Math.max(0, Math.min(10, prestigeValue)) / 2;
      const fullStars = Math.floor(normalized);
      const hasHalfStar = normalized - fullStars >= 0.5;
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
      const stars = `${'★'.repeat(fullStars)}${hasHalfStar ? '⯪' : ''}${'☆'.repeat(emptyStars)}`;
      return `${stars} (${normalized.toFixed(1)})`;
    };

    for (const candidate of candidates) {
      hiringTeams.set(candidate.hiringTeamRef, {
        label: candidate.hiringTeamName,
        logoUrl: candidate.hiringTeamLogoUrl,
        value: candidate.hiringTeamRef
      });
      positions.set(candidate.position, {
        label: candidate.positionLabel,
        value: candidate.position
      });
      if (candidate.conference) {
        conferences.set(candidate.conference, {
          label: candidate.conference,
          value: candidate.conference
        });
      }
      if (candidate.teamPrestige !== null && candidate.teamPrestige !== undefined) {
        prestiges.set(String(candidate.teamPrestige), {
          label: renderPrestigeLabel(candidate.teamPrestige),
          value: String(candidate.teamPrestige)
        });
      }
    }

    return {
      backupPath: this.backupPath,
      candidates,
      coaches: this.coachRepository.getPickerCoaches(),
      dirty: this.dirty,
      filePath: this.filePath,
      filters: {
        conferences: [...conferences.values()].sort((a, b) => a.label.localeCompare(b.label)),
        positions: [...positions.values()].sort((a, b) => a.label.localeCompare(b.label)),
        prestiges: [...prestiges.values()].sort((a, b) => Number(b.value) - Number(a.value)),
        teams: [...hiringTeams.values()].sort((a, b) => a.label.localeCompare(b.label))
      },
      message: extra.message || '',
      saveDirectory: extra.saveDirectory,
      stats: {
        coaches: this.coachRepository.coaches.length,
        groups: groupMap.size,
        pendingOffers: candidates.length
      },
      tables: {
        carousel: getTableDescriptor(this.carouselRepository.table),
        coach: getTableDescriptor(this.coachRepository.table),
        contractOffer: getTableDescriptor(this.contractOfferRepository.table),
        team: getTableDescriptor(this.teamRepository.table)
      },
      warnings: [...(this.lastWarnings || [])]
    };
  }

  toCandidateDto(record, rankByRowIndex) {
    const staffPersonRef = this.carouselRepository.get(record, 'staffPerson', EMPTY_REFERENCE);
    const hiringTeamRef = this.carouselRepository.get(record, 'team', EMPTY_REFERENCE);
    const staffPersonTeamRef = this.carouselRepository.get(record, 'staffPersonTeam', EMPTY_REFERENCE);
    const position = this.carouselRepository.get(record, 'contractPosition', 'Unknown');
    const coach = this.coachRepository.getByRef(staffPersonRef);
    const hiringTeam = this.teamRepository.getByRef(hiringTeamRef) || this.teamRepository.getUnknownTeam(hiringTeamRef);
    const currentTeam =
      this.teamRepository.getByRef(staffPersonTeamRef) ||
      (coach && this.teamRepository.getByRef(coach.currentTeamRef)) ||
      this.teamRepository.getUnknownTeam(staffPersonTeamRef);
    const coachTeamMismatch =
      coach &&
      coach.currentTeamRef &&
      coach.currentTeamRef !== EMPTY_REFERENCE &&
      staffPersonTeamRef !== coach.currentTeamRef;

    const openingReasonInfo = this.jobOpeningRepository.getOpeningReasonInfo({
      position,
      teamName: hiringTeam.name,
      teamRef: hiringTeamRef,
      positionLabel: formatPosition(position)
    });
    const previousJobFiredInfo = this.jobOpeningRepository.getPreviousJobFiredInfo({
      coach,
      currentTeam
    });

    const openingReasons = [];
    if (openingReasonInfo.isFired) {
      openingReasons.push('Fired');
    }
    if (openingReasonInfo.isRetired) {
      openingReasons.push('Retired');
    }
    if (openingReasonInfo.isPro) {
      openingReasons.push('Went Pro');
    }
    if (!openingReasons.length && openingReasonInfo.label && openingReasonInfo.label !== 'Open Search') {
      openingReasons.push(openingReasonInfo.label);
    }
    if (!openingReasons.length) {
      openingReasons.push('Open Search');
    }

    const isValidTeam = Boolean(hiringTeam && hiringTeam.name && !/unknown school|no school/i.test(hiringTeam.name));

    return {
      adjustedInterest: this.carouselRepository.getAdjustedInterest(record),
      baseInterest: this.carouselRepository.getBaseInterest(record),
      coachContractStatus: coach ? coach.contractStatusLabel : 'Unknown',
      coachCurrentTeamName: coach ? coach.currentTeamName : currentTeam.name,
      coachFireReported: coach ? coach.fireReported : false,
      coachJobSecurity: coach ? coach.jobSecurityStatusLabel : 'Unknown',
      coachJobSecurityPercentage: coach ? coach.jobSecurityPercentage : 0,
      coachName: coach ? coach.name : 'Unknown Coach',
      coachPosition: coach ? coach.positionLabel : 'Unknown',
      coachPreviousFired: Boolean(previousJobFiredInfo.isFired),
      coachRef: staffPersonRef,
      coachResignReported: coach ? coach.resignReported : false,
      conference: hiringTeam.conference || '',
      currentTeamLogoUrl: currentTeam.logoUrl,
      currentTeamName: currentTeam.name,
      currentTeamRef: currentTeam.ref,
      groupKey: this.carouselRepository.getGroupKey(record),
      hiringTeamConferenceLogoUrl: hiringTeam.conferenceLogoUrl || '',
      hiringTeamLogoUrl: hiringTeam.logoUrl,
      hiringTeamName: hiringTeam.name,
      hiringTeamRef,
      id: record.index,
      offerIndex: this.carouselRepository.getOfferIndex(record),
      openingReason: openingReasons.join(' • '),
      openingReasonLabel: openingReasonInfo.label,
      openingReasonKey: openingReasonInfo.reasonKey,
      position,
      positionLabel: formatPosition(position),
      rank: rankByRowIndex.get(record.index) || 0,
      rowIndex: record.index,
      searchText: [
        coach ? coach.name : '',
        currentTeam.name,
        hiringTeam.name,
        formatPosition(position),
        formatEnum(position),
        coach ? coach.contractStatusLabel : '',
        coach ? coach.jobSecurityStatusLabel : ''
      ]
        .join(' ')
        .toLowerCase(),
      staffPersonTeamRef,
      status: getRecordValue(record, 'Status', ''),
      teamInterest: this.carouselRepository.getTeamInterest(record),
      teamMismatch: Boolean(coachTeamMismatch),
      teamPrestige: hiringTeam.prestige || 0,
      isValidTeam
    };
  }
}

module.exports = {
  FranchiseSession
};
