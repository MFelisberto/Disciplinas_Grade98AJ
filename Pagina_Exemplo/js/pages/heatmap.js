// ══════════════════════════════════════════════════════════════
// heatmap.js — Mapa topográfico de desempenho (canvas terrain)
// Renders a continuous relief map using IDW interpolation,
// hillshading, and contour lines on a <canvas>, with SVG
// marker labels floating above.
// ══════════════════════════════════════════════════════════════

const HeatmapPage = (() => {
  let currentData = null;
  let simData = null;
  let currentMetric = 'ocup';
  let currentSemIdx = 4;
  let activeTrace = null;
  const semesters = ['2024/1', '2024/2', '2025/1', '2025/2', '2026/1'];
  const romanNums = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  // ── Deterministic pseudo-random ──
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function prng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ── Generate simulated metrics ──
  function generateSimData(courses) {
    const d = { ocup: {}, reprov: {}, cancel: {} };
    courses.forEach(c => {
      const rng = prng(hash(c.code));
      const lvF = 1 - (c.level - 1) * 0.04;
      let bO = (55 + rng() * 40) * lvF;
      
      // Artificially boost occupancy for mid-level courses (levels 4 and 5) 
      // to create a nice topographic "mountain range" in the middle of the map
      if (c.level === 4 || c.level === 5) {
         bO += 20 + rng() * 15;
      }

      const bR = 8 + rng() * 34;
      const bC = 2 + rng() * 14;
      d.ocup[c.code] = []; d.reprov[c.code] = []; d.cancel[c.code] = [];
      for (let si = 0; si < semesters.length; si++) {
        const t = (si - 2) * (rng() * 2 - 0.6);
        d.ocup[c.code].push(Math.round(Math.min(98, Math.max(28, bO + t + rng() * 8 - 4))));
        d.reprov[c.code].push(Math.round(Math.min(50, Math.max(5, bR + t * 0.4 + rng() * 5 - 2.5))));
        d.cancel[c.code].push(Math.round(Math.min(20, Math.max(2, bC + t * 0.3 + rng() * 3 - 1.5))));
      }
    });
    return d;
  }

  // ── Normalize value to 0–1 ──
  function normalize(v, metric) {
    const ranges = { ocup: [25, 98], reprov: [5, 50], cancel: [2, 20] };
    const [lo, hi] = ranges[metric];
    return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  }

  // ══════════════════════════════════════════════════════════
  // TERRAIN COLOR RAMPS — matching real geographic relief
  // ══════════════════════════════════════════════════════════

  function interpolateStops(stops, t) {
    t = Math.max(0, Math.min(1, t));
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) { lo = stops[i]; hi = stops[i + 1]; break; }
    }
    const f = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
    return [
      Math.round(lo.r + (hi.r - lo.r) * f),
      Math.round(lo.g + (hi.g - lo.g) * f),
      Math.round(lo.b + (hi.b - lo.b) * f)
    ];
  }

  // Geographic relief ramp: deep blue → green → yellow → orange → brown
  const stopsOcup = [
    { t: 0.00, r: 36, g: 68, b: 114 },
    { t: 0.06, r: 52, g: 102, b: 162 },
    { t: 0.12, r: 92, g: 150, b: 196 },
    { t: 0.18, r: 132, g: 186, b: 210 },
    { t: 0.24, r: 30, g: 130, b: 76 },
    { t: 0.32, r: 52, g: 168, b: 83 },
    { t: 0.40, r: 108, g: 198, b: 94 },
    { t: 0.48, r: 178, g: 216, b: 76 },
    { t: 0.56, r: 228, g: 212, b: 52 },
    { t: 0.64, r: 242, g: 186, b: 28 },
    { t: 0.72, r: 230, g: 140, b: 24 },
    { t: 0.80, r: 200, g: 96, b: 32 },
    { t: 0.88, r: 168, g: 62, b: 34 },
    { t: 0.94, r: 134, g: 48, b: 30 },
    { t: 1.00, r: 96, g: 34, b: 24 }
  ];

  // Alert ramp: green → yellow → orange → red → dark red
  const stopsAlert = [
    { t: 0.00, r: 30, g: 136, b: 80 },
    { t: 0.15, r: 56, g: 174, b: 92 },
    { t: 0.30, r: 142, g: 210, b: 102 },
    { t: 0.45, r: 218, g: 218, b: 68 },
    { t: 0.58, r: 242, g: 186, b: 28 },
    { t: 0.72, r: 228, g: 120, b: 28 },
    { t: 0.84, r: 196, g: 56, b: 40 },
    { t: 0.94, r: 148, g: 34, b: 30 },
    { t: 1.00, r: 106, g: 24, b: 22 }
  ];

  function terrainColor(t, metric) {
    return interpolateStops(metric === 'ocup' ? stopsOcup : stopsAlert, t);
  }

  // Get card-level elevation color (for badges)
  function elevColor(v, metric) {
    const t = normalize(v, metric);
    const [r, g, b] = terrainColor(t, metric);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return {
      fill: `rgb(${r},${g},${b})`,
      text: lum > 140 ? '#1a1916' : '#ffffff'
    };
  }

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════

  async function render(container) {
    const data = await DataStore.load();
    currentData = data;
    const { courses, categories, curriculum } = data;
    const catMap = DataStore.categoryMap(categories);

    const filtered = courses.filter(c => !c.tags || !c.tags.includes('eletivas'));
    simData = generateSimData(filtered);

    const grouped = DataStore.groupByLevel(filtered);
    const maxPerLevel = Math.max(...Object.values(grouped).map(g => g.length));
    const cardW = 174, cardH = 52;
    const colW = 214, rowH = 74;
    const padLeft = 50, padTop = 76;
    const svgW = padLeft + curriculum.levels * colW + 60;
    const svgH = padTop + maxPerLevel * rowH + 60;

    container.innerHTML = `
      <div class="tab-panel active" id="panel-heatmap">
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <div>
              <div class="card-title" style="margin:0;display:flex;align-items:center;gap:6px;">
                <i class="ti ti-mountain" style="font-size:14px;color:var(--accent);"></i>
                Mapa topográfico de desempenho
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px;">
                Terreno contínuo interpolado · Hillshading 3D · Curvas de nível · Clique para traçar pré-requisitos
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="metricBtns">
              <button class="metric-btn active" data-metric="ocup">🌍 Ocupação</button>
              <button class="metric-btn" data-metric="reprov">📉 Reprovação</button>
              <button class="metric-btn" data-metric="cancel">✕ Cancelamento</button>
            </div>
          </div>

          <div class="topo-sem-bar">
            <span style="font-size:11px;color:var(--text3);white-space:nowrap;">Semestre:</span>
            <input type="range" id="semSlider" min="0" max="${semesters.length - 1}" value="${currentSemIdx}"
                   style="flex:1;accent-color:var(--accent);cursor:pointer;">
            <span id="semLabel" class="topo-sem-label">${semesters[currentSemIdx]}</span>
          </div>

          <div class="topo-wrap">
            <div id="terrainBox" style="position:relative;width:${svgW}px;height:${svgH}px;">
              <canvas id="terrainCanvas" width="${svgW}" height="${svgH}"
                      style="position:absolute;top:0;left:0;width:${svgW}px;height:${svgH}px;border-radius:12px;"></canvas>
              <svg id="topoSvg" viewBox="0 0 ${svgW} ${svgH}"
                   style="position:relative;z-index:2;width:${svgW}px;height:${svgH}px;display:block;"></svg>
            </div>
          </div>

          <div id="topoLegendCanvas" style="margin-top:10px;"></div>
        </div>

        <div id="topoDetail" class="card" style="display:none">
          <div id="topoDetailContent"></div>
        </div>
      </div>
    `;

    const dims = { cardW, cardH, colW, rowH, padLeft, padTop, svgW, svgH };

    // Bind metric buttons
    container.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMetric = btn.dataset.metric;
        activeTrace = null;
        renderTopo(filtered, catMap, grouped, dims);
      });
    });

    // Bind semester slider
    document.getElementById('semSlider').addEventListener('input', e => {
      currentSemIdx = parseInt(e.target.value);
      document.getElementById('semLabel').textContent = semesters[currentSemIdx];
      renderTopo(filtered, catMap, grouped, dims);
    });

    renderTopo(filtered, catMap, grouped, dims);
  }

  // ══════════════════════════════════════════════════════════
  // RENDER TOPOGRAPHIC MAP
  // ══════════════════════════════════════════════════════════

  function renderTopo(courses, catMap, grouped, dims) {
    const { cardW, cardH, colW, rowH, padLeft, padTop, svgW, svgH } = dims;
    const svg = document.getElementById('topoSvg');
    const ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';

    // ── Compute node positions and values ──
    const nodePos = {};
    const sortedLevels = Object.keys(grouped).map(Number).sort((a, b) => a - b);

    sortedLevels.forEach(lv => {
      grouped[lv].forEach((course, idx) => {
        const x = padLeft + (lv - 1) * colW;
        const y = padTop + idx * rowH;
        const val = simData[currentMetric][course.code]
          ? simData[currentMetric][course.code][currentSemIdx] : 50;
        nodePos[course.code] = {
          x, y, course,
          cat: catMap[course.category],
          val,
          elev: normalize(val, currentMetric),
          color: elevColor(val, currentMetric)
        };
      });
    });

    // ══════════════════════════════════════════
    // 1) RENDER CANVAS TERRAIN
    // ══════════════════════════════════════════
    renderTerrainCanvas(nodePos, dims);

    // ══════════════════════════════════════════
    // 2) SVG OVERLAY: labels, edges, markers
    // ══════════════════════════════════════════

    // ── Defs ──
    const defs = document.createElementNS(ns, 'defs');

    // Drop shadow for cards
    const filt = document.createElementNS(ns, 'filter');
    filt.setAttribute('id', 'labelShadow');
    filt.setAttribute('x', '-20%'); filt.setAttribute('y', '-20%');
    filt.setAttribute('width', '140%'); filt.setAttribute('height', '160%');
    const feB = document.createElementNS(ns, 'feDropShadow');
    feB.setAttribute('dx', '0'); feB.setAttribute('dy', '2');
    feB.setAttribute('stdDeviation', '3');
    feB.setAttribute('flood-color', 'rgba(0,0,0,0.35)');
    filt.appendChild(feB);
    defs.appendChild(filt);

    svg.appendChild(defs);

    // ── Level column headers ──
    sortedLevels.forEach(lv => {
      const cx = padLeft + (lv - 1) * colW + cardW / 2;

      // Header badge
      const bg = document.createElementNS(ns, 'rect');
      bg.setAttribute('x', cx - 36); bg.setAttribute('y', 6);
      bg.setAttribute('width', 72); bg.setAttribute('height', 24);
      bg.setAttribute('rx', 12);
      bg.setAttribute('fill', 'rgba(0,0,0,0.45)');
      svg.appendChild(bg);

      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', 23);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '11'); t.setAttribute('fill', '#fff');
      t.setAttribute('font-weight', '600');
      t.textContent = `Nível ${romanNums[lv]}`;
      svg.appendChild(t);

      // Vertical guide
      const maxY = padTop + grouped[lv].length * rowH;
      const vl = document.createElementNS(ns, 'line');
      vl.setAttribute('x1', cx); vl.setAttribute('y1', 36);
      vl.setAttribute('x2', cx); vl.setAttribute('y2', maxY);
      vl.setAttribute('stroke', 'rgba(255,255,255,0.12)');
      vl.setAttribute('stroke-width', '1');
      vl.setAttribute('stroke-dasharray', '3,5');
      svg.appendChild(vl);
    });

    // ── Prerequisite edges ──
    currentData.requirements.forEach(req => {
      const from = nodePos[req.from], to = nodePos[req.to];
      if (!from || !to) return;
      const x1 = from.x + cardW, y1 = from.y + cardH / 2;
      const x2 = to.x, y2 = to.y + cardH / 2;
      const mx = (x1 + x2) / 2;

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(255,255,255,0.18)');
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('stroke-dasharray', '4,4');
      path.setAttribute('data-from', req.from);
      path.setAttribute('data-to', req.to);
      path.classList.add('topo-edge');
      svg.appendChild(path);
    });

    // ── Tooltip ──
    let tip = document.getElementById('topoTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'topo-tooltip'; tip.id = 'topoTooltip';
      document.body.appendChild(tip);
    }

    const metricNames = { ocup: 'Ocupação', reprov: 'Reprovação', cancel: 'Cancelamento' };
    let delayIdx = 0;

    // ── Card markers ──
    Object.values(nodePos).forEach(node => {
      const { x, y, course, cat, val, elev, color } = node;
      const catColor = cat ? cat.color : '#1a4f7a';
      const catName = cat ? cat.name : '';

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'topo-node');
      g.setAttribute('data-code', course.code);
      g.style.cursor = 'pointer';
      g.style.animationDelay = `${delayIdx * 25}ms`;
      delayIdx++;

      // ── Pin dot on terrain ──
      const pinCx = x + cardW / 2;
      const pinCy = y + cardH + 6;
      const pinDot = document.createElementNS(ns, 'circle');
      pinDot.setAttribute('cx', pinCx);
      pinDot.setAttribute('cy', pinCy);
      pinDot.setAttribute('r', '4');
      pinDot.setAttribute('fill', catColor);
      pinDot.setAttribute('stroke', '#fff');
      pinDot.setAttribute('stroke-width', '1.5');

      // ── Pin line ──
      const pinLine = document.createElementNS(ns, 'line');
      pinLine.setAttribute('x1', pinCx); pinLine.setAttribute('y1', pinCy - 4);
      pinLine.setAttribute('x2', pinCx); pinLine.setAttribute('y2', y + cardH);
      pinLine.setAttribute('stroke', 'rgba(255,255,255,0.4)');
      pinLine.setAttribute('stroke-width', '1');

      // ── Card background (glassmorphism) ──
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', cardW); rect.setAttribute('height', cardH);
      rect.setAttribute('rx', '7');
      rect.setAttribute('fill', 'rgba(0,0,0,0.52)');
      rect.setAttribute('stroke', 'rgba(255,255,255,0.18)');
      rect.setAttribute('stroke-width', '0.8');
      rect.setAttribute('filter', 'url(#labelShadow)');
      rect.classList.add('topo-card-rect');

      // ── Category color strip ──
      const strip = document.createElementNS(ns, 'rect');
      strip.setAttribute('x', x); strip.setAttribute('y', y + 6);
      strip.setAttribute('width', '3'); strip.setAttribute('height', cardH - 12);
      strip.setAttribute('rx', '1.5');
      strip.setAttribute('fill', catColor); strip.setAttribute('opacity', '0.85');

      // ── Course name (with paint-order halo) ──
      const maxLen = 21;
      const label = course.name.length > maxLen
        ? course.name.substring(0, maxLen - 1) + '…' : course.name;
      const txt1 = document.createElementNS(ns, 'text');
      txt1.setAttribute('x', x + 12); txt1.setAttribute('y', y + 18);
      txt1.setAttribute('font-size', '11.5'); txt1.setAttribute('fill', '#fff');
      txt1.setAttribute('font-weight', '500');
      txt1.setAttribute('paint-order', 'stroke');
      txt1.setAttribute('stroke', 'rgba(0,0,0,0.3)');
      txt1.setAttribute('stroke-width', '1.5');
      txt1.textContent = label;

      // ── Code + credits ──
      const txt2 = document.createElementNS(ns, 'text');
      txt2.setAttribute('x', x + 12); txt2.setAttribute('y', y + 33);
      txt2.setAttribute('font-size', '9.5'); txt2.setAttribute('fill', 'rgba(255,255,255,0.55)');
      txt2.textContent = `${course.code} · ${course.credits}cr`;

      // ── Percentage badge ──
      const bW = 38, bH = 18;
      const bx = x + cardW - bW - 6, by = y + 6;
      const badge = document.createElementNS(ns, 'rect');
      badge.setAttribute('x', bx); badge.setAttribute('y', by);
      badge.setAttribute('width', bW); badge.setAttribute('height', bH);
      badge.setAttribute('rx', '4');
      badge.setAttribute('fill', color.fill);

      const badgeT = document.createElementNS(ns, 'text');
      badgeT.setAttribute('x', bx + bW / 2); badgeT.setAttribute('y', by + 13);
      badgeT.setAttribute('text-anchor', 'middle');
      badgeT.setAttribute('font-size', '10.5'); badgeT.setAttribute('font-weight', '700');
      badgeT.setAttribute('fill', color.text);
      badgeT.textContent = `${val}%`;

      // ── Elevation mini-bar ──
      const barW = cardW - 14;
      const barBg = document.createElementNS(ns, 'rect');
      barBg.setAttribute('x', x + 7); barBg.setAttribute('y', y + cardH - 5);
      barBg.setAttribute('width', barW); barBg.setAttribute('height', '2');
      barBg.setAttribute('rx', '1'); barBg.setAttribute('fill', 'rgba(255,255,255,0.1)');

      const barFill = document.createElementNS(ns, 'rect');
      barFill.setAttribute('x', x + 7); barFill.setAttribute('y', y + cardH - 5);
      barFill.setAttribute('width', barW * elev); barFill.setAttribute('height', '2');
      barFill.setAttribute('rx', '1'); barFill.setAttribute('fill', color.fill);

      [pinDot, pinLine, rect, strip, txt1, txt2, badge, badgeT, barBg, barFill].forEach(el => g.appendChild(el));

      // ── Peak / Valley label ──
      if (elev > 0.72) {
        const pk = document.createElementNS(ns, 'text');
        pk.setAttribute('x', x + 12); pk.setAttribute('y', y + 46);
        pk.setAttribute('font-size', '8.5'); pk.setAttribute('fill', 'rgba(255,255,255,0.45)');
        pk.setAttribute('font-style', 'italic');
        pk.textContent = '▲ Pico';
        g.appendChild(pk);
      } else if (elev < 0.22) {
        const vl = document.createElementNS(ns, 'text');
        vl.setAttribute('x', x + 12); vl.setAttribute('y', y + 46);
        vl.setAttribute('font-size', '8.5'); vl.setAttribute('fill', 'rgba(255,255,255,0.45)');
        vl.setAttribute('font-style', 'italic');
        vl.textContent = '▽ Vale';
        g.appendChild(vl);
      }

      // ── Tooltip events ──
      const prereqs = DataStore.getPrerequisites(course.code, currentData);
      const dependents = DataStore.getDependents(course.code, currentData);
      const prereqNames = prereqs.map(p => p.name).join(', ') || 'Nenhum';
      const depNames = dependents.map(d => d.name).join(', ') || 'Nenhum';
      const metricArr = simData[currentMetric][course.code];
      let trend = '';
      if (metricArr && currentSemIdx > 0) {
        const diff = metricArr[currentSemIdx] - metricArr[currentSemIdx - 1];
        if (diff > 0) trend = `<span style="color:#e76f51">↑ +${diff}pp</span>`;
        else if (diff < 0) trend = `<span style="color:#2ecc71">↓ ${diff}pp</span>`;
        else trend = `<span style="color:#a09e98">→ estável</span>`;
      }

      g.addEventListener('mouseenter', () => {
        tip.innerHTML = `
          <div style="font-weight:600;margin-bottom:4px;">${course.name}</div>
          <div style="color:#a09e98;margin-bottom:6px;">${course.code} · Nível ${romanNums[course.level]} · ${catName}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color.fill};"></span>
            <span>${metricNames[currentMetric]}: <strong>${val}%</strong></span>
            ${trend}
          </div>
          <div style="font-size:10px;color:#a09e98;border-top:1px solid rgba(0,0,0,0.08);padding-top:5px;margin-top:4px;">
            Pré-req: ${prereqNames}<br>Desbloqueia: ${depNames}
          </div>`;
        tip.style.opacity = '1';
      });
      g.addEventListener('mousemove', ev => {
        tip.style.left = (ev.clientX + 16) + 'px';
        tip.style.top = (ev.clientY - 12) + 'px';
      });
      g.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
      g.addEventListener('click', () => traceNode(course.code));

      svg.appendChild(g);
    });

    // ── Render legend ──
    renderLegend();

    // ── Restore trace if active ──
    if (activeTrace) traceNode(activeTrace);
  }

  // ══════════════════════════════════════════════════════════
  // CANVAS TERRAIN RENDERER — IDW + Hillshade + Contours
  // ══════════════════════════════════════════════════════════

  function renderTerrainCanvas(nodePos, dims) {
    const { cardW, cardH, svgW, svgH } = dims;
    const canvas = document.getElementById('terrainCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = svgW;
    canvas.height = svgH;

    const step = 4; // pixel step (lower = higher quality, slower)
    const gridW = Math.ceil(svgW / step);
    const gridH = Math.ceil(svgH / step);
    const grid = new Float32Array(gridW * gridH);

    const nodeArr = Object.values(nodePos);
    const sigma = 155; // Gaussian influence radius
    const sigma2x2 = 2 * sigma * sigma;
    const cutoff2 = (3.2 * sigma) * (3.2 * sigma);

    // ── Pass 1: Gaussian-weighted IDW interpolation ──
    for (let gy = 0; gy < gridH; gy++) {
      const py = gy * step;
      for (let gx = 0; gx < gridW; gx++) {
        const px = gx * step;
        let sumW = 0, sumWV = 0;

        for (let ni = 0; ni < nodeArr.length; ni++) {
          const node = nodeArr[ni];
          const cx = node.x + cardW / 2;
          const cy = node.y + cardH / 2;
          const dx = px - cx, dy = py - cy;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > cutoff2) continue;
          const w = Math.exp(-dist2 / sigma2x2);
          sumW += w;
          sumWV += w * node.elev;
        }

        // Bias toward "sea level" at extreme edges
        const edgeDist = Math.min(px, py, svgW - px, svgH - py);
        const edgeFade = Math.min(1, edgeDist / 50);
        const baseW = 0.02;
        sumW += baseW;
        sumWV += baseW * 0.04;

        grid[gy * gridW + gx] = (sumW > 0.001 ? sumWV / sumW : 0) * edgeFade;
      }
    }

    // ── Pass 2: Render pixels with color + hillshade + contours ──
    const imgData = ctx.createImageData(svgW, svgH);
    const lightAz = 315 * Math.PI / 180;
    const lightAlt = 45 * Math.PI / 180;
    const sinAlt = Math.sin(lightAlt);
    const cosAlt = Math.cos(lightAlt);
    const contourThresholds = [0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92];

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const val = grid[gy * gridW + gx];

        // ── Hillshade ──
        let shade = 1;
        if (gx > 0 && gx < gridW - 1 && gy > 0 && gy < gridH - 1) {
          const dzdx = (grid[gy * gridW + gx + 1] - grid[gy * gridW + gx - 1]) * 6;
          const dzdy = (grid[(gy + 1) * gridW + gx] - grid[(gy - 1) * gridW + gx]) * 6;
          const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
          const aspect = Math.atan2(-dzdy, dzdx);
          const hs = Math.cos(slope) * sinAlt + Math.sin(slope) * cosAlt * Math.cos(aspect - lightAz);
          shade = 0.52 + 0.48 * Math.max(0, Math.min(1, hs));
        }

        // ── Contour lines ──
        let isContour = false;
        if (gx > 0 && gy > 0) {
          const valL = grid[gy * gridW + gx - 1];
          const valU = grid[(gy - 1) * gridW + gx];
          for (let ci = 0; ci < contourThresholds.length; ci++) {
            const th = contourThresholds[ci];
            if ((val >= th && (valL < th || valU < th)) ||
                (val < th && (valL >= th || valU >= th))) {
              isContour = true;
              break;
            }
          }
        }

        const [r, g, b] = terrainColor(val, currentMetric);
        let fr = r * shade, fg = g * shade, fb = b * shade;

        // Darken contour lines slightly
        if (isContour) {
          fr = fr * 0.72;
          fg = fg * 0.72;
          fb = fb * 0.72;
        }

        // ── Fill pixel block ──
        for (let oy = 0; oy < step && gy * step + oy < svgH; oy++) {
          for (let ox = 0; ox < step && gx * step + ox < svgW; ox++) {
            const idx = ((gy * step + oy) * svgW + (gx * step + ox)) * 4;
            imgData.data[idx] = Math.round(fr);
            imgData.data[idx + 1] = Math.round(fg);
            imgData.data[idx + 2] = Math.round(fb);
            imgData.data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // ══════════════════════════════════════════════════════════
  // ALTITUDE LEGEND
  // ══════════════════════════════════════════════════════════

  function renderLegend() {
    const el = document.getElementById('topoLegendCanvas');
    const labels = {
      ocup: { lo: '28%', hi: '98%', title: 'Ocupação' },
      reprov: { lo: '5%', hi: '50%', title: 'Reprovação' },
      cancel: { lo: '2%', hi: '20%', title: 'Cancelamento' }
    }[currentMetric];

    // Render legend via small canvas
    const w = 240, h = 14;
    const lc = document.createElement('canvas');
    lc.width = w; lc.height = h;
    const lctx = lc.getContext('2d');
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const [r, g, b] = terrainColor(t, currentMetric);
      lctx.fillStyle = `rgb(${r},${g},${b})`;
      lctx.fillRect(x, 0, 1, h);
    }
    const dataUrl = lc.toDataURL();

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;padding-top:14px;border-top:1px solid var(--border);">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap;">
          <i class="ti ti-arrow-down" style="font-size:11px;"></i> ${labels.lo}
        </span>
        <img src="${dataUrl}" alt="Altitude legend"
             style="flex:1;height:12px;border-radius:6px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.15),0 1px 0 rgba(255,255,255,0.5);">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap;">
          ${labels.hi} <i class="ti ti-arrow-up" style="font-size:11px;"></i>
        </span>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;font-style:italic;">
          ${labels.title} — curvas de nível ativadas
        </span>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════
  // TRACE PREREQUISITES (CLICK)
  // ══════════════════════════════════════════════════════════

  function traceNode(code) {
    if (activeTrace === code) { activeTrace = null; resetTrace(); return; }
    activeTrace = code;
    const svg = document.getElementById('topoSvg');
    const requirements = currentData.requirements;

    // BFS ancestors
    const ancestors = new Set([code]);
    let queue = [code];
    while (queue.length > 0) {
      const c = queue.shift();
      requirements.forEach(r => {
        if (r.to === c && !ancestors.has(r.from)) { ancestors.add(r.from); queue.push(r.from); }
      });
    }

    // BFS descendants
    const descendants = new Set([code]);
    queue = [code];
    while (queue.length > 0) {
      const c = queue.shift();
      requirements.forEach(r => {
        if (r.from === c && !descendants.has(r.to)) { descendants.add(r.to); queue.push(r.to); }
      });
    }

    const activeSet = new Set([...ancestors, ...descendants]);

    svg.querySelectorAll('.topo-node').forEach(el => {
      const c = el.dataset.code;
      if (activeSet.has(c)) {
        el.style.opacity = '1';
        el.style.transition = 'opacity 0.3s ease';
        if (c === code) {
          const cr = el.querySelector('.topo-card-rect');
          if (cr) { cr.setAttribute('stroke', '#fff'); cr.setAttribute('stroke-width', '2'); }
        }
      } else {
        el.style.opacity = '0.15';
        el.style.transition = 'opacity 0.3s ease';
      }
    });

    svg.querySelectorAll('.topo-edge').forEach(el => {
      if (activeSet.has(el.dataset.from) && activeSet.has(el.dataset.to)) {
        el.setAttribute('stroke', 'rgba(255,255,255,0.7)');
        el.setAttribute('stroke-width', '2.5');
        el.setAttribute('stroke-dasharray', 'none');
        el.style.opacity = '1';
      } else {
        el.style.opacity = '0.04';
      }
    });

    showDetail(code);
  }

  function resetTrace() {
    const svg = document.getElementById('topoSvg');
    svg.querySelectorAll('.topo-node').forEach(el => {
      el.style.opacity = '1';
      el.style.transition = 'opacity 0.3s ease';
      const cr = el.querySelector('.topo-card-rect');
      if (cr) { cr.setAttribute('stroke', 'rgba(255,255,255,0.18)'); cr.setAttribute('stroke-width', '0.8'); }
    });
    svg.querySelectorAll('.topo-edge').forEach(el => {
      el.setAttribute('stroke', 'rgba(255,255,255,0.18)');
      el.setAttribute('stroke-width', '1.2');
      el.setAttribute('stroke-dasharray', '4,4');
      el.style.opacity = '1';
    });
    document.getElementById('topoDetail').style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════
  // DETAIL CARD
  // ══════════════════════════════════════════════════════════

  function showDetail(code) {
    const course = currentData.courses.find(c => c.code === code);
    if (!course) return;
    const metricNames = { ocup: 'Ocupação', reprov: 'Reprovação', cancel: 'Cancelamento' };
    const vals = simData[currentMetric][code];
    if (!vals) return;

    const val = vals[currentSemIdx];
    const color = elevColor(val, currentMetric);
    const prereqs = DataStore.getPrerequisites(code, currentData);
    const dependents = DataStore.getDependents(code, currentData);

    // Sparkline
    const sparkW = 140, sparkH = 34;
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const pts = vals.map((v, i) => {
      const px = (i / (vals.length - 1)) * sparkW;
      const py = sparkH - ((v - minV) / range) * sparkH;
      return `${px},${py}`;
    }).join(' ');

    const trend = currentMetric === 'ocup'
      ? (val > 88 ? '⚠ Considerar abertura de turma adicional'
        : val > 70 ? '✓ Situação moderada — monitorar'
        : '↓ Baixa ocupação — avaliar demanda')
      : (val > 35 ? '⚠ Taxa elevada — revisar apoio pedagógico'
        : val > 20 ? '⚠ Taxa moderada — acompanhar'
        : '✓ Taxa dentro do esperado');

    document.getElementById('topoDetailContent').innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${color.fill};"></span>
            <span style="font-size:14px;font-weight:500;">${course.name}</span>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">
            ${course.code} · Nível ${romanNums[course.level]} · ${course.credits}cr · ${course.hours}h
          </div>
          <div style="font-size:13px;margin-bottom:6px;">
            ${metricNames[currentMetric]} em ${semesters[currentSemIdx]}:
            <span style="font-weight:600;font-family:var(--mono);background:${color.fill};color:${color.text};padding:2px 8px;border-radius:4px;">${val}%</span>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${trend}</div>
          ${prereqs.length > 0 ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">Pré-req: ${prereqs.map(p => p.name).join(', ')}</div>` : ''}
          ${dependents.length > 0 ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">Desbloqueia: ${dependents.map(d => d.name).join(', ')}</div>` : ''}
        </div>
        <div style="min-width:160px;">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Evolução semestral</div>
          <svg width="${sparkW}" height="${sparkH}" style="display:block;">
            <polyline points="${pts}" fill="none" stroke="${color.fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${vals.map((v, i) => {
              const px = (i / (vals.length - 1)) * sparkW;
              const py = sparkH - ((v - minV) / range) * sparkH;
              return `<circle cx="${px}" cy="${py}" r="3" fill="${color.fill}" stroke="#fff" stroke-width="1.5"/>`;
            }).join('')}
          </svg>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:3px;">
            <span>${semesters[0]}</span><span>${semesters[semesters.length - 1]}</span>
          </div>
        </div>
      </div>`;
    document.getElementById('topoDetail').style.display = 'block';
  }

  return { render };
})();
