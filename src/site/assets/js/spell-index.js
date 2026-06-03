(function () {
  const root = document.getElementById("spell-index-root");
  if (!root) return;

  const lang = window.location.pathname.startsWith("/hu/") ? "hu" : "en";
  const jsonUrl = `/assets/spells.${lang}.json`;

  const labels = {
    en: {
      searchPlaceholder: "Search spells...",
      allLevels: "All levels",
      allSchools: "All schools",
      allClasses: "All classes",
      allSources: "All sources",
      name: "Name",
      level: "Level",
      school: "School",
      classes: "Classes",
      source: "Source",
      cantrip: "Cantrip",
      results: "spells shown",
      noResults: "No spells match the selected filters.",
    },
    hu: {
      searchPlaceholder: "Varázslatok keresése...",
      allLevels: "Minden szint",
      allSchools: "Minden iskola",
      allClasses: "Minden class",
      allSources: "Minden forrás",
      name: "Név",
      level: "Szint",
      school: "Mágiaiskola",
      classes: "Classok",
      source: "Forrás",
      cantrip: "Cantrip",
      results: "varázslat megjelenítve",
      noResults: "Nincs a szűrőknek megfelelő varázslat.",
    },
  };

  const t = labels[lang];

  const searchInput = document.getElementById("spell-search");
  const levelFilter = document.getElementById("spell-level-filter");
  const schoolFilter = document.getElementById("spell-school-filter");
  const classFilter = document.getElementById("spell-class-filter");
  const sourceFilter = document.getElementById("spell-source-filter");
  const tableBody = document.getElementById("spell-table-body");
  const resultCount = document.getElementById("spell-result-count");

  const tableHeaders = root.querySelectorAll("thead th");
  if (tableHeaders.length >= 5) {
    tableHeaders[0].textContent = t.name;
    tableHeaders[1].textContent = t.level;
    tableHeaders[2].textContent = t.school;
    tableHeaders[3].textContent = t.classes;
    tableHeaders[4].textContent = t.source;
  }

  searchInput.placeholder = t.searchPlaceholder;

  setFirstOption(levelFilter, t.allLevels);
  setFirstOption(schoolFilter, t.allSchools);
  setFirstOption(classFilter, t.allClasses);
  setFirstOption(sourceFilter, t.allSources);

  let allSpells = [];

  fetch(jsonUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load spell index: ${jsonUrl}`);
      }

      return response.json();
    })
    .then((spells) => {
      allSpells = Array.isArray(spells) ? spells : [];

      populateFilters(allSpells);
      renderTable(allSpells);
      bindEvents();
    })
    .catch((error) => {
      console.error(error);
      resultCount.textContent = "Could not load spell index.";
    });

  function setFirstOption(select, text) {
    if (select && select.options.length > 0) {
      select.options[0].textContent = text;
    }
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), lang)
    );
  }

  function populateSelect(select, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function populateFilters(spells) {
    const levels = [...new Set(spells.map((spell) => Number(spell.level)))]
      .filter((level) => !Number.isNaN(level))
      .sort((a, b) => a - b);

    populateSelect(
      levelFilter,
      levels.map((level) => String(level))
    );

    populateSelect(
      schoolFilter,
      uniqueSorted(spells.map((spell) => spell.school))
    );

    populateSelect(
      classFilter,
      uniqueSorted(spells.flatMap((spell) => spell.classes || []))
    );

    populateSelect(
      sourceFilter,
      uniqueSorted(spells.map((spell) => spell.source))
    );
  }

  function bindEvents() {
    [searchInput, levelFilter, schoolFilter, classFilter, sourceFilter].forEach(
      (element) => {
        element.addEventListener("input", applyFilters);
        element.addEventListener("change", applyFilters);
      }
    );
  }

  function applyFilters() {
    const query = normalize(searchInput.value);
    const level = levelFilter.value;
    const school = schoolFilter.value;
    const spellClass = classFilter.value;
    const source = sourceFilter.value;

    const filtered = allSpells.filter((spell) => {
      const searchable = normalize(
        [
          spell.name,
          spell.school,
          spell.source,
          ...(spell.classes || []),
        ].join(" ")
      );

      const matchesQuery = !query || searchable.includes(query);
      const matchesLevel = !level || String(spell.level) === level;
      const matchesSchool = !school || spell.school === school;
      const matchesClass =
        !spellClass || (spell.classes || []).includes(spellClass);
      const matchesSource = !source || spell.source === source;

      return (
        matchesQuery &&
        matchesLevel &&
        matchesSchool &&
        matchesClass &&
        matchesSource
      );
    });

    renderTable(filtered);
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function formatLevel(level) {
    return Number(level) === 0 ? t.cantrip : String(level);
  }

  function renderTable(spells) {
    tableBody.innerHTML = "";

    resultCount.textContent = `${spells.length} ${t.results}`;

    if (spells.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = t.noResults;
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();

    spells.forEach((spell) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      const link = document.createElement("a");
      link.href = spell.url;
      link.textContent = spell.name;
      link.className = "internal-link";
      nameCell.appendChild(link);

      const levelCell = document.createElement("td");
      levelCell.textContent = formatLevel(spell.level);

      const schoolCell = document.createElement("td");
      schoolCell.textContent = spell.school;

      const classesCell = document.createElement("td");
      classesCell.textContent = (spell.classes || []).join(", ");

      const sourceCell = document.createElement("td");
      sourceCell.textContent = spell.source;

      row.appendChild(nameCell);
      row.appendChild(levelCell);
      row.appendChild(schoolCell);
      row.appendChild(classesCell);
      row.appendChild(sourceCell);

      fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
  }
})();