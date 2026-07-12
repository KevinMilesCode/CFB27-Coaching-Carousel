import { renderCandidateGrid } from './components/CandidateGrid.js';
import { renderFilterPanel } from './components/FilterPanel.js';
import { escapeHtml } from './components/uiUtils.js';

const loadForm = document.getElementById('loadForm');
const loaderView = document.getElementById('loaderView');
const appView = document.getElementById('appView');
const dynastySelect = document.getElementById('dynastySelect');
const changeDirectoryButton = document.getElementById('changeDirectory');
const saveDirectoryText = document.getElementById('saveDirectory');
const loadMessage = document.getElementById('loadMessage');
const filePathText = document.getElementById('filePath');
const saveButton = document.getElementById('saveButton');
const dirtyBadge = document.getElementById('dirtyBadge');
const resultCount = document.getElementById('resultCount');
const statusMessage = document.getElementById('statusMessage');
const filterPanel = document.getElementById('filterPanel');
const candidateGrid = document.getElementById('candidateGrid');
const coachDialog = document.getElementById('coachDialog');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const sortState = {
  key: 'teamPrestige',
  direction: 'desc'
};

const filtersState = {
  conference: '',
  position: '',
  prestige: '',
  search: '',
  team: ''
};

const appState = {
  busy: false,
  customSaveDirectory: null,
  data: null,
  loaded: false,
  pendingReplaceRowIndex: null,
  status: ''
};

const THEME_STORAGE_KEY = 'cfb27-theme';

function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.src = '../../node_modules/lucide-static/icons/sun.svg';
  } else {
    document.body.classList.remove('dark-mode');
    themeIcon.src = '../../node_modules/lucide-static/icons/moon.svg';
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  setTheme(isDark ? 'light' : 'dark');
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(savedTheme || 'dark');
}

function setLoaderMessage(message, isError = false) {
  loadMessage.textContent = message || '';
  loadMessage.classList.toggle('error', Boolean(isError));
}

function setStatus(message, isError = false) {
  appState.status = message || '';
  statusMessage.textContent = message || '';
  statusMessage.classList.toggle('error', Boolean(isError));
}

function setBusy(busy) {
  appState.busy = busy;
  saveButton.disabled = busy;
  dynastySelect.disabled = busy;
  saveButton.innerHTML = busy
    ? '<img src="../../node_modules/lucide-static/icons/save.svg" alt="" /> Saving…'
    : '<img src="../../node_modules/lucide-static/icons/save.svg" alt="" /> Save';
}

function applyState(state) {
  if (!state) {
    return;
  }

  appState.data = state;
  appState.loaded = true;
  if (state.message) {
    setStatus(state.message);
  }
  render();
}

function getFilteredCandidates() {
  if (!appState.data?.candidates?.length) {
    return [];
  }

  const search = filtersState.search.trim().toLowerCase();
  const team = filtersState.team;
  const position = filtersState.position;
  const conference = filtersState.conference;
  const prestige = filtersState.prestige;

  return appState.data.candidates.filter((candidate) => {
    if (team && candidate.hiringTeamRef !== team) {
      return false;
    }

    if (position && candidate.position !== position) {
      return false;
    }

    if (conference && String(candidate.conference || '').toLowerCase() !== conference.toLowerCase()) {
      return false;
    }

    if (prestige && String(candidate.teamPrestige) !== prestige) {
      return false;
    }

    if (!search) {
      return true;
    }

    return (candidate.searchText || '').includes(search);
  });
}

function getDynamicFilters(candidates) {
  const teams = new Map();
  const positions = new Map();
  const conferences = new Map();
  const prestiges = new Map();

  for (const candidate of candidates) {
    if (candidate.hiringTeamRef) {
      teams.set(candidate.hiringTeamRef, {
        label: candidate.hiringTeamName,
        logoUrl: candidate.hiringTeamLogoUrl,
        value: candidate.hiringTeamRef
      });
    }

    if (candidate.position) {
      positions.set(candidate.position, {
        label: candidate.positionLabel,
        value: candidate.position
      });
    }

    if (candidate.conference) {
      conferences.set(candidate.conference, {
        label: candidate.conference,
        value: candidate.conference
      });
    }

    if (candidate.teamPrestige !== null && candidate.teamPrestige !== undefined) {
      const prestigeValue = String(candidate.teamPrestige);
      const normalized = Math.max(0, Math.min(10, Number(candidate.teamPrestige))) / 2;
      prestiges.set(prestigeValue, {
        label: `${normalized.toFixed(1)}`,
        value: prestigeValue
      });
    }
  }

  return {
    teams: [...teams.values()].sort((a, b) => a.label.localeCompare(b.label)),
    positions: [...positions.values()].sort((a, b) => a.label.localeCompare(b.label)),
    conferences: [...conferences.values()].sort((a, b) => a.label.localeCompare(b.label)),
    prestiges: [...prestiges.values()].sort((a, b) => Number(b.value) - Number(a.value))
  };
}

function renderCandidates() {
  if (!appState.loaded || !appState.data) {
    return;
  }

  const filteredCandidates = getFilteredCandidates();
  const dynamicFilters = getDynamicFilters(filteredCandidates);
  const selectedTeam = appState.data.filters.teams.find((option) => option.value === filtersState.team);
  const teamLabel = selectedTeam ? selectedTeam.label : 'all schools';
  resultCount.textContent = filtersState.team
    ? `${filteredCandidates.length} of ${appState.data.candidates.length} offers for ${teamLabel}`
    : `${filteredCandidates.length} of ${appState.data.candidates.length} offers`;

  renderCandidateGrid(
    candidateGrid,
    filteredCandidates,
    sortState,
    {
      onInterestChange: async ({ field, rowIndex, value }) => {
        if (appState.busy) {
          return;
        }

        setBusy(true);
        setStatus('Updating interest…');

        try {
          const state = await window.carouselApi.updateInterest({ field, rowIndex, value });
          applyState(state);
        } catch (error) {
          setStatus(error.message || 'Unable to update interest.', true);
        } finally {
          setBusy(false);
        }
      },
      onMove: async (rowIndex, direction) => {
        if (appState.busy) {
          return;
        }

        setBusy(true);
        setStatus('Reordering candidates…');

        try {
          const state = await window.carouselApi.moveCandidate({ direction, rowIndex });
          applyState(state);
        } catch (error) {
          setStatus(error.message || 'Unable to reorder candidates.', true);
        } finally {
          setBusy(false);
        }
      },
      onReplace: (rowIndex) => {
        openCoachDialog(rowIndex);
      },
      onSort: (key) => {
        if (sortState.key === key) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = key;
          sortState.direction = 'asc';
        }

        renderCandidates();
      }
    }
  );

  renderFilterPanel(
    filterPanel,
    {
      data: {
        ...appState.data,
        filters: dynamicFilters
      },
      filters: filtersState
    },
    {
      onFilterChange: (nextFilters) => {
        Object.assign(filtersState, nextFilters);
        renderCandidates();
      }
    }
  );
}

function render() {
  if (!appState.loaded || !appState.data) {
    loaderView.classList.remove('hidden');
    appView.classList.add('hidden');
    return;
  }

  loaderView.classList.add('hidden');
  appView.classList.remove('hidden');
  filePathText.textContent = appState.data.filePath || '';
  dirtyBadge.classList.toggle('hidden', !appState.data.dirty);
  saveButton.disabled = appState.busy;
  saveButton.querySelector('img')?.removeAttribute('hidden');

  if (!appState.status) {
    statusMessage.textContent = '';
  } else {
    statusMessage.textContent = appState.status;
  }

  renderCandidates();
}

function openCoachDialog(rowIndex) {
  appState.pendingReplaceRowIndex = rowIndex;
  renderCoachDialog();
}

function renderCoachDialog(query = '') {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const coaches = (appState.data?.coaches || [])
    .filter((coach) => !normalizedQuery || (coach.searchText || '').includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!coachDialog.innerHTML) {
    coachDialog.innerHTML = `
      <div class="dialog-shell">
        <div class="dialog-header">
          <div>
            <div class="dialog-title">Replace Coach</div>
            <div class="dialog-subtitle">Search for another coach and assign them to the selected offer.</div>
          </div>
          <button class="text-button" type="button" id="closeCoachDialog">Close</button>
        </div>
        <div class="dialog-search">
          <input id="coachSearch" type="search" value="" placeholder="Search coach name, school, or position" />
        </div>
        <div class="coach-list" id="coachList"></div>
      </div>
    `;
  }

  const coachList = coachDialog.querySelector('#coachList');
  const searchInput = coachDialog.querySelector('#coachSearch');
  const closeButton = coachDialog.querySelector('#closeCoachDialog');

  if (searchInput && searchInput.value !== normalizedQuery) {
    searchInput.value = normalizedQuery;
  }

  coachList.innerHTML = coaches.length
    ? coaches.map((coach) => `
      <button class="coach-option" type="button" data-coach-row-index="${coach.rowIndex}">
        <img class="team-logo" src="${escapeHtml(coach.currentTeamLogoUrl)}" alt="" />
        <div>
          <div class="cell-main">${escapeHtml(coach.name)}</div>
          <div class="coach-meta">
            <span class="select-chip">${escapeHtml(coach.positionLabel || 'Coach')}</span>
            <span class="cell-sub">${escapeHtml(coach.currentTeamName || 'Unknown')}</span>
          </div>
        </div>
        <div class="select-chip">Select</div>
      </button>
    `).join('')
    : '<div class="empty-state">No coaches match the current search.</div>';

  if (!coachDialog.dataset.boundEvents) {
    let searchTimer = null;

    searchInput?.addEventListener('input', (event) => {
      const nextValue = event.target.value;
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }

      searchTimer = window.setTimeout(() => {
        renderCoachDialog(nextValue);
      }, 80);
    });

    closeButton?.addEventListener('click', () => {
      coachDialog.close();
    });

    coachList?.addEventListener('click', (event) => {
      const button = event.target.closest('.coach-option');
      if (!button) {
        return;
      }

      const coachRowIndex = Number.parseInt(button.dataset.coachRowIndex, 10);
      void replaceCoachSelection(coachRowIndex);
    });

    coachDialog.dataset.boundEvents = 'true';
  }

  coachDialog.showModal();
}

async function replaceCoachSelection(coachRowIndex) {
  const rowIndex = appState.pendingReplaceRowIndex;
  if (rowIndex === null || Number.isNaN(rowIndex)) {
    return;
  }

  setBusy(true);
  setStatus('Replacing coach…');

  try {
    let state = await window.carouselApi.replaceCoach({ coachRowIndex, rowIndex });

    if (state?.requiresConfirmation) {
      const shouldProceed = window.confirm(`${state.message}\n\nContinue anyway?`);
      if (!shouldProceed) {
        setStatus('Replacement cancelled.');
        coachDialog.close();
        return;
      }

      state = await window.carouselApi.replaceCoach({ coachRowIndex, rowIndex, force: true });
    }

    applyState(state);
    coachDialog.close();
  } catch (error) {
    setStatus(error.message || 'Unable to replace coach.', true);
  } finally {
    setBusy(false);
  }
}

async function handleLoadSubmit(event) {
  event.preventDefault();
  const dynastyName = dynastySelect.value.trim();

  if (!dynastyName) {
    setLoaderMessage('Select a dynasty file to load.', true);
    return;
  }

  setBusy(true);
  setLoaderMessage('Loading dynasty save…');
  setStatus('');

  try {
    const state = await window.carouselApi.loadDynasty(dynastyName, appState.customSaveDirectory);
    appState.data = state;
    appState.loaded = true;
    appState.status = state.message || 'Dynasty loaded.';
    render();
  } catch (error) {
    setLoaderMessage(error.message || 'Unable to load dynasty.', true);
  } finally {
    setBusy(false);
  }
}

async function handleSave() {
  if (!appState.loaded || appState.busy) {
    return;
  }

  setBusy(true);
  setStatus('Saving dynasty…');

  try {
    const state = await window.carouselApi.save();
    applyState(state);
    window.alert('Saved successfully.');
  } catch (error) {
    setStatus(error.message || 'Unable to save dynasty.', true);
  } finally {
    setBusy(false);
  }
}

async function handleChangeDirectory() {
  try {
    const info = await window.carouselApi.selectDirectory();
    
    if (!info) {
      return; // User cancelled the dialog
    }
    
    appState.customSaveDirectory = info?.saveDirectory || null;
    saveDirectoryText.textContent = info?.saveDirectory || '';
    
    // Populate dynasty select dropdown
    if (info?.dynastyFiles?.length) {
      dynastySelect.innerHTML = '<option value="">-- Select a dynasty file --</option>' +
        info.dynastyFiles.map(file => `<option value="${file}">${file}</option>`).join('');
      setLoaderMessage('');
    } else {
      dynastySelect.innerHTML = '<option value="">-- No dynasty files found --</option>';
      setLoaderMessage('No Dynasty- files found in the selected directory.', true);
    }
  } catch (error) {
    saveDirectoryText.textContent = 'Unable to read save directory.';
    dynastySelect.innerHTML = '<option value="">-- Unable to load dynasty files --</option>';
    setLoaderMessage(error.message || 'Failed to change directory.', true);
  }
}

async function initialize() {
  loadTheme();

  try {
    const info = await window.carouselApi.getAppInfo();
    saveDirectoryText.textContent = info?.saveDirectory || '';
    
    // Populate dynasty select dropdown
    if (info?.dynastyFiles?.length) {
      dynastySelect.innerHTML = '<option value="">-- Select a dynasty file --</option>' +
        info.dynastyFiles.map(file => `<option value="${file}">${file}</option>`).join('');
    } else {
      dynastySelect.innerHTML = '<option value="">-- No dynasty files found --</option>';
    }
  } catch (error) {
    saveDirectoryText.textContent = 'Unable to read save directory.';
    dynastySelect.innerHTML = '<option value="">-- Unable to load dynasty files --</option>';
  }

  loadForm.addEventListener('submit', handleLoadSubmit);
  saveButton.addEventListener('click', handleSave);
  changeDirectoryButton.addEventListener('click', handleChangeDirectory);
  themeToggle.addEventListener('click', toggleTheme);
  render();
}

initialize();
