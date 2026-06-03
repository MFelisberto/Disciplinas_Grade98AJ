// ══════════════════════════════════════════════════════════════
// heatmap.js — Heatmap de desempenho page
// ══════════════════════════════════════════════════════════════

const HeatmapPage = (() => {
  const hmDiscs = [
    'Fund. Programação','Prog. Orient. Obj.','Algoritmos I','Algoritmos II',
    'Cálculo I','Cálculo II','Prob. e Estatística','Eng. Software I',
    'Bancos de Dados I','Lógica p/ Computação'
  ];
  const hmSems = ['2024/1','2024/2','2025/1','2025/2','2026/1'];
  const hmData = {
    ocup:   [[82,85,89,91,94],[70,72,74,78,80],[65,68,72,74,76],[60,62,65,68,70],[88,91,93,92,94],[74,76,72,75,78],[66,68,70,72,74],[78,80,82,85,88],[58,60,62,64,66],[55,58,60,62,64]],
    reprov: [[38,36,32,30,28],[22,20,24,21,19],[30,28,26,25,23],[24,22,20,21,20],[44,42,40,41,38],[28,25,26,24,22],[25,24,22,20,19],[35,33,31,30,28],[18,17,16,15,14],[20,18,17,16,15]],
    cancel: [[12,11,10,10,9],[8,9,7,8,7],[9,8,8,7,7],[7,6,6,5,5],[10,9,9,8,8],[7,8,7,6,6],[8,7,7,6,6],[10,10,9,9,8],[5,5,4,4,4],[6,5,5,5,4]]
  };
  let currentMetric = 'ocup';

  function render(container) {
    container.innerHTML = `
      <div class="tab-panel active" id="panel-heatmap">
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
            <div class="card-title" style="margin:0">Métrica:</div>
            <div style="display:flex;gap:6px" id="metricBtns">
              <button class="metric-btn active" data-metric="ocup">% Ocupação</button>
              <button class="metric-btn" data-metric="reprov">% Reprovação</button>
              <button class="metric-btn" data-metric="cancel">% Cancelamento</button>
            </div>
          </div>
          <div class="hmap-wrap">
            <table class="hmap" id="hmTable"></table>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <span style="font-size:11px;color:var(--text3)">Baixo</span>
            <div id="hmLegend" style="display:flex;gap:3px"></div>
            <span style="font-size:11px;color:var(--text3)">Alto</span>
            <span style="font-size:11px;color:var(--text3);margin-left:12px">— clique numa célula para detalhes</span>
          </div>
        </div>
        <div id="hmDetail" class="card" style="display:none">
          <div id="hmDetailContent"></div>
        </div>
      </div>
    `;

    // Bind metric buttons
    container.querySelectorAll('.metric-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMetric = btn.dataset.metric;
        renderHeatmap();
      });
    });

    renderHeatmap();
  }

  function hmColor(v, metric) {
    const p = {
      ocup:   ['#dde9f5','#b5d4f4','#85b7eb','#5b9bd4','#2f79c0','#0c447c'],
      reprov: ['#fbe0e0','#f7c1c1','#f09595','#e24b4a','#a32d2d','#791f1f'],
      cancel: ['#fbeacc','#fac775','#ef9f27','#ba7517','#854f0b','#633806']
    }[metric];
    const r = { ocup:[50,65,75,85,92,101], reprov:[12,20,28,36,45,101], cancel:[4,7,10,13,16,101] }[metric];
    for (let i=0;i<r.length;i++) { if (v < r[i]) return p[i]; }
    return p[p.length-1];
  }

  function hmTextColor(v, metric) {
    const thresh = { ocup:75, reprov:28, cancel:10 };
    return v >= thresh[metric] ? '#fff' : '#1a1916';
  }

  function renderHeatmap() {
    const data = hmData[currentMetric];
    let html = '<thead><tr><th class="disc-col">Disciplina</th>';
    hmSems.forEach(s => { html += `<th style="text-align:center">${s}</th>`; });
    html += '</tr></thead><tbody>';
    hmDiscs.forEach((d,di) => {
      html += `<tr><td style="font-size:11px;padding:4px 8px;color:#6b6860;white-space:nowrap">${d}</td>`;
      data[di].forEach((v,si) => {
        const bg = hmColor(v, currentMetric);
        const tc = hmTextColor(v, currentMetric);
        html += `<td style="background:${bg};color:${tc};font-size:11px" data-disc="${d}" data-val="${v}" data-sem="${hmSems[si]}">${v}%</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    document.getElementById('hmTable').innerHTML = html;

    // Bind click events
    document.querySelectorAll('#hmTable td[data-disc]').forEach(td => {
      td.addEventListener('click', () => {
        hmDetail(td.dataset.disc, parseInt(td.dataset.val), td.dataset.sem);
      });
    });

    const pal = {
      ocup:   ['#dde9f5','#b5d4f4','#85b7eb','#5b9bd4','#2f79c0','#0c447c'],
      reprov: ['#fbe0e0','#f7c1c1','#f09595','#e24b4a','#a32d2d','#791f1f'],
      cancel: ['#fbeacc','#fac775','#ef9f27','#ba7517','#854f0b','#633806']
    }[currentMetric];
    document.getElementById('hmLegend').innerHTML = pal.map(c => `<span style="width:22px;height:10px;border-radius:2px;background:${c};display:inline-block"></span>`).join('');
  }

  function hmDetail(disc, val, sem) {
    const metricLabels = { ocup:'Ocupação', reprov:'Reprovação', cancel:'Cancelamento' };
    const trend = currentMetric==='ocup'
      ? (val>88 ? '⚠ Considerar abertura de turma adicional' : val>70 ? '✓ Situação moderada — monitorar' : '↓ Baixa ocupação — avaliar demanda')
      : (val>35 ? '⚠ Taxa elevada — revisar apoio pedagógico' : val>20 ? '⚠ Taxa moderada — acompanhar' : '✓ Taxa dentro do esperado');
    document.getElementById('hmDetailContent').innerHTML = `
      <div style="font-size:13px;font-weight:500;margin-bottom:4px">${disc}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${metricLabels[currentMetric]} em ${sem}: <span style="font-weight:500;font-family:var(--mono)">${val}%</span></div>
      <div style="font-size:12px;color:var(--text2)">${trend}</div>
    `;
    document.getElementById('hmDetail').style.display = 'block';
  }

  return { render };
})();
