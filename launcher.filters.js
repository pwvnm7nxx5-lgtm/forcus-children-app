window.LauncherFilters = (() => {
  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getAppGrades(app) {
    if (Array.isArray(app.grades) && app.grades.length) {
      return app.grades.map(String);
    }
    const text = [app.title, ...(Array.isArray(app.tags) ? app.tags : [])].join(" ");
    if (text.includes("1年")) return ["1"];
    if (text.includes("2年")) return ["2"];
    if (text.includes("3年")) return ["3"];
    return ["all"];
  }

  function getGradeLabel(app) {
    const grades = getAppGrades(app);
    if (grades.includes("all")) return "全学年";
    return grades.map((grade) => `${grade}年`).join("・");
  }

  function getCategories(apps) {
    return ["all", ...new Set(apps.filter((app) => !app.hidden).map((app) => app.category).filter(Boolean))];
  }

  function matchesGrade(app, selectedGrade) {
    if (selectedGrade === "all") {
      return true;
    }
    const grades = getAppGrades(app);
    return grades.includes(selectedGrade);
  }

  function matchesApp(app, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return true;
    }

    const searchable = [
      app.title,
      app.description,
      app.category,
      getGradeLabel(app),
      ...(Array.isArray(app.tags) ? app.tags : []),
    ].join(" ");

    return normalizeText(searchable).includes(normalizedQuery);
  }

  function getVisibleApps({
    apps,
    query,
    selectedGrade,
    selectedCategory,
    showFavoritesOnly,
    showBookmarksOnly,
    favorites,
    selectedFolder,
  }) {
    return apps.filter((app) => {
      if (app.hidden) {
        return false;
      }
      const categoryMatches = selectedCategory === "all" || app.category === selectedCategory;
      const favoriteMatches = !showFavoritesOnly || favorites.has(app.id);
      const bookmarkMatches = !showBookmarksOnly || (selectedFolder ? selectedFolder.appIds.includes(app.id) : false);
      return matchesGrade(app, selectedGrade) && categoryMatches && favoriteMatches && bookmarkMatches && matchesApp(app, query);
    });
  }

  return {
    getAppGrades,
    getGradeLabel,
    getCategories,
    getVisibleApps,
    matchesApp,
    matchesGrade,
    normalizeText,
  };
})();
