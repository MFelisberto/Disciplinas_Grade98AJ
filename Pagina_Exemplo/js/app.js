// ══════════════════════════════════════════════════════════════
// app.js — SPA Router & Navigation
// ══════════════════════════════════════════════════════════════

const App = (() => {
  const pages = {
    overview: { module: OverviewPage, title: 'Visão geral',           icon: 'ti-layout-dashboard' },
    matriz:   { module: MatrizPage,   title: 'Matriz Curricular',     icon: 'ti-table' },
    flow:     { module: FlowPage,     title: 'Fluxo curricular',      icon: 'ti-git-branch' },
    heatmap:  { module: HeatmapPage,  title: 'Heatmap de desempenho', icon: 'ti-layout-grid' },
    predict:  { module: PredictPage,  title: 'Previsão de demanda',   icon: 'ti-chart-line' },
    multi:    { module: MultiPage,    title: 'Análise multidomínio',  icon: 'ti-circles-relation' },
  };

  let currentPage = null;

  function init() {
    // Chart.js defaults
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#6b6860';

    // Bind nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.dataset.page);
      });
    });

    // Navigate to initial page
    navigate('overview');
  }

  function navigate(pageId) {
    if (currentPage === pageId) return;

    const page = pages[pageId];
    if (!page) return;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    // Update topbar
    document.getElementById('topbarTitle').textContent = page.title;

    // Destroy old Chart.js instances in the container
    const container = document.getElementById('pageContainer');
    destroyCharts(container);

    // Render new page
    currentPage = pageId;
    page.module.render(container);
  }

  function destroyCharts(container) {
    // Find all canvas elements and destroy their Chart instances
    const canvases = container.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const chart = Chart.getChart(canvas);
      if (chart) chart.destroy();
    });
  }

  return { init, navigate };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
