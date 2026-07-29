(() => {
  const releaseMeta = document.querySelector('meta[name="app-release"]');
  if (!releaseMeta || location.protocol === "file:") return;

  const pageUrl = new URL(location.href);
  const releaseUrl = new URL("release.json", pageUrl);
  releaseUrl.searchParams.set("t", String(Date.now()));

  fetch(releaseUrl, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((release) => {
      const latestVersion = String(release?.version || "");
      if (!latestVersion) return;

      if (latestVersion !== releaseMeta.content) {
        if (pageUrl.searchParams.get("_release") === latestVersion) return;
        pageUrl.searchParams.set("_release", latestVersion);
        location.replace(pageUrl.toString());
        return;
      }

      if (pageUrl.searchParams.has("_release")) {
        pageUrl.searchParams.delete("_release");
        history.replaceState(null, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
      }
    })
    .catch(() => {
      // Offline and file-based use keep the currently available version.
    });
})();
