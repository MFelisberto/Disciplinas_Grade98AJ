// ══════════════════════════════════════════════════════════════
// matriz.js — Matriz Curricular page (loads from 98AJ.json)
// ══════════════════════════════════════════════════════════════

const MatrizPage = (() => {
  let currentFilter = 'all';
  let searchTerm = '';

  async function render(container) {
    const data = await DataStore.load();
    const { courses, categories, requirements, curriculum } = data;
    const catMap = DataStore.categoryMap(categories);

    // Stats
    const totalCredits = courses.reduce((a, c) => a + c.credits, 0);
    const totalHours = courses.reduce((a, c) => a + c.hours, 0);
    const totalDiscs = courses.length;
    const totalLevels = curriculum.levels;

    container.innerHTML = `
      <div class="tab-panel active" id="panel-matriz">
        <!-- Stats -->
        <div class="matriz-stats">
          <div class="matriz-stat-card" style="animation-delay:0s">
            <div class="stat-number">${totalDiscs}</div>
            <div class="stat-label">Disciplinas</div>
          </div>
          <div class="matriz-stat-card" style="animation-delay:0.06s">
            <div class="stat-number">${totalCredits}</div>
            <div class="stat-label">Créditos totais</div>
          </div>
          <div class="matriz-stat-card" style="animation-delay:0.12s">
            <div class="stat-number">${totalHours}</div>
            <div class="stat-label">Horas totais</div>
          </div>
          <div class="matriz-stat-card" style="animation-delay:0.18s">
            <div class="stat-number">${totalLevels}</div>
            <div class="stat-label">Níveis</div>
          </div>
        </div>

        <!-- Filters -->
        <div class="matriz-filters" id="matrizFilters">
          <div class="filter-search-wrap">
            <i class="ti ti-search"></i>
            <input type="text" class="filter-search" id="matrizSearch" placeholder="Buscar por nome ou código…">
          </div>
          <button class="filter-cat-btn active" data-cat="all">Todas</button>
          ${categories.map(cat => `
            <button class="filter-cat-btn" data-cat="${cat.id}">
              <span class="cat-dot" style="background:${cat.color}"></span>
              ${cat.name.split(' ').slice(0,2).join(' ')}
            </button>
          `).join('')}
        </div>

        <!-- Levels container -->
        <div id="matrizLevels"></div>
      </div>
    `;

    // Bind filter events
    container.querySelectorAll('.filter-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.cat;
        renderLevels(container, data, catMap);
      });
    });

    const searchInput = container.querySelector('#matrizSearch');
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderLevels(container, data, catMap);
    });

    renderLevels(container, data, catMap);
  }

  function renderLevels(container, data, catMap) {
    const { courses, curriculum } = data;
    const levelsContainer = container.querySelector('#matrizLevels');

    // Filter courses
    let filtered = courses;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(c => c.category === currentFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.code.toLowerCase().includes(searchTerm)
      );
    }

    const groups = DataStore.groupByLevel(filtered);
    const romanNums = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    if (filtered.length === 0) {
      levelsContainer.innerHTML = `
        <div class="no-results">
          <i class="ti ti-search-off"></i>
          <span>Nenhuma disciplina encontrada com os filtros atuais.</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (let lvl = 1; lvl <= curriculum.levels; lvl++) {
      const group = groups[lvl];
      if (!group || group.length === 0) continue;

      const levelCredits = group.reduce((a, c) => a + c.credits, 0);
      const levelHours = group.reduce((a, c) => a + c.hours, 0);

      html += `
        <div class="nivel-section" style="animation-delay:${(lvl-1) * 0.05}s">
          <div class="nivel-header">
            <div class="nivel-badge">${romanNums[lvl]}</div>
            <div class="nivel-title">Nível ${romanNums[lvl]}</div>
            <div class="nivel-count">${group.length} disciplina${group.length > 1 ? 's' : ''}</div>
            <div class="nivel-credits">${levelCredits} cred · ${levelHours}h</div>
          </div>
          <div class="disc-grid">
            ${group.map(course => renderCard(course, catMap, data)).join('')}
          </div>
        </div>
      `;
    }

    levelsContainer.innerHTML = html;

    // Bind syllabus toggles
    levelsContainer.querySelectorAll('.disc-card-syllabus-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const textEl = btn.parentElement.querySelector('.disc-card-syllabus-text');
        const isOpen = textEl.classList.toggle('open');
        btn.innerHTML = isOpen
          ? '<i class="ti ti-chevron-up" style="font-size:12px"></i> Ocultar ementa'
          : '<i class="ti ti-chevron-down" style="font-size:12px"></i> Ver ementa';
      });
    });
  }

  function renderCard(course, catMap, data) {
    const cat = catMap[course.category];
    const catColor = cat ? cat.color : '#1a4f7a';
    const catName = cat ? cat.name : '—';

    // Get prerequisites
    const prereqs = DataStore.getPrerequisites(course.code, data);

    // Syllabus
    const hasSyllabus = course.syllabus && course.syllabus !== 'x' && course.syllabus.length > 5;

    return `
      <div class="disc-card" style="--disc-cat-color: ${catColor}">
        <div class="disc-card-header">
          <div class="disc-card-name">${course.name}</div>
          <div class="disc-card-code">${course.code}</div>
        </div>
        <div class="disc-card-meta">
          <span><i class="ti ti-certificate"></i> ${course.credits} cred</span>
          <span><i class="ti ti-clock"></i> ${course.hours}h</span>
        </div>
        <div class="disc-card-cat" style="background:${catColor}">${catName}</div>
        ${prereqs.length > 0 ? `
          <div class="disc-card-prereqs">
            <div class="disc-card-prereqs-title">Pré-requisitos</div>
            ${prereqs.map(p => `
              <div class="disc-card-prereq-item">
                <i class="ti ti-arrow-back-up"></i>
                ${p.name} <span class="mono-code" style="font-size:9px">${p.code}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${hasSyllabus ? `
          <div class="disc-card-syllabus">
            <button class="disc-card-syllabus-toggle">
              <i class="ti ti-chevron-down" style="font-size:12px"></i> Ver ementa
            </button>
            <div class="disc-card-syllabus-text">${course.syllabus}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return { render };
})();
