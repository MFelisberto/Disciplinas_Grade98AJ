// ══════════════════════════════════════════════════════════════
// overview.js — Visão geral page
// ══════════════════════════════════════════════════════════════

const OverviewPage = (() => {

  function render(container) {

    container.innerHTML = `
      <div class="tab-panel active" id="panel-overview">
        <div class="grid-4">
          <div class="kpi-card" style="animation-delay:0s">
            <div class="kpi-label"><i class="ti ti-user-check" style="font-size:14px;color:var(--green)"></i> Taxa de aprovação</div>
            <div class="kpi-val" style="color:var(--green)">71%</div>
            <div class="kpi-delta delta-up">↑ 4 p.p. vs 2025/2</div>
          </div>
          <div class="kpi-card" style="animation-delay:0.06s">
            <div class="kpi-label"><i class="ti ti-user-x" style="font-size:14px;color:var(--amber)"></i> Evasão semestral</div>
            <div class="kpi-val" style="color:var(--amber)">8,3%</div>
            <div class="kpi-delta delta-up">↓ 1,1 p.p. vs 2025/2</div>
          </div>
          <div class="kpi-card" style="animation-delay:0.12s">
            <div class="kpi-label"><i class="ti ti-clock" style="font-size:14px;color:var(--red)"></i> Fora do fluxo ideal</div>
            <div class="kpi-val" style="color:var(--red)">38%</div>
            <div class="kpi-delta delta-neu">186 alunos em atraso</div>
          </div>
          <div class="kpi-card" style="animation-delay:0.18s">
            <div class="kpi-label"><i class="ti ti-school" style="font-size:14px;color:var(--accent)"></i> Turmas ofertadas</div>
            <div class="kpi-val">64</div>
            <div class="kpi-delta delta-neu">12 compartilhadas</div>
          </div>
        </div>

        <div class="grid-2 mt">
          <div class="card">
            <div class="card-title">Ocupação por nível — 2026/1</div>
            <div style="position:relative;height:200px">
              <canvas id="chartOcup" role="img" aria-label="Ocupação por nível de I a VIII"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Situação acadêmica por nível</div>
            <div style="position:relative;height:200px">
              <canvas id="chartSit" role="img" aria-label="Situação dos alunos por nível"></canvas>
            </div>
          </div>
        </div>

        <div class="grid-2 mt">
          <div class="card">
            <div class="card-title">Gargalos críticos detectados</div>
            <div class="alert alert-red">
              <i class="ti ti-alert-circle"></i>
              <div>
                <div class="alert-title">Cálculo I (95300-04) — 94% ocupação</div>
                <div class="alert-sub">Demanda reprimida estimada: +42 alunos. Impacto em cascata: Cálculo II e Probabilidade ficam subutilizados.</div>
              </div>
              <span class="chip chip-red" style="flex-shrink:0;font-size:10px">crítico</span>
            </div>
            <div class="alert alert-amber">
              <i class="ti ti-alert-triangle"></i>
              <div>
                <div class="alert-title">Fund. de Programação (4611C-06) — 89% ocupação</div>
                <div class="alert-sub">28 alunos bloqueados em POO por reprovação aqui. Gargalo no eixo de Algoritmos.</div>
              </div>
              <span class="chip chip-amber" style="flex-shrink:0;font-size:10px">atenção</span>
            </div>
            <div class="alert alert-amber">
              <i class="ti ti-alert-triangle"></i>
              <div>
                <div class="alert-title">Eng. Software I (98801-04) — multidomínio</div>
                <div class="alert-sub">67 alunos de CC+ES+SI disputando 45 vagas. Conflito de grade horária entre cursos.</div>
              </div>
              <span class="chip chip-amber" style="flex-shrink:0;font-size:10px">atenção</span>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Evolução histórica — aprovação vs evasão</div>
            <div style="position:relative;height:200px">
              <canvas id="chartHist" role="img" aria-label="Histórico de aprovação e evasão por semestre"></canvas>
            </div>
          </div>
        </div>

        <div class="card mt">
          <div class="card-title">Disciplinas com maior impacto no fluxo discente</div>
          <table class="tbl">
            <thead>
              <tr>
                <th>Disciplina</th><th>Código</th><th>Nível</th><th>Eixo</th><th>% Reprovação</th><th>Alunos bloqueados</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cálculo I</td>
                <td><span class="mono-code">95300-04</span></td><td>I</td><td>Cálculo/Mat.</td>
                <td><span style="color:var(--red);font-weight:500">38%</span></td><td>42</td>
                <td><span class="chip chip-red" style="font-size:10px">crítico</span></td>
              </tr>
              <tr>
                <td>Fund. de Programação</td>
                <td><span class="mono-code">4611C-06</span></td><td>I</td><td>Algoritmos</td>
                <td><span style="color:var(--red);font-weight:500">32%</span></td><td>28</td>
                <td><span class="chip chip-red" style="font-size:10px">crítico</span></td>
              </tr>
              <tr>
                <td>Eng. Software I</td>
                <td><span class="mono-code">98801-04</span></td><td>IV</td><td>Construção de Sist.</td>
                <td><span style="color:var(--amber);font-weight:500">25%</span></td><td>19</td>
                <td><span class="chip chip-amber" style="font-size:10px">atenção</span></td>
              </tr>
              <tr>
                <td>Algoritmos e Est. I</td>
                <td><span class="mono-code">4645G-04</span></td><td>II</td><td>Algoritmos</td>
                <td><span style="color:var(--amber);font-weight:500">22%</span></td><td>14</td>
                <td><span class="chip chip-amber" style="font-size:10px">atenção</span></td>
              </tr>
              <tr>
                <td>Probabilidade e Est.</td>
                <td><span class="mono-code">95304-04</span></td><td>III</td><td>Cálculo/Mat.</td>
                <td><span style="color:var(--text2)">18%</span></td><td>9</td>
                <td><span class="chip chip-green" style="font-size:10px">monitorar</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    initCharts();
  }

  function initCharts() {
    const grid = 'rgba(0,0,0,0.05)';

    new Chart(document.getElementById('chartOcup'), {
      type: 'bar',
      data: {
        labels: ['Nível I','II','III','IV','V','VI','VII','VIII'],
        datasets: [{
          label: 'Ocupação %',
          data: [94, 88, 76, 67, 58, 49, 40, 30],
          backgroundColor: ['#d46868','#d46868','#5b9bd4','#5b9bd4','#5b9bd4','#4db885','#4db885','#4db885'],
          borderRadius: 5, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font:{size:10} }, grid: { color: grid } },
          y: { max: 100, ticks: { callback: v => v+'%', font:{size:10} }, grid: { color: grid } }
        }
      }
    });

    new Chart(document.getElementById('chartSit'), {
      type: 'bar',
      data: {
        labels: ['I','II','III','IV','V','VI'],
        datasets: [
          { label: 'Aprovado', data: [62,71,68,75,80,82], backgroundColor: '#4db885', stack: 's', borderRadius: 2 },
          { label: 'Reprovado', data: [28,18,22,15,12,10], backgroundColor: '#d46868', stack: 's' },
          { label: 'Cancelado', data: [10,11,10,10,8,8],  backgroundColor: '#d4954a', stack: 's', borderRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font:{size:10} } } },
        scales: {
          x: { stacked: true, ticks:{font:{size:10}}, grid:{color:grid} },
          y: { stacked: true, ticks:{font:{size:10}}, grid:{color:grid} }
        }
      }
    });

    new Chart(document.getElementById('chartHist'), {
      type: 'line',
      data: {
        labels: ['2024/1','2024/2','2025/1','2025/2','2026/1'],
        datasets: [
          { label: 'Aprovação %', data: [63,65,67,67,71], borderColor: '#4db885', backgroundColor: 'transparent', pointBackgroundColor:'#4db885', pointRadius:4, tension:0.3 },
          { label: 'Evasão %',    data: [11,10.5,9.8,9.4,8.3], borderColor: '#d46868', backgroundColor: 'transparent', pointBackgroundColor:'#d46868', pointRadius:4, tension:0.3, borderDash:[5,3] }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:true, position:'bottom', labels:{ boxWidth:10, boxHeight:10, font:{size:10} } } },
        scales: {
          x: { ticks:{font:{size:10}}, grid:{color:grid} },
          y: { ticks:{font:{size:10}, callback: v=>v+'%'}, grid:{color:grid} }
        }
      }
    });
  }

  return { render };
})();

