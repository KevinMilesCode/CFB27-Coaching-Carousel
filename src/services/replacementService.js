const { EMPTY_REFERENCE } = require('../franchise/tableUtils');

function validateReplacement({ candidateRecord, carouselRepository, force = false, pendingRecords, replacementCoach }) {
  if (!replacementCoach) {
    return {
      ok: false,
      code: 'COACH_NOT_FOUND',
      message: 'Replacement coach was not found.'
    };
  }

  const groupKey = carouselRepository.getGroupKey(candidateRecord);
  const duplicateInGroup = pendingRecords.find(
    (record) =>
      record.index !== candidateRecord.index &&
      carouselRepository.getGroupKey(record) === groupKey &&
      carouselRepository.get(record, 'staffPerson', EMPTY_REFERENCE) === replacementCoach.ref
  );

  if (duplicateInGroup) {
    return {
      ok: false,
      code: 'DUPLICATE_IN_GROUP',
      message: `${replacementCoach.name} is already in this candidate list.`
    };
  }

  const otherOffers = pendingRecords.filter(
    (record) =>
      record.index !== candidateRecord.index &&
      carouselRepository.get(record, 'staffPerson', EMPTY_REFERENCE) === replacementCoach.ref
  );

  if (otherOffers.length > 0 && !force) {
    return {
      ok: false,
      code: 'COACH_EXISTS_ELSEWHERE',
      conflicts: otherOffers.map((record) => record.index),
      message: `${replacementCoach.name} already appears in ${otherOffers.length} other pending offer${
        otherOffers.length === 1 ? '' : 's'
      }.`
    };
  }

  return {
    ok: true
  };
}

module.exports = {
  validateReplacement
};
