// ══════════════════════════════════════════════════════════════
// multi.js — Análise multidomínio page
// ══════════════════════════════════════════════════════════════

const MultiPage = (() => {
  const sharedDiscs = [
    { name:'Fund. Programação',  code:'4611C', cursos:['CC','ES','SI','CDIA'], dem:[90,60,40,20], vagas:200 },
    { name:'Cálculo I',          code:'95300', cursos:['CC','ES','EC'],        dem:[90,50,30],     vagas:140 },
    { name:'Eng. Software I',    code:'93801', cursos:['CC','ES','SI'],        dem:[45,50,40],     vagas:90  },
    { name:'Inteligência Artif.',code:'98708', cursos:['CC','CDIA'],           dem:[60,55],        vagas:100 },
    { name:'BD I',               code:'98901', cursos:['CC','SI','ES'],        dem:[55,45,30],     vagas:100 },
  ];
  const courseColors = { CC:'#185FA5', ES:'#1D9E75', SI:'#BA7517', CDIA:'#A32D2D', EC:'#534AB7' };
  let multiChart = null;
  const grid = 'rgba(0,0,0,0.05)';

  function render(container) {
    multiChart = null;

    container.innerHTML = `
      <div class="tab-panel active" id="panel-multi">
        <div class="grid-4" style="margin-bottom:16px">
          <div class="kpi-card">
            <div class="kpi-label"><span class="course-dot" style="background:#185FA5"></span> Ciência da Computação</div>
            <div class="kpi-val">487</div>
            <div class="kpi-delta delta-neu">alunos ativos</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span class="course-dot" style="background:#1D9E75"></span> Engenharia de Software</div>
            <div class="kpi-val">312</div>
            <div class="kpi-delta delta-neu">alunos ativos</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span class="course-dot" style="background:#BA7517"></span> Sistemas de Informação</div>
            <div class="kpi-val">274</div>
            <div class="kpi-delta delta-neu">alunos ativos</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span class="course-dot" style="background:#A32D2D"></span> CDIA + Eng. Computação</div>
            <div class="kpi-val">189</div>
            <div class="kpi-delta delta-neu">alunos ativos</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">Disciplinas compartilhadas — pressão de vagas</div>
            <table class="tbl">
              <thead>
                <tr><th>Disciplina</th><th>Cursos</th><th>Demanda total</th><th>Vagas ofertadas</th><th>Pressão</th></tr>
              </thead>
              <tbody id="multiTable"></tbody>
            </table>
          </div>
          <div class="card">
            <div class="card-title">Distribuição de vagas por curso — disciplinas compartilhadas</div>
            <div style="position:relative;height:220px">
              <canvas id="chartMulti" role="img" aria-label="Distribuição de alunos por curso em disciplinas compartilhadas"></canvas>
            </div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-title">Mapa de compartilhamento — disciplinas × cursos</div>
          <div style="overflow-x:auto">
            <table class="tbl" id="sharingMatrix"></table>
          </div>
        </div>
      </div>
    `;

    renderMultiContent();
  }

  function renderMultiContent() {
    const tbody = document.getElementById('multiTable');
    let rows = '';
    sharedDiscs.forEach(d => {
      const total = d.dem.reduce((a,b)=>a+b,0);
      const press = Math.round((total/d.vagas)*100);
      const pressChip = press > 110 ? `<span class="chip chip-red" style="font-size:10px">${press}%</span>`
        : press > 90 ? `<span class="chip chip-amber" style="font-size:10px">${press}%</span>`
        : `<span class="chip chip-green" style="font-size:10px">${press}%</span>`;
      rows += `<tr>
        <td>${d.name} <span class="mono-code">${d.code}</span></td>
        <td>${d.cursos.map(c=>`<span class="course-dot" style="background:${courseColors[c]};margin-right:3px" title="${c}"></span>`).join('')}${d.cursos.join(', ')}</td>
        <td style="font-family:var(--mono);font-weight:500">${total}</td>
        <td style="font-family:var(--mono)">${d.vagas}</td>
        <td>${pressChip}</td>
      </tr>`;
    });
    tbody.innerHTML = rows;

    // sharing matrix
    const allCursos = ['CC','ES','SI','CDIA','EC'];
    const matEl = document.getElementById('sharingMatrix');
    let mhtml = '<thead><tr><th>Disciplina</th>';
    allCursos.forEach(c => { mhtml += `<th style="text-align:center"><span class="course-dot" style="background:${courseColors[c]}"></span> ${c}</th>`; });
    mhtml += '</tr></thead><tbody>';
    sharedDiscs.forEach(d => {
      mhtml += `<tr><td>${d.name}</td>`;
      allCursos.forEach(c => {
        const idx = d.cursos.indexOf(c);
        if (idx>=0) {
          mhtml += `<td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:22px;background:${courseColors[c]}22;border:1px solid ${courseColors[c]}66;border-radius:4px;font-size:10px;font-weight:500;color:${courseColors[c]}">${d.dem[idx]}</span></td>`;
        } else {
          mhtml += `<td style="text-align:center;color:var(--text3);font-size:11px">—</td>`;
        }
      });
      mhtml += '</tr>';
    });
    mhtml += '</tbody>';
    matEl.innerHTML = mhtml;

    // chart
    const labels = sharedDiscs.map(d=>d.name.split(' ')[0]+'...');
    const datasets = ['CC','ES','SI','CDIA','EC'].map(c => ({
      label: c,
      data: sharedDiscs.map(d => { const i=d.cursos.indexOf(c); return i>=0?d.dem[i]:0; }),
      backgroundColor: courseColors[c]+'cc',
      borderRadius: 3, stack:'s'
    }));
    multiChart = new Chart(document.getElementById('chartMulti'), {
      type:'bar',
      data: { labels, datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'bottom', labels:{ boxWidth:10, boxHeight:10, font:{size:10} } } },
        scales:{
          x:{ stacked:true, ticks:{font:{size:10}}, grid:{color:grid} },
          y:{ stacked:true, ticks:{font:{size:10}}, grid:{color:grid} }
        }
      }
    });
  }

  return { render };
})();
