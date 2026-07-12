function sortOfferRecords(records, carouselRepository) {
  return [...records].sort((a, b) => {
    const teamInterestDelta = carouselRepository.getTeamInterest(b) - carouselRepository.getTeamInterest(a);
    if (teamInterestDelta !== 0) {
      return teamInterestDelta;
    }

    const baseInterestDelta = carouselRepository.getBaseInterest(b) - carouselRepository.getBaseInterest(a);
    if (baseInterestDelta !== 0) {
      return baseInterestDelta;
    }

    const adjustedInterestDelta = carouselRepository.getAdjustedInterest(b) - carouselRepository.getAdjustedInterest(a);
    if (adjustedInterestDelta !== 0) {
      return adjustedInterestDelta;
    }

    const offerIndexDelta = carouselRepository.getOfferIndex(a) - carouselRepository.getOfferIndex(b);
    if (offerIndexDelta !== 0) {
      return offerIndexDelta;
    }

    return a.index - b.index;
  });
}

function buildGroupMap(records, carouselRepository) {
  const groupMap = new Map();

  for (const record of records) {
    const groupKey = carouselRepository.getGroupKey(record);
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }

    groupMap.get(groupKey).push(record);
  }

  return groupMap;
}

function applyAuthoritativeOrdering(carouselRepository, records) {
  const groupMap = buildGroupMap(records, carouselRepository);

  for (const groupRecords of groupMap.values()) {
    const sortedRecords = sortOfferRecords(groupRecords, carouselRepository);
    sortedRecords.forEach((record, index) => {
      carouselRepository.setOfferIndex(record, index);
    });
  }

  return groupMap;
}

function moveRecordByInterest(carouselRepository, rowIndex, direction) {
  const record = carouselRepository.getRecordByIndex(rowIndex);
  const groupKey = carouselRepository.getGroupKey(record);
  const groupRecords = carouselRepository
    .getPendingRecords()
    .filter((candidateRecord) => carouselRepository.getGroupKey(candidateRecord) === groupKey);
  const sortedRecords = sortOfferRecords(groupRecords, carouselRepository);
  const currentIndex = sortedRecords.findIndex((candidateRecord) => candidateRecord.index === record.index);
  const offset = direction === 'up' ? -1 : 1;
  const neighbor = sortedRecords[currentIndex + offset];

  if (currentIndex < 0 || !neighbor) {
    return record;
  }

  const currentInterest = carouselRepository.getTeamInterest(record);
  const neighborInterest = carouselRepository.getTeamInterest(neighbor);

  if (direction === 'up') {
    let nextCurrentInterest = neighborInterest;
    let nextNeighborInterest = currentInterest;

    if (nextCurrentInterest <= nextNeighborInterest) {
      if (neighborInterest < 100) {
        nextCurrentInterest = neighborInterest + 1;
      } else {
        nextCurrentInterest = 100;
        nextNeighborInterest = Math.max(0, Math.min(99, currentInterest));
      }
    }

    carouselRepository.updateInterest(record.index, 'teamInterest', nextCurrentInterest);
    carouselRepository.updateInterest(neighbor.index, 'teamInterest', nextNeighborInterest);
  } else {
    let nextCurrentInterest = neighborInterest;
    let nextNeighborInterest = currentInterest;

    if (nextCurrentInterest >= nextNeighborInterest) {
      if (neighborInterest > 0) {
        nextCurrentInterest = neighborInterest - 1;
      } else {
        nextCurrentInterest = 0;
        nextNeighborInterest = Math.min(100, Math.max(1, currentInterest));
      }
    }

    carouselRepository.updateInterest(record.index, 'teamInterest', nextCurrentInterest);
    carouselRepository.updateInterest(neighbor.index, 'teamInterest', nextNeighborInterest);
  }

  return record;
}

module.exports = {
  applyAuthoritativeOrdering,
  buildGroupMap,
  moveRecordByInterest,
  sortOfferRecords
};
