import { escapeHtml, icon, setOptions } from './uiUtils.js';

export function renderFilterPanel(container, state, handlers) {
  const { data, filters } = state;

  const previousSearchInput = container.querySelector('#candidateSearch');
  const searchHadFocus = document.activeElement === previousSearchInput;
  const searchSelectionStart = previousSearchInput?.selectionStart ?? null;
  const searchSelectionEnd = previousSearchInput?.selectionEnd ?? null;

  container.innerHTML = `
    <div class="filter-group">
      <div class="filter-title">Coach Search</div>
      <input id="candidateSearch" type="search" value="${escapeHtml(filters.search)}" placeholder="Search coach, school, or status" />
    </div>

    <div class="filter-group">
      <div class="filter-title">Hiring School</div>
      <select id="teamFilter"></select>
    </div>

    <div class="filter-group">
      <div class="filter-title">Position</div>
      <select id="positionFilter"></select>
    </div>

    <div class="filter-group">
      <div class="filter-title">Conference</div>
      <select id="conferenceFilter"></select>
    </div>

    <div class="filter-group">
      <div class="filter-title">Team Prestige</div>
      <select id="prestigeFilter"></select>
    </div>

    <div class="filter-group">
      <button id="clearFilters" class="secondary-button" type="button">
        <img src="${icon('x')}" alt="" />
        Clear
      </button>
    </div>
  `;

  const teamFilter = container.querySelector('#teamFilter');
  const positionFilter = container.querySelector('#positionFilter');
  const conferenceFilter = container.querySelector('#conferenceFilter');
  const prestigeFilter = container.querySelector('#prestigeFilter');
  const candidateSearch = container.querySelector('#candidateSearch');

  setOptions(teamFilter, data.filters.teams, filters.team, 'All Schools');
  setOptions(positionFilter, data.filters.positions, filters.position, 'All Positions');
  setOptions(conferenceFilter, data.filters.conferences, filters.conference, 'All Conferences');
  setOptions(prestigeFilter, data.filters.prestiges, filters.prestige, 'All Prestiges');

  if (searchHadFocus) {
    candidateSearch.focus();
    if (searchSelectionStart !== null && searchSelectionEnd !== null) {
      candidateSearch.setSelectionRange(searchSelectionStart, searchSelectionEnd);
    }
  }

  let searchTimer = null;
  candidateSearch.addEventListener('input', (event) => {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }

    searchTimer = window.setTimeout(() => {
      handlers.onFilterChange({
        search: event.target.value
      });
    }, 120);
  });

  teamFilter.addEventListener('change', (event) => {
    handlers.onFilterChange({
      team: event.target.value
    });
  });

  positionFilter.addEventListener('change', (event) => {
    handlers.onFilterChange({
      position: event.target.value
    });
  });

  conferenceFilter.addEventListener('change', (event) => {
    handlers.onFilterChange({
      conference: event.target.value
    });
  });

  prestigeFilter.addEventListener('change', (event) => {
    handlers.onFilterChange({
      prestige: event.target.value
    });
  });

  container.querySelector('#clearFilters').addEventListener('click', () => {
    handlers.onFilterChange({
      conference: '',
      position: '',
      prestige: '',
      search: '',
      team: ''
    });
  });
}
