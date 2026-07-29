window.LauncherCardUi = (() => {
  function makeAppCard({ app, gradeLabel, favoriteButton, bookmarkButton }) {
    const article = document.createElement("article");
    article.className = "app-card";
    article.classList.toggle("recommended", app.recommended === true);
    article.style.setProperty("--accent", app.accent || "#2f6f8f");

    const mark = document.createElement("div");
    mark.className = "app-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = app.title.slice(0, 1);

    const body = document.createElement("div");
    body.className = "app-card-body";

    const meta = document.createElement("div");
    meta.className = "meta-row";

    if (app.recommended) {
      const recommended = document.createElement("span");
      recommended.className = "recommended-badge";
      recommended.textContent = "おすすめ";
      meta.append(recommended);
    }

    const grade = document.createElement("span");
    grade.className = "grade";
    grade.textContent = gradeLabel;
    meta.append(grade);

    const category = document.createElement("span");
    category.className = "category";
    category.textContent = app.category || "その他";
    meta.append(category);

    const status = document.createElement("span");
    status.className = app.status === "ready" ? "ready" : "ready dev-status";
    status.textContent = app.status === "ready" ? "利用可" : app.status || "";
    if (status.textContent) {
      meta.append(status);
    }

    const title = document.createElement("h2");
    title.textContent = app.title;

    const description = document.createElement("p");
    description.textContent = app.description;

    const tags = document.createElement("div");
    tags.className = "tag-row";
    (app.tags || []).forEach((tag) => {
      const span = document.createElement("span");
      span.textContent = tag;
      tags.append(span);
    });

    const link = document.createElement("a");
    link.className = "launch-link";
    link.href = app.href;
    link.textContent = app.actionLabel || "開く";

    body.append(meta, title, description, tags, link);
    const cardActions = document.createElement("div");
    cardActions.className = "card-actions";
    cardActions.append(favoriteButton, bookmarkButton);

    article.append(cardActions, mark, body);
    return article;
  }

  return {
    makeAppCard,
  };
})();
