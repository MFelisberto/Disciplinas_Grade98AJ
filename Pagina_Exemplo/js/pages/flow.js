// ══════════════════════════════════════════════════════════════
// flow.js — Fluxo curricular page (dynamic from 98AJ.json)
// ══════════════════════════════════════════════════════════════

const FlowPage = (() => {
  let currentData = null;
  let activeTrace = null;

  async function render(container) {
    const data = await DataStore.load();
    currentData = data;
    const { courses, categories, requirements, curriculum } = data;
    const catMap = DataStore.categoryMap(categories);

    // ── Compute centrality (direct dependents count) ──
    const depCount = {};
    courses.forEach(c => { depCount[c.code] = 0; });
    requirements.forEach(r => {
      if (depCount[r.from] !== undefined) depCount[r.from]++;
    });
    const topCentral = courses
      .map(c => ({ name: c.name, code: c.code, deps: depCount[c.code] }))
      .filter(c => c.deps > 0)
      .sort((a, b) => b.deps - a.deps)
      .slice(0, 6);

    // ── Compute courses with no prereqs fulfilled (isolated sinks) ──
    const hasPrereq = new Set(requirements.map(r => r.to));
    const isPrereqFor = new Set(requirements.map(r => r.from));
    const isolatedCount = courses.filter(c => !hasPrereq.has(c.code) && !isPrereqFor.has(c.code)).length;

    // ── Build category filter buttons ──
    const usedCats = new Set(courses.map(c => c.category).filter(Boolean));
    const filterBtns = categories
      .filter(cat => usedCats.has(cat.id))
      .map(cat => `<button class="eixo-btn" data-cat="${cat.id}"><span style="width:8px;height:8px;border-radius:50%;background:${cat.color};display:inline-block"></span> ${cat.name.split(' ').slice(0, 2).join(' ')}</button>`)
      .join('');

    // ── Layout calculations ──
    const grouped = DataStore.groupByLevel(courses);
    const maxPerLevel = Math.max(...Object.values(grouped).map(g => g.length));
    const cardW = 240, cardH = 70;
    const colW = 280, rowH = 96;
    const padLeft = 40, padTop = 60;
    const levels = curriculum.levels;
    const svgW = padLeft + levels * colW + 40;
    const svgH = padTop + maxPerLevel * rowH + 40;

    container.innerHTML = `
      <div class="tab-panel active" id="panel-flow">
        <div class="card" style="margin-bottom:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
            <div class="card-title" style="margin:0">Mapa de pré-requisitos — caminho crítico</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="eixoBtns">
              <button class="eixo-btn active" data-cat="all">Todos</button>
              ${filterBtns}
            </div>
          </div>
          <div style="overflow-x:auto; padding-bottom:16px;">
            <svg id="flowSvg" viewBox="0 0 ${svgW} ${svgH}" style="width:${svgW}px; height:${svgH}px; display:block;"></svg>
          </div>
          <div id="flowLegend" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"></div>
        </div>
      </div>
    `;

    // ── Render the SVG graph ──
    renderGraph(data, catMap, grouped, { cardW, cardH, colW, rowH, padLeft, padTop });

    // ── Render legend from used categories ──
    const legendEl = document.getElementById('flowLegend');
    categories.filter(cat => usedCats.has(cat.id)).forEach(cat => {
      legendEl.innerHTML += `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)"><span style="width:12px;height:12px;background:${cat.color};border-radius:2px;display:inline-block"></span>${cat.name}</span>`;
    });
    legendEl.innerHTML += `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)"><span style="width:10px;height:3px;background:var(--text3);border-radius:2px;display:inline-block"></span>Pré-requisito</span>`;

    // ── Bind filter buttons ──
    container.querySelectorAll('.eixo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.eixo-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterByCat(btn.dataset.cat);
      });
    });
  }

  // ── SVG Graph Renderer ──
  function renderGraph(data, catMap, grouped, dims) {
    const { courses, requirements } = data;
    const { cardW, cardH, colW, rowH, padLeft, padTop } = dims;
    const svg = document.getElementById('flowSvg');
    const ns = 'http://www.w3.org/2000/svg';
    const romanNums = ['','I','II','III','IV','V','VI','VII','VIII'];

    // ── Position nodes ──
    const nodePositions = {}; // code -> { x, y, course, cat }
    const sortedLevels = Object.keys(grouped).map(Number).sort((a, b) => a - b);

    sortedLevels.forEach(lv => {
      const group = grouped[lv];
      const x = padLeft + (lv - 1) * colW;
      group.forEach((course, idx) => {
        const y = padTop + idx * rowH;
        nodePositions[course.code] = { x, y, course, cat: catMap[course.category] };
      });
    });

    // ── Defs: arrowhead marker ──
    const defs = document.createElementNS(ns, 'defs');
    const mkArrow = document.createElementNS(ns, 'marker');
    mkArrow.setAttribute('id', 'arrowFlow');
    mkArrow.setAttribute('markerWidth', '8');
    mkArrow.setAttribute('markerHeight', '8');
    mkArrow.setAttribute('refX', '7');
    mkArrow.setAttribute('refY', '3');
    mkArrow.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS(ns, 'path');
    arrowPath.setAttribute('d', 'M0,0 L0,6 L8,3 z');
    arrowPath.setAttribute('fill', 'rgba(0,0,0,0.25)');
    mkArrow.appendChild(arrowPath);
    defs.appendChild(mkArrow);

    // High-dep arrowhead
    const mkArrowH = document.createElementNS(ns, 'marker');
    mkArrowH.setAttribute('id', 'arrowFlowHigh');
    mkArrowH.setAttribute('markerWidth', '8');
    mkArrowH.setAttribute('markerHeight', '8');
    mkArrowH.setAttribute('refX', '7');
    mkArrowH.setAttribute('refY', '3');
    mkArrowH.setAttribute('orient', 'auto');
    const arrowPathH = document.createElementNS(ns, 'path');
    arrowPathH.setAttribute('d', 'M0,0 L0,6 L8,3 z');
    arrowPathH.setAttribute('fill', '#d46868');
    mkArrowH.appendChild(arrowPathH);
    defs.appendChild(mkArrowH);

    svg.appendChild(defs);

    // ── Level column headers ──
    sortedLevels.forEach(lv => {
      const x = padLeft + (lv - 1) * colW + cardW / 2;
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', 26);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '16');
      t.setAttribute('fill', '#6b6860');
      t.setAttribute('font-weight', '600');
      t.textContent = `Nível ${romanNums[lv]}`;
      svg.appendChild(t);

      // Column count
      const count = grouped[lv].length;
      const t2 = document.createElementNS(ns, 'text');
      t2.setAttribute('x', x);
      t2.setAttribute('y', 44);
      t2.setAttribute('text-anchor', 'middle');
      t2.setAttribute('font-size', '13');
      t2.setAttribute('fill', '#a09e98');
      t2.textContent = `${count} disc.`;
      svg.appendChild(t2);
    });

    // ── Compute dependency count for edge highlighting ──
    const depCount = {};
    courses.forEach(c => { depCount[c.code] = 0; });
    requirements.forEach(r => {
      if (depCount[r.from] !== undefined) depCount[r.from]++;
    });

    // ── Draw edges ──
    requirements.forEach(req => {
      const from = nodePositions[req.from];
      const to = nodePositions[req.to];
      if (!from || !to) return;

      const x1 = from.x + cardW;
      const y1 = from.y + cardH / 2;
      const x2 = to.x;
      const y2 = to.y + cardH / 2;
      const mx = (x1 + x2) / 2;

      const isHighDep = depCount[req.from] >= 3;

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isHighDep ? '#d46868' : 'rgba(0,0,0,0.15)');
      path.setAttribute('stroke-width', isHighDep ? '2' : '1.2');
      path.setAttribute('marker-end', isHighDep ? 'url(#arrowFlowHigh)' : 'url(#arrowFlow)');
      path.setAttribute('data-cat', from.cat ? from.cat.id : '');
      path.setAttribute('data-from', req.from);
      path.setAttribute('data-to', req.to);
      path.classList.add('flow-edge');
      svg.appendChild(path);
    });

    // ── Tooltip ──
    let tip = document.getElementById('flowTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'flow-tooltip';
      tip.id = 'flowTooltip';
      document.body.appendChild(tip);
    }

    // ── Draw nodes ──
    Object.values(nodePositions).forEach(node => {
      const { x, y, course, cat } = node;
      const catColor = cat ? cat.color : '#1a4f7a';
      const catName = cat ? cat.name : '';
      const deps = depCount[course.code] || 0;
      const prereqs = DataStore.getPrerequisites(course.code, data);

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('data-cat', cat ? cat.id : '');
      g.setAttribute('data-code', course.code);
      g.classList.add('flow-node');
      g.style.cursor = 'pointer';
      g.setAttribute('tabindex', '0');

      // Card background
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', cardW);
      rect.setAttribute('height', cardH);
      rect.setAttribute('rx', '5');
      rect.setAttribute('fill', '#fff');
      rect.setAttribute('stroke', catColor);
      rect.setAttribute('stroke-width', '1');

      // Left color strip
      const strip = document.createElementNS(ns, 'rect');
      strip.setAttribute('x', x);
      strip.setAttribute('y', y);
      strip.setAttribute('width', '4');
      strip.setAttribute('height', cardH);
      strip.setAttribute('rx', '2');
      strip.setAttribute('fill', catColor);

      // Name text (truncated)
      const maxLabelLen = 28;
      const label = course.name.length > maxLabelLen
        ? course.name.substring(0, maxLabelLen - 1) + '…'
        : course.name;

      const txt1 = document.createElementNS(ns, 'text');
      txt1.setAttribute('x', x + 16);
      txt1.setAttribute('y', y + 26);
      txt1.setAttribute('font-size', '14.5');
      txt1.setAttribute('fill', '#1a1916');
      txt1.setAttribute('font-weight', '500');
      txt1.textContent = label;

      // Code + credits
      const txt2 = document.createElementNS(ns, 'text');
      txt2.setAttribute('x', x + 16);
      txt2.setAttribute('y', y + 48);
      txt2.setAttribute('font-size', '12.5');
      txt2.setAttribute('fill', '#a09e98');
      txt2.textContent = `${course.code} · ${course.credits}cr · ${course.hours}h`;

      // Deps badge (if any)
      const elements = [rect, strip, txt1, txt2];

      if (deps > 0) {
        const badgeX = x + cardW - 28;
        const badgeY = y + 8;
        const badgeR = document.createElementNS(ns, 'rect');
        badgeR.setAttribute('x', badgeX);
        badgeR.setAttribute('y', badgeY);
        badgeR.setAttribute('width', '22');
        badgeR.setAttribute('height', '22');
        badgeR.setAttribute('rx', '4');
        badgeR.setAttribute('fill', deps >= 3 ? '#fbe0e0' : deps >= 2 ? '#fbeacc' : '#dde9f5');

        const badgeT = document.createElementNS(ns, 'text');
        badgeT.setAttribute('x', badgeX + 11);
        badgeT.setAttribute('y', badgeY + 16);
        badgeT.setAttribute('text-anchor', 'middle');
        badgeT.setAttribute('font-size', '12');
        badgeT.setAttribute('font-weight', '600');
        badgeT.setAttribute('fill', deps >= 3 ? '#8c2020' : deps >= 2 ? '#7a4d0e' : '#1a4f7a');
        badgeT.textContent = deps;

        elements.push(badgeR, badgeT);
      }

      // Bottom bar (thin, uses category color)
      const bar = document.createElementNS(ns, 'rect');
      bar.setAttribute('x', x + 6);
      bar.setAttribute('y', y + cardH - 4);
      bar.setAttribute('width', cardW - 12);
      bar.setAttribute('height', '2');
      bar.setAttribute('rx', '1');
      bar.setAttribute('fill', catColor);
      bar.setAttribute('opacity', '0.3');
      elements.push(bar);

      elements.forEach(el => g.appendChild(el));

      // Tooltip events
      g.addEventListener('mouseenter', () => {
        const prereqNames = prereqs.map(p => p.name).join(', ') || 'Nenhum';
        const dependents = DataStore.getDependents(course.code, data);
        const depNames = dependents.map(d => d.name).join(', ') || 'Nenhum';
        tip.innerHTML = `
          <strong>${course.name}</strong><br>
          <span style="color:#a09e98">${course.code} · Nível ${romanNums[course.level]} · ${course.credits}cr</span><br>
          <span style="color:#6b6860">Categoria: ${catName}</span><br>
          <span style="color:#6b6860">Pré-req: ${prereqNames}</span><br>
          <span style="color:#6b6860">Desbloqueia: ${depNames}</span>
        `;
        tip.style.opacity = '1';
      });
      g.addEventListener('mousemove', ev => {
        tip.style.left = (ev.clientX + 14) + 'px';
        tip.style.top = (ev.clientY - 10) + 'px';
      });
      g.addEventListener('mouseleave', () => {
        tip.style.opacity = '0';
      });
      g.addEventListener('click', () => traceNode(course.code));

      svg.appendChild(g);
    });
  }

  // ── Trace Prerequisites (Click) ──
  function traceNode(code) {
    if (activeTrace === code) {
      activeTrace = null; // toggle off
      const activeBtn = document.querySelector('.eixo-btn.active');
      filterByCat(activeBtn ? activeBtn.dataset.cat : 'all');
      return;
    }
    activeTrace = code;
    const svg = document.getElementById('flowSvg');

    // Reset axis buttons visual state to 'Todos' since we are doing a custom trace
    document.querySelectorAll('.eixo-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.eixo-btn[data-cat="all"]');
    if (allBtn) allBtn.classList.add('active');

    const requirements = currentData.requirements;

    // BFS to find all ancestors (prereqs)
    const ancestors = new Set([code]);
    let queue = [code];
    while (queue.length > 0) {
      const c = queue.shift();
      requirements.forEach(r => {
        if (r.to === c && !ancestors.has(r.from)) {
          ancestors.add(r.from);
          queue.push(r.from);
        }
      });
    }

    // BFS to find all descendants (dependents)
    const descendants = new Set([code]);
    queue = [code];
    while (queue.length > 0) {
      const c = queue.shift();
      requirements.forEach(r => {
        if (r.from === c && !descendants.has(r.to)) {
          descendants.add(r.to);
          queue.push(r.to);
        }
      });
    }

    const activeSet = new Set([...ancestors, ...descendants]);

    svg.querySelectorAll('.flow-node').forEach(el => {
      const c = el.dataset.code;
      if (activeSet.has(c)) {
        el.style.opacity = '1';
        el.querySelector('rect').setAttribute('stroke-width', c === code ? '2.5' : '1');
        if (c === code) el.querySelector('rect').setAttribute('stroke', 'var(--accent)');
      } else {
        el.style.opacity = '0.12';
        el.querySelector('rect').setAttribute('stroke-width', '1');
        // Restore original stroke if we modified it
        const catNode = el.dataset.cat ? currentData.categories.find(cat => cat.id === el.dataset.cat) : null;
        el.querySelector('rect').setAttribute('stroke', catNode ? catNode.color : '#1a4f7a');
      }
    });

    svg.querySelectorAll('.flow-edge').forEach(el => {
      const from = el.dataset.from;
      const to = el.dataset.to;
      if (activeSet.has(from) && activeSet.has(to)) {
        el.style.opacity = '1';
        el.setAttribute('stroke-width', '2');
      } else {
        el.style.opacity = '0.06';
        el.setAttribute('stroke-width', '1.2');
      }
    });
  }

  // ── Filter by category ──
  function filterByCat(catId) {
    activeTrace = null; // Clear trace if filtering by category
    const svg = document.getElementById('flowSvg');
    svg.querySelectorAll('.flow-node').forEach(el => {
      el.style.opacity = (catId === 'all' || el.dataset.cat === catId) ? '1' : '0.12';
      el.querySelector('rect').setAttribute('stroke-width', '1'); // reset stroke
      const catNode = el.dataset.cat ? currentData.categories.find(cat => cat.id === el.dataset.cat) : null;
      el.querySelector('rect').setAttribute('stroke', catNode ? catNode.color : '#1a4f7a');
    });
    svg.querySelectorAll('.flow-edge').forEach(el => {
      el.style.opacity = (catId === 'all' || el.dataset.cat === catId) ? '1' : '0.06';
      el.setAttribute('stroke-width', '1.2'); // reset stroke
    });
  }

  return { render };
})();
