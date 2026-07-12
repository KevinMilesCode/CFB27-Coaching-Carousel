const { EMPTY_REFERENCE, resolveTable } = require('./tableUtils');

const CONTRACT_OFFER_TABLE_UNIQUE_ID = 4119397260;

class ContractOfferRepository {
  constructor(franchise, carouselRepository) {
    this.franchise = franchise;
    this.carouselRepository = carouselRepository;
    this.table = resolveTable(franchise, CONTRACT_OFFER_TABLE_UNIQUE_ID, 'StaffPersonContractOffer[]');
    this.arrayRecordByGroupKey = new Map();
  }

  async load() {
    await this.table.readRecords();
  }

  getSlotFields(record) {
    if (!record || !record.fieldsArray) {
      return [];
    }

    return record.fieldsArray
      .filter((field) => field.isReference || /^StaffPersonContractOffer\d+$/i.test(field.key))
      .sort((a, b) => a.offset.index - b.offset.index);
  }

  buildArrayRecordIndex(candidateRecords) {
    const candidateRefs = new Set(candidateRecords.map((record) => this.carouselRepository.getOfferReference(record)));
    const index = new Map();

    for (const arrayRecord of this.table.records) {
      if (!arrayRecord || arrayRecord.isEmpty) {
        continue;
      }

      for (const field of this.getSlotFields(arrayRecord)) {
        const value = arrayRecord[field.key];
        if (!candidateRefs.has(value)) {
          continue;
        }

        if (!index.has(value)) {
          index.set(value, []);
        }

        index.get(value).push(arrayRecord.index);
      }
    }

    return index;
  }

  findArrayRecordForGroup(groupKey, groupRecords, referenceIndex) {
    const cachedRecordIndex = this.arrayRecordByGroupKey.get(groupKey);
    if (cachedRecordIndex !== undefined) {
      const cachedRecord = this.table.records[cachedRecordIndex];
      if (cachedRecord && !cachedRecord.isEmpty) {
        return cachedRecord;
      }
    }

    const scoreByArrayRecord = new Map();

    for (const record of groupRecords) {
      const offerRef = this.carouselRepository.getOfferReference(record);
      const arrayRecordIndexes = referenceIndex.get(offerRef) || [];

      for (const arrayRecordIndex of arrayRecordIndexes) {
        scoreByArrayRecord.set(arrayRecordIndex, (scoreByArrayRecord.get(arrayRecordIndex) || 0) + 1);
      }
    }

    const [bestRecordIndex] = [...scoreByArrayRecord.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (bestRecordIndex === undefined) {
      return null;
    }

    this.arrayRecordByGroupKey.set(groupKey, bestRecordIndex);
    return this.table.records[bestRecordIndex] || null;
  }

  writeArrayRecord(arrayRecord, sortedRecords) {
    const slotFields = this.getSlotFields(arrayRecord);
    const offerRefs = sortedRecords.map((record) => this.carouselRepository.getOfferReference(record));
    const writeCount = Math.min(slotFields.length, offerRefs.length);

    for (let index = 0; index < slotFields.length; index += 1) {
      arrayRecord[slotFields[index].key] = index < writeCount ? offerRefs[index] : EMPTY_REFERENCE;
    }

    arrayRecord.arraySize = writeCount;
    if (this.table.arraySizes && this.table.arraySizes.length > arrayRecord.index) {
      this.table.arraySizes[arrayRecord.index] = writeCount;
    }

    arrayRecord.isChanged = true;
    this.table.isChanged = true;

    return {
      slotCount: slotFields.length,
      written: writeCount
    };
  }

  updateOrderingForGroups(groupMap, sortRecords) {
    const allRecords = [...groupMap.values()].flat();
    const referenceIndex = this.buildArrayRecordIndex(allRecords);
    const warnings = [];

    for (const [groupKey, groupRecords] of groupMap.entries()) {
      const sortedRecords = sortRecords(groupRecords);
      const arrayRecord = this.findArrayRecordForGroup(groupKey, sortedRecords, referenceIndex);

      if (!arrayRecord) {
        warnings.push(`Could not find table ${CONTRACT_OFFER_TABLE_UNIQUE_ID} ordering row for ${groupKey}.`);
        continue;
      }

      const result = this.writeArrayRecord(arrayRecord, sortedRecords);
      if (result.written < sortedRecords.length) {
        warnings.push(
          `Only wrote ${result.written} of ${sortedRecords.length} offers to table ${CONTRACT_OFFER_TABLE_UNIQUE_ID}; the array has ${result.slotCount} slots.`
        );
      }
    }

    return warnings;
  }
}

module.exports = {
  CONTRACT_OFFER_TABLE_UNIQUE_ID,
  ContractOfferRepository
};
