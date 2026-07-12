const { normalizeEnum } = require('../franchise/tableUtils');

const POSITION_LABELS = {
  HeadCoach: 'HC',
  OffensiveCoordinator: 'OC',
  DefensiveCoordinator: 'DC',
  SpecialTeams: 'ST',
  NumCollegeCoaches: 'ST'
};

const POSITION_LONG_LABELS = {
  HeadCoach: 'Head Coach',
  OffensiveCoordinator: 'Offensive Coordinator',
  DefensiveCoordinator: 'Defensive Coordinator',
  SpecialTeams: 'Special Teams',
  NumCollegeCoaches: 'Special Teams'
};

function formatPosition(value, compact = true) {
  const key = String(value || '').trim();
  if (!key) {
    return compact ? 'N/A' : 'Unknown';
  }

  return (compact ? POSITION_LABELS[key] : POSITION_LONG_LABELS[key]) || normalizeEnum(key) || key;
}

function formatEnum(value) {
  return normalizeEnum(value) || 'Unknown';
}

function formatCoachName(firstName, lastName, fallback = '') {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim();

  if (fullName && fullName.toLowerCase() !== 'none') {
    return fullName;
  }

  return String(fallback || '').trim() || 'Unknown Coach';
}

module.exports = {
  formatCoachName,
  formatEnum,
  formatPosition
};
