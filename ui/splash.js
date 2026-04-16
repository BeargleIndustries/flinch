(() => {
  const stageEl = document.getElementById("stage");
  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const progressEl = document.getElementById("progress");
  const barEl = document.getElementById("progress-bar");
  const errorEl = document.getElementById("error");
  const errorMsgEl = document.getElementById("error-message");
  const errorTitleEl = document.getElementById("error-title");
  const diagEl = document.getElementById("diag");

  function diag(msg, userVisible) {
    if (userVisible && diagEl) diagEl.textContent = msg;
    try { console.log("[flinch-splash]", msg); } catch (_) {}
  }

  function formatError(err) {
    if (err == null) return "null";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || err.toString();
    if (typeof err === "object") {
      try {
        const asJson = JSON.stringify(err);
        if (asJson && asJson !== "{}") return asJson;
      } catch (_) {}
      if (err.message) return String(err.message);
      if (err.error) return String(err.error);
    }
    try { return String(err); } catch (_) { return "unknown error"; }
  }

  const STAGE_LABELS = {
    probing: "Checking environment",
    cleaning: "Cleaning previous runtime",
    extracting_pbs: "Extracting Python runtime",
    extractingpbs: "Extracting Python runtime",
    creating_venv: "Creating virtual environment",
    createvenv: "Creating virtual environment",
    creatingvenv: "Creating virtual environment",
    installing_deps: "Installing Flinch",
    installingdeps: "Installing Flinch",
    installingextras: "Installing Flinch",
    ready: "Ready",
  };

  const STAGE_ORDER = [
    "probing",
    "cleaning",
    "extractingpbs",
    "creatingvenv",
    "installingdeps",
    "ready",
  ];

  const normalize = (s) => String(s ?? "").toLowerCase().replace(/[-_\s]+/g, "");

  function setStage(stage, detail) {
    const key = normalize(stage);
    const label = STAGE_LABELS[key] || stage || "working…";
    stageEl.textContent = detail ? `${label} — ${detail}` : label;
    const idx = STAGE_ORDER.indexOf(key);
    if (idx >= 0) {
      progressEl.classList.remove("indeterminate");
      const pct = Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
      barEl.style.width = `${pct}%`;
    }
  }

  function showError(message) {
    errorMsgEl.textContent = message || "An unexpected error occurred during setup.";
    errorEl.classList.add("visible");
    progressEl.classList.remove("indeterminate");
    subtitleEl.textContent = "Setup didn't finish. See the details below.";
  }

  let _navInProgress = false;

  async function resolveSidecarUrl() {
    try {
      const url = await window.__TAURI__.core.invoke("sidecar_url");
      return typeof url === "string" && url.length > 0 ? url.replace(/\/$/, "") : null;
    } catch (_) {
      return null;
    }
  }

  async function navigateToSidecar() {
    if (_navInProgress) return;
    _navInProgress = true;
    diag("Starting Flinch…", true);
    diag("resolving sidecar URL…");

    const deadline = Date.now() + 60000;
    let attempt = 0;
    let lastUrl = "";
    while (Date.now() < deadline) {
      attempt += 1;
      // Re-resolve every iteration — the sidecar may restart mid-bootstrap
      // when pip reinstalls the flinch package, which picks a new port.
      const url = await resolveSidecarUrl();
      if (!url) {
        diag(`sidecar URL not available yet (probe ${attempt}) — retrying…`);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (url !== lastUrl) {
        diag(`sidecar URL ${url} — probing /health…`);
        lastUrl = url;
      }
      try {
        const res = await fetch(url + "/health", { cache: "no-store" });
        if (res.ok) {
          diag(`sidecar healthy on ${url} (probe ${attempt}) — navigating`, true);
          window.location.replace(url);
          return;
        }
      } catch (_) {
        // not yet — keep polling
      }
      diag(`sidecar ${url} not ready yet (probe ${attempt}) — retrying…`);
      await new Promise((r) => setTimeout(r, 500));
    }
    _navInProgress = false;
    showError("Sidecar did not become healthy within 60 seconds.");
  }

  function wireEvents() {
    const { listen } = window.__TAURI__.event;
    diag("subscribed to bootstrap events — waiting for first progress signal");

    listen("bootstrap:progress", (event) => {
      const payload = event.payload ?? {};
      setStage(payload.stage, payload.detail || payload.message);
      diag(`bootstrap:progress ${payload.stage}${payload.detail ? " — " + payload.detail : ""}`);
      if (normalize(payload.stage) === "ready") {
        navigateToSidecar();
      }
    });

    listen("bootstrap:ready", () => {
      setStage("ready");
      diag("bootstrap:ready event received");
      navigateToSidecar();
    });

    listen("bootstrap:error", (event) => {
      const payload = event.payload ?? {};
      const kind = payload.kind || payload.type || "";
      if (kind.toLowerCase().includes("antivirus")) {
        errorTitleEl.textContent = "Blocked by anti-virus";
      }
      showError(payload.message || payload.error || "Unknown bootstrap error.");
    });

    listen("sidecar:ready", () => {
      diag("sidecar:ready event received");
      navigateToSidecar();
    });
  }

  function startBootstrap() {
    setStage("probing");
    diag("invoking bootstrap_runtime_command…");
    window.__TAURI__.core
      .invoke("bootstrap_runtime_command")
      .then(() => {
        diag("bootstrap_runtime_command returned (awaiting further events)");
      })
      .catch((err) => {
        const detail = formatError(err);
        showError(`Bootstrap failed to start: ${detail}`);
        diag(`bootstrap_runtime_command error: ${detail}`);
      });
  }

  function bail(msg) {
    setStage("starting…");
    showError(msg);
  }

  const apiAvailable = !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.event);
  diag(`Tauri API available: ${apiAvailable}`);
  if (apiAvailable) diag("Starting Flinch…", true);
  if (apiAvailable) {
    wireEvents();
    diag("invoking runtime_status…");
    window.__TAURI__.core
      .invoke("runtime_status")
      .then((status) => {
        diag(`runtime_status: ${JSON.stringify(status)}`);
        if (status && status.ready) {
          setStage("ready");
          navigateToSidecar();
        } else {
          startBootstrap();
        }
      })
      .catch((err) => {
        diag(`runtime_status error: ${formatError(err)} — attempting bootstrap anyway`);
        startBootstrap();
      });
  } else {
    bail("Tauri runtime is not available. Please relaunch Flinch.");
  }
})();
