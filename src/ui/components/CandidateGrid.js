import { compareText, escapeHtml, icon } from './uiUtils.js';

const SORTERS = {
  adjustedInterest: (candidate) => candidate.adjustedInterest,
  baseInterest: (candidate) => candidate.baseInterest,
  coachName: (candidate) => candidate.coachName,
  currentTeamName: (candidate) => candidate.currentTeamName,
  rank: (candidate) => candidate.rank,
  teamInterest: (candidate) => candidate.teamInterest,
  teamPrestige: (candidate) => candidate.teamPrestige || 0
};

function getPositionGroupKey(candidate) {
  const rawPosition = String(candidate.position || candidate.positionLabel || '').toLowerCase();

  if (rawPosition.includes('head')) {
    return 'HC';
  }

  if (rawPosition.includes('offensive') || rawPosition.includes('oc')) {
    return 'OC';
  }

  if (rawPosition.includes('defensive') || rawPosition.includes('dc')) {
    return 'DC';
  }

  if (rawPosition.includes('special') || rawPosition.includes('st')) {
    return 'ST';
  }

  return candidate.positionLabel || candidate.position || 'Unknown';
}

function getPositionOrderKey(candidate) {
  const positionGroupKey = getPositionGroupKey(candidate);
  const order = {
    HC: 0,
    OC: 1,
    DC: 2,
    ST: 3
  };

  return order[positionGroupKey] ?? 99;
}

function renderPrestigeLabel(value) {
  const prestigeValue = Number(value || 0);
  const normalized = Math.max(0, Math.min(10, prestigeValue)) / 2;
  const fullStars = Math.floor(normalized);
  const hasHalfStar = normalized - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const stars = `${'★'.repeat(fullStars)}${hasHalfStar ? '⯪' : ''}${'☆'.repeat(emptyStars)}`;
  return `${stars} (${normalized.toFixed(1)})`;
}

function compareGroupOrder(a, b) {
  const prestigeDelta = (b.teamPrestige || 0) - (a.teamPrestige || 0);
  if (prestigeDelta !== 0) {
    return prestigeDelta;
  }

  const teamDelta = compareText(a.hiringTeamName, b.hiringTeamName);
  if (teamDelta !== 0) {
    return teamDelta;
  }

  const positionDelta = getPositionOrderKey(a) - getPositionOrderKey(b);
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return a.rank - b.rank;
}

function sortCandidates(candidates, sort) {
  const getValue = SORTERS[sort.key] || SORTERS.rank;
  const direction = sort.direction === 'desc' ? -1 : 1;

  return [...candidates].sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }

    const textResult = compareText(aValue, bValue);
    if (textResult !== 0) {
      return textResult * direction;
    }

    return a.rank - b.rank;
  });
}

function renderSortLabel(label, key, sort) {
  const active = sort.key === key;
  const marker = active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : '';
  return `${escapeHtml(label)}${marker}`;
}

function renderTeamCell(logoUrl, main, sub = '') {
  return `
    <div class="team-cell">
      <img class="team-logo" src="${escapeHtml(logoUrl)}" alt="" />
      <div>
        <div class="cell-main">${escapeHtml(main)}</div>
        ${sub ? `<div class="cell-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderCandidateRow(candidate, groupCounts) {
  const groupCount = groupCounts.get(candidate.groupKey) || 1;
  const isFirst = candidate.rank <= 1;
  const isLast = candidate.rank >= groupCount;
  const firedBadge = candidate.coachPreviousFired
    ? '<span class="opening-reason-pill opening-reason-pill--fired">Fired</span>'
    : '';

  return `
    <tr data-row="${escapeHtml(candidate.rowIndex)}">
      <td class="rank-cell">${escapeHtml(candidate.rank)}</td>
      <td>
        <div class="coach-name-row">
          <div class="cell-main">${escapeHtml(candidate.coachName)}</div>
          ${firedBadge}
        </div>
      </td>
      <td>${renderTeamCell(candidate.currentTeamLogoUrl, candidate.currentTeamName)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" title="Move Up" aria-label="Move Up" data-action="move-up" data-row="${escapeHtml(
            candidate.rowIndex
          )}" ${isFirst ? 'disabled' : ''}>
            <img src="${icon('arrow-up')}" alt="" />
          </button>
          <button class="icon-button" type="button" title="Move Down" aria-label="Move Down" data-action="move-down" data-row="${escapeHtml(
            candidate.rowIndex
          )}" ${isLast ? 'disabled' : ''}>
            <img src="${icon('arrow-down')}" alt="" />
          </button>
          <button class="secondary-button replace-button" type="button" data-action="replace" data-row="${escapeHtml(candidate.rowIndex)}">
            <img src="${icon('user-round-search')}" alt="" />
            Replace
          </button>
        </div>
      </td>
      <td>
        <input class="interest-input" type="number" min="0" max="280" value="${escapeHtml(
          candidate.baseInterest
        )}" data-field="baseInterest" data-row="${escapeHtml(candidate.rowIndex)}" />
      </td>
      <td>
        <input class="interest-input" type="number" min="0" max="100" value="${escapeHtml(
          candidate.adjustedInterest
        )}" data-field="adjustedInterest" data-row="${escapeHtml(candidate.rowIndex)}" />
      </td>
      <td>
        <input class="interest-input" type="number" min="0" max="100" value="${escapeHtml(
          candidate.teamInterest
        )}" data-field="teamInterest" data-row="${escapeHtml(candidate.rowIndex)}" />
      </td>
    </tr>
  `;
}

export function renderCandidateGrid(container, candidates, sort, handlers) {
  if (!candidates.length) {
    container.innerHTML = '<div class="empty-state">No pending offers match the current view.</div>';
    return;
  }

  const groupCounts = candidates.reduce((map, candidate) => {
    map.set(candidate.groupKey, (map.get(candidate.groupKey) || 0) + 1);
    return map;
  }, new Map());
  const sortedCandidates = sortCandidates(candidates, sort);
  const orderedCandidates = [...sortedCandidates].sort(compareGroupOrder);
  const groupedCandidates = [];
  const positionGroupCounts = new Map();
  let currentTeamKey = '';
  let currentPositionGroupKey = '';

  orderedCandidates.forEach((candidate) => {
    const teamKey = candidate.hiringTeamRef || candidate.hiringTeamName;
    const positionGroupKey = `${teamKey}::${getPositionGroupKey(candidate)}`;

    if (teamKey !== currentTeamKey) {
      currentTeamKey = teamKey;
      currentPositionGroupKey = '';
      groupedCandidates.push({
        type: 'group',
        candidate
      });
    }

    if (positionGroupKey !== currentPositionGroupKey) {
      currentPositionGroupKey = positionGroupKey;
      positionGroupCounts.set(positionGroupKey, 0);
      groupedCandidates.push({
        type: 'position-group',
        candidate,
        label: getPositionGroupKey(candidate),
        count: 0
      });
    }

    positionGroupCounts.set(positionGroupKey, (positionGroupCounts.get(positionGroupKey) || 0) + 1);
    groupedCandidates.push({
      type: 'row',
      candidate
    });
  });

  groupedCandidates.forEach((entry) => {
    if (entry.type === 'position-group') {
      const groupKey = `${entry.candidate.hiringTeamRef || entry.candidate.hiringTeamName}::${entry.label}`;
      entry.count = positionGroupCounts.get(groupKey) || 0;
    }
  });

  container.innerHTML = `
    <table>
      <colgroup>
        <col style="width: 58px" />
        <col style="width: 210px" />
        <col style="width: 200px" />
        <col style="width: 188px" />
        <col style="width: 108px" />
        <col style="width: 112px" />
        <col style="width: 112px" />
      </colgroup>
      <thead>
        <tr>
          <th class="sortable" data-sort="rank">${renderSortLabel('Rank', 'rank', sort)}</th>
          <th class="sortable" data-sort="coachName">${renderSortLabel('Coach Name', 'coachName', sort)}</th>
          <th class="sortable" data-sort="currentTeamName">${renderSortLabel('Current Team', 'currentTeamName', sort)}</th>
          <th>Actions</th>
          <th class="sortable" data-sort="baseInterest">${renderSortLabel('Coach Interest (Base)', 'baseInterest', sort)}</th>
          <th class="sortable" data-sort="adjustedInterest">${renderSortLabel('Coach Interest (Adjusted)', 'adjustedInterest', sort)}</th>
          <th class="sortable" data-sort="teamInterest">${renderSortLabel('Team Interest', 'teamInterest', sort)}</th>
        </tr>
      </thead>
      <tbody>
        ${groupedCandidates
          .map((entry) => {
            if (entry.type === 'group') {
              const conferenceLogo = entry.candidate.hiringTeamConferenceLogoUrl || '';
              const conferenceMeta = conferenceLogo
                ? `<img class="conference-logo" src="${escapeHtml(conferenceLogo)}" alt="" />`
                : `<span class="group-row-meta">${escapeHtml(entry.candidate.conference || '')}</span>`;
              return `
                <tr class="group-row">
                  <td colspan="7">
                    <div class="group-row-content">
                      <img class="team-logo group-row-logo" src="${escapeHtml(entry.candidate.hiringTeamLogoUrl)}" alt="" />
                      <span class="group-row-title">${escapeHtml(entry.candidate.hiringTeamName)}</span>
                      ${conferenceMeta}
                      <span class="group-row-meta">${escapeHtml(renderPrestigeLabel(entry.candidate.teamPrestige || 0))}</span>
                    </div>
                  </td>
                </tr>
              `;
            }

            if (entry.type === 'position-group') {
              const reasonKey = entry.candidate.openingReasonKey || '';
              const reasonLabel = entry.candidate.openingReason || entry.candidate.openingReasonLabel || '';
              const reasonPillClass = ['fired', 'retired', 'pro'].includes(reasonKey)
                ? ` opening-reason-pill--${reasonKey}`
                : '';
              return `
                <tr class="subgroup-row">
                  <td colspan="7">
                    <div class="subgroup-row-content">
                      <span class="subgroup-row-title">${escapeHtml(entry.label)}</span>
                      ${reasonLabel ? `<span class="opening-reason-pill${reasonPillClass}">${escapeHtml(reasonLabel)}</span>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }

            return renderCandidateRow(entry.candidate, groupCounts);
          })
          .join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('th.sortable').forEach((header) => {
    header.addEventListener('click', () => {
      handlers.onSort(header.dataset.sort);
    });
  });

  container.querySelectorAll('.interest-input').forEach((input) => {
    input.addEventListener('change', () => {
      handlers.onInterestChange({
        field: input.dataset.field,
        rowIndex: Number.parseInt(input.dataset.row, 10),
        value: input.value
      });
    });
  });

  container.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const rowIndex = Number.parseInt(button.dataset.row, 10);
      if (button.dataset.action === 'move-up') {
        handlers.onMove(rowIndex, 'up');
      } else if (button.dataset.action === 'move-down') {
        handlers.onMove(rowIndex, 'down');
      } else if (button.dataset.action === 'replace') {
        handlers.onReplace(rowIndex);
      }
    });
  });
}
