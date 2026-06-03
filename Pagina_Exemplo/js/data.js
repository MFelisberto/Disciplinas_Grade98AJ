// ══════════════════════════════════════════════════════════════
// data.js — Fetch, cache and expose 98AJ.json curriculum data
// ══════════════════════════════════════════════════════════════

const DataStore = (() => {
  let _cache = null;
  let _promise = null;

  /**
   * Fetch the curriculum JSON once and cache it.
   * Returns the full parsed object:
   *   { curriculum, display, categories, courses, requirements }
   */
  async function load() {
    if (_cache) return _cache;
    if (_promise) return _promise;

    _promise = fetch('../98AJ.json')
      .then(res => {
        if (!res.ok) throw new Error(`Falha ao carregar 98AJ.json: ${res.status}`);
        return res.json();
      })
      .then(data => {
        _cache = data;
        _promise = null;
        return data;
      });

    return _promise;
  }

  /** Get the cached data synchronously (null if not loaded yet). */
  function get() {
    return _cache;
  }

  /** Build a map of code -> course object for quick lookups */
  function courseMap(courses) {
    const map = {};
    courses.forEach(c => { map[c.code] = c; });
    return map;
  }

  /** Build a map of code -> category object */
  function categoryMap(categories) {
    const map = {};
    categories.forEach(cat => { map[cat.id] = cat; });
    return map;
  }

  /**
   * For a given course code, return an array of prerequisite course objects.
   */
  function getPrerequisites(courseCode, data) {
    const cMap = courseMap(data.courses);
    return data.requirements
      .filter(r => r.type === 'prerequisite' && r.to === courseCode)
      .map(r => cMap[r.from])
      .filter(Boolean);
  }

  /**
   * For a given course code, return an array of dependent course objects
   * (courses that require this one).
   */
  function getDependents(courseCode, data) {
    const cMap = courseMap(data.courses);
    return data.requirements
      .filter(r => r.type === 'prerequisite' && r.from === courseCode)
      .map(r => cMap[r.to])
      .filter(Boolean);
  }

  /** Group courses by level, returns { 1: [...], 2: [...], ... } */
  function groupByLevel(courses) {
    const groups = {};
    courses.forEach(c => {
      if (!groups[c.level]) groups[c.level] = [];
      groups[c.level].push(c);
    });
    return groups;
  }

  return { load, get, courseMap, categoryMap, getPrerequisites, getDependents, groupByLevel };
})();
