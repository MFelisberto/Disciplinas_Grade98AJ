// ══════════════════════════════════════════════════════════════
// predict.js — Previsão de demanda page
// ══════════════════════════════════════════════════════════════

const PredictPage = (() => {
  const predDiscs = [
    { name:'Fund. de Programação', base:88 },
    { name:'Cálculo I',            base:92 },
    { name:'Prog. Orient. Obj.',   base:72 },
    { name:'Algoritmos I',         base:70 },
    { name:'Eng. Software I',      base:80 },
    { name:'BD I',                 base:56 },
    { name:'Lógica p/ Computação', base:60 },
    { name:'Prob. e Estatística',  base:66 },
  ];

  let precChart = null;
  let futuroChart = null;
  const grid = 'rgba(0,0,0,0.05)';

  function render(container) {
    precChart = null;
    futuroChart = null;

    container.innerHTML = `
      <div class="tab-panel active" id="panel-predict">
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Parâmetros do modelo preditivo</div>
          <div class="grid-2">
            <div>
              <div class="sl-row">
                <label>Taxa de retenção base</label>
                <input type="range" id="slRet" min="5" max="55" step="1" value="29">
                <span class="sl-val" id="outRet">29%</span>
              </div>
              <div class="sl-row">
                <label>Taxa de evasão</label>
                <input type="range" id="slEva" min="2" max="25" step="1" value="8">
                <span class="sl-val" id="outEva">8%</span>
              </div>
            </div>
            <div>
              <div class="sl-row">
                <label>Capacidade por turma</label>
                <input type="range" id="slCap" min="20" max="60" step="5" value="45">
                <span class="sl-val" id="outCap">45</span>
              </div>
              <div class="sl-row">
                <label>Ingressantes 2026/2</label>
                <input type="range" id="slIngr" min="40" max="130" step="5" value="75">
                <span class="sl-val" id="outIngr">75</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">Demanda estimada — próximo semestre</div>
            <div id="predList"></div>
          </div>
          <div class="card">
            <div class="card-title">Turmas sugeridas pelo modelo</div>
            <div id="predTurmas"></div>
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
              <div class="card-title">Precisão histórica do modelo</div>
              <div style="position:relative;height:110px">
                <canvas id="chartPrec" role="img" aria-label="Precisão histórica do modelo preditivo"></canvas>
              </div>
            </div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-title">Estimativa de demanda — próximos 4 semestres</div>
          <div style="position:relative;height:200px">
            <canvas id="chartFuturo" role="img" aria-label="Estimativa de demanda para os próximos 4 semestres"></canvas>
          </div>
        </div>
      </div>
    `;

    // Bind slider events
    ['slRet','slEva','slCap','slIngr'].forEach(id => {
      document.getElementById(id).addEventListener('input', updatePred);
    });

    updatePred();
    initPrecChart();
    initFuturoChart();
  }

  function updatePred() {
    const ret = parseInt(document.getElementById('slRet').value);
    const eva = parseInt(document.getElementById('slEva').value);
    const cap = parseInt(document.getElementById('slCap').value);
    const ingr = parseInt(document.getElementById('slIngr').value);
    document.getElementById('outRet').textContent  = ret + '%';
    document.getElementById('outEva').textContent  = eva + '%';
    document.getElementById('outCap').textContent  = cap;
    document.getElementById('outIngr').textContent = ingr;
    const mult = (1 + ret/100) * (1 - eva/100) * (ingr/75);
    let listHtml = '', turmasHtml = '';
    predDiscs.forEach(d => {
      const dem = Math.round(d.base * mult);
      const turm = Math.ceil(dem / cap);
      const pct = Math.min(100, Math.round((dem / (cap*2))*100));
      const barC = dem > cap*1.6 ? '#d46868' : dem > cap ? '#d4954a' : '#4db885';
      const demC = dem > cap*1.6 ? 'var(--red)' : dem > cap ? 'var(--amber)' : 'var(--green)';
      listHtml += `<div class="pred-row">
        <div class="pred-name">${d.name}</div>
        <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${pct}%;background:${barC}"></div></div>
        <div class="pred-count" style="color:${demC}">${dem}</div>
      </div>`;
      const warn = dem > cap * turm * 0.92 ? `<span class="chip chip-amber" style="font-size:10px">lotado</span>` : `<span class="chip chip-green" style="font-size:10px">ok</span>`;
      turmasHtml += `<div class="pred-row">
        <div class="pred-name">${d.name}</div>
        <span style="font-size:11px;font-family:var(--mono);color:var(--accent)">${turm}T × ${cap}v</span>
        ${warn}
      </div>`;
    });
    document.getElementById('predList').innerHTML = listHtml;
    document.getElementById('predTurmas').innerHTML = turmasHtml;
    if (futuroChart) {
      futuroChart.data.datasets[0].data = [360, 380, 400, 420].map(v => Math.round(v * mult));
      futuroChart.data.datasets[1].data = [340, 355, 370, 390].map(v => Math.round(v * mult));
      futuroChart.update();
    }
  }

  function initPrecChart() {
    if (precChart) return;
    precChart = new Chart(document.getElementById('chartPrec'), {
      type: 'line',
      data: {
        labels: ['2024/1','2024/2','2025/1','2025/2'],
        datasets: [{ label:'Precisão %', data:[74,79,85,91], borderColor:'#4db885', backgroundColor:'transparent', pointBackgroundColor:'#4db885', pointRadius:4, tension:0.3 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{
          y:{ min:60, max:100, ticks:{ callback:v=>v+'%', font:{size:10} }, grid:{color:grid} },
          x:{ ticks:{font:{size:10}}, grid:{color:grid} }
        }
      }
    });
  }

  function initFuturoChart() {
    if (futuroChart) return;
    futuroChart = new Chart(document.getElementById('chartFuturo'), {
      type: 'bar',
      data: {
        labels: ['2026/2','2027/1','2027/2','2028/1'],
        datasets: [
          { label:'Demanda estimada', data:[360,380,400,420], backgroundColor:'#dde9f5', borderColor:'#5b9bd4', borderWidth:1.5, borderRadius:5 },
          { label:'Vagas planejadas',  data:[340,355,370,390], backgroundColor:'#d6f0e3', borderColor:'#4db885', borderWidth:1.5, borderRadius:5 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, position:'bottom', labels:{ boxWidth:10, boxHeight:10, font:{size:10} } } },
        scales:{
          x:{ ticks:{font:{size:10}}, grid:{color:grid} },
          y:{ ticks:{font:{size:10}}, grid:{color:grid} }
        }
      }
    });
  }

  return { render };
})();
