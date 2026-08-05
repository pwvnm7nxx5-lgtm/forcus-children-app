(function () {
  const namespace = window.__calculationProblemBuilderStorageNamespace || "default";
  const databaseName = `calculation-problem-builder-saved-${namespace}`;
  const databaseVersion = 1;
  const storeName = "worksheets";
  const api = window.__calculationProblemBuilderApi;
  const dialog = document.querySelector("#savedWorksheetsDialog");
  const list = document.querySelector("#savedWorksheetList");
  const search = document.querySelector("#savedWorksheetSearch");
  const nameInput = document.querySelector("#savedWorksheetName");
  const message = document.querySelector("#savedWorksheetMessage");
  let databasePromise = null;
  let records = [];

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb-request-failed"));
    });
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!window.indexedDB) {
      databasePromise = Promise.reject(new Error("indexeddb-unavailable"));
      return databasePromise;
    }
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb-open-failed"));
    });
    return databasePromise;
  }

  async function getAllRecords() {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    return requestResult(transaction.objectStore(storeName).getAll());
  }

  async function putRecord(record) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).put(record));
  }

  async function deleteRecord(id) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).delete(id));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function setMessage(text, tone = "") {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function currentSaveName() {
    const value = nameInput?.value.trim();
    if (value) return value.slice(0, 80);
    const title = api?.getLibraryState?.().settings?.title?.trim();
    return (title || "計算問題作成").slice(0, 80);
  }

  function makeRecord(kind) {
    if (!api?.getLibraryState) throw new Error("builder-api-unavailable");
    const current = api.getLibraryState();
    const state = {
      settings: {
        ...current.settings,
        name: "",
        date: "",
      },
      problems: kind === "worksheet" ? clone(current.problems) : null,
      printAdjustments: clone(window.__printAdjustmentsGetSettings?.() || {}),
    };
    const now = new Date().toISOString();
    return {
      id: makeId(),
      name: currentSaveName(),
      kind,
      title: state.settings.title || "計算問題作成",
      createdAt: now,
      updatedAt: now,
      state,
    };
  }

  function normalizeImportedRecord(raw) {
    if (!raw || typeof raw !== "object" || !raw.state?.settings) return null;
    const state = clone(raw.state);
    if (!state || typeof state.settings !== "object") return null;
    state.settings.name = "";
    state.settings.date = "";
    if (!Array.isArray(state.problems)) state.problems = null;
    return {
      id: makeId(),
      name: String(raw.name || state.settings.title || "計算問題作成").trim().slice(0, 80) || "計算問題作成",
      kind: raw.kind === "settings" ? "settings" : "worksheet",
      title: String(raw.title || state.settings.title || "計算問題作成").slice(0, 120),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state,
    };
  }

  function visibleRecords() {
    const query = search?.value.trim().toLocaleLowerCase("ja-JP") || "";
    return records.filter((record) => !query || `${record.name} ${record.title}`.toLocaleLowerCase("ja-JP").includes(query));
  }

  function makeActionButton(label, action, id, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = danger ? "saved-worksheet-action danger" : "saved-worksheet-action";
    button.dataset.action = action;
    button.dataset.id = id;
    button.textContent = label;
    return button;
  }

  function renderRecords() {
    if (!list) return;
    list.replaceChildren();
    const filtered = visibleRecords();
    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "saved-worksheet-empty";
      empty.textContent = search?.value ? "検索に一致する保存データがありません。" : "保存したプリントはまだありません。";
      list.append(empty);
      return;
    }
    filtered.forEach((record) => {
      const item = document.createElement("li");
      item.className = "saved-worksheet-item";
      const details = document.createElement("div");
      details.className = "saved-worksheet-details";
      const title = document.createElement("strong");
      title.textContent = record.name;
      const meta = document.createElement("span");
      meta.textContent = `${record.kind === "settings" ? "設定" : "問題ごと"} ・ ${record.title} ・ ${formatDate(record.updatedAt)}`;
      details.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "saved-worksheet-item-actions";
      actions.append(
        makeActionButton("呼び出す", "open", record.id),
        makeActionButton("名前変更", "rename", record.id),
        makeActionButton("複製", "duplicate", record.id),
        makeActionButton("削除", "delete", record.id, true),
      );
      item.append(details, actions);
      list.append(item);
    });
  }

  async function refreshRecords() {
    records = (await getAllRecords())
      .filter((record) => record?.state?.settings)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    renderRecords();
  }

  async function saveCurrent(kind) {
    try {
      const record = makeRecord(kind);
      await putRecord(record);
      await refreshRecords();
      setMessage(`「${record.name}」を保存しました。`, "success");
      if (nameInput) nameInput.value = "";
    } catch (error) {
      setMessage(error.message === "indexeddb-unavailable"
        ? "このブラウザでは保存機能を使えません。JSONバックアップをご利用ください。"
        : "保存できませんでした。ブラウザの保存領域を確認してください。", "error");
    }
  }

  async function openRecord(record) {
    if (!api?.applyLibraryState) return;
    api.applyLibraryState(clone(record.state));
    dialog?.close();
    setMessage(`「${record.name}」を呼び出しました。`, "success");
  }

  async function renameRecord(record) {
    const nextName = window.prompt("保存名を入力してください。", record.name);
    if (nextName === null) return;
    const name = nextName.trim().slice(0, 80);
    if (!name) return;
    record.name = name;
    record.updatedAt = new Date().toISOString();
    await putRecord(record);
    await refreshRecords();
    setMessage("保存名を変更しました。", "success");
  }

  async function duplicateRecord(record) {
    const copy = clone(record);
    copy.id = makeId();
    copy.name = `${record.name}（複製）`.slice(0, 80);
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    await putRecord(copy);
    await refreshRecords();
    setMessage("保存データを複製しました。", "success");
  }

  async function removeRecord(record) {
    if (!window.confirm(`「${record.name}」を削除しますか？`)) return;
    await deleteRecord(record.id);
    await refreshRecords();
    setMessage("削除しました。", "success");
  }

  async function handleListAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const record = records.find((item) => item.id === button.dataset.id);
    if (!record) return;
    try {
      if (button.dataset.action === "open") await openRecord(record);
      if (button.dataset.action === "rename") await renameRecord(record);
      if (button.dataset.action === "duplicate") await duplicateRecord(record);
      if (button.dataset.action === "delete") await removeRecord(record);
    } catch {
      setMessage("保存データを操作できませんでした。", "error");
    }
  }

  async function exportRecords() {
    try {
      const items = await getAllRecords();
      const payload = {
        format: "calculation-problem-builder-saved-worksheets",
        version: 1,
        exportedAt: new Date().toISOString(),
        items,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `計算問題作成_保存データ_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage("JSONバックアップを書き出しました。", "success");
    } catch {
      setMessage("JSONバックアップを書き出せませんでした。", "error");
    }
  }

  async function importRecords(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== "calculation-problem-builder-saved-worksheets" || !Array.isArray(payload.items)) {
        throw new Error("invalid-format");
      }
      const imported = payload.items.map(normalizeImportedRecord).filter(Boolean);
      for (const record of imported) await putRecord(record);
      await refreshRecords();
      setMessage(`${imported.length}件の保存データを読み込みました。`, "success");
    } catch {
      setMessage("読み込める保存データではありません。", "error");
    }
  }

  async function openDialog() {
    if (!dialog) return;
    if (nameInput && !nameInput.value) nameInput.value = api?.getLibraryState?.().settings?.title || "計算問題作成";
    setMessage("");
    try {
      await refreshRecords();
    } catch {
      setMessage("保存一覧を開けませんでした。JSONバックアップをご利用ください。", "error");
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function setup() {
    if (!dialog || !api) return;
    document.querySelector("#savedWorksheetsBtn")?.addEventListener("click", openDialog);
    document.querySelector("#savedWorksheetsClose")?.addEventListener("click", () => dialog.close());
    document.querySelector("#saveSettingsBtn")?.addEventListener("click", () => saveCurrent("settings"));
    document.querySelector("#saveWorksheetBtn")?.addEventListener("click", () => saveCurrent("worksheet"));
    document.querySelector("#exportSavedWorksheetsBtn")?.addEventListener("click", exportRecords);
    document.querySelector("#importSavedWorksheetsInput")?.addEventListener("change", (event) => {
      importRecords(event.target.files?.[0]);
      event.target.value = "";
    });
    search?.addEventListener("input", renderRecords);
    list?.addEventListener("click", handleListAction);
    window.addEventListener("beforeprint", () => dialog.close());
  }

  setup();
})();
