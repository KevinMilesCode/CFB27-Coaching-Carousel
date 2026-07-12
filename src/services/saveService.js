const { applyAuthoritativeOrdering, sortOfferRecords } = require('./sortingService');

async function saveCarousel({ carouselRepository, coachRepository, contractOfferRepository, franchise }) {
  const pendingRecords = carouselRepository.getPendingRecords();
  const groupMap = applyAuthoritativeOrdering(carouselRepository, pendingRecords);
  const warnings = contractOfferRepository.updateOrderingForGroups(groupMap, (records) =>
    sortOfferRecords(records, carouselRepository)
  );

  coachRepository.recalculateContractOfferCounts(carouselRepository.table.records);
  await franchise.save();

  return {
    message: 'Saved successfully.',
    warnings
  };
}

module.exports = {
  saveCarousel
};
