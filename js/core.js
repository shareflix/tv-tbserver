const MOVIES_URL = (window.TVTB_CONFIG && window.TVTB_CONFIG.MOVIES_URL) || "/api/movies.json";
const SERIES_URL = (window.TVTB_CONFIG && window.TVTB_CONFIG.SERIES_URL) || "/api/series.json";
const M3U_URL = (window.TVTB_CONFIG && window.TVTB_CONFIG.M3U_URL) || "live.m3u";

const RADIO_STATIONS = [
  {
    name: "Radio TV.TBSERVER",
    subtitle: "MY.RADIO",
    url: "https://tb.shareflix.co.uk/listen/myradio/radio.mp3",
    description: "Postul radio oficial TV.TBSERVER."
  }
];

const player = document.getElementById("player");
const playerWrap = document.getElementById("playerWrap");
const content = document.getElementById("content");
const sectionTitle = document.getElementById("sectionTitle");
const heroTitle = document.getElementById("heroTitle");
const heroText = document.getElementById("heroText");
const hero = document.querySelector(".hero");
const searchInput = document.querySelector(".search-box input");
const heroPlayBtn = document.querySelector(".hero-play");
const heroInfoBtn = document.querySelector(".hero-info");




/* =========================================================
   TV.TBSERVER HARD FIX: ține overlay-ul ÎN interiorul video-ului.
   Repară cazul în care HTML/CSS vechi lasă titlul, bara și butoanele sub player.
   ========================================================= */
function ensureLivePlayerOverlayStructure() {
  const box = document.getElementById("playerVideoBox");
  const video = document.getElementById("player");
  const topOverlay = document.getElementById("liveProgramOverlay");
  const bottomOverlay = document.getElementById("liveControlOverlay");
  if (!box || !video) return;

  box.classList.add("tv-fixed-player-box");
  box.style.position = "relative";
  box.style.overflow = "hidden";
  box.style.background = "#000";
  box.style.borderRadius = "18px";

  if (video.parentElement !== box) box.insertBefore(video, box.firstChild);
  if (topOverlay && topOverlay.parentElement !== box) box.appendChild(topOverlay);
  if (bottomOverlay && bottomOverlay.parentElement !== box) box.appendChild(bottomOverlay);
}

ensureLivePlayerOverlayStructure();

let currentHls = null;
let allMovies = [];
let allSeries = [];
let allChannels = [];
let currentHeroItem = null;
let currentViewItems = [];
let currentViewType = "movie";

if (playerWrap) {
  playerWrap.style.display = "none";
}

/* HELPERS */

function safeText(value, fallback = "") {
  return String(value || fallback)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getTitle(item) {
  return item.title || item.name || "Fără titlu";
}

function getImage(item) {
  return item.poster || item.image || item.backdrop || item.logo || "";
}

function getBackdrop(item) {
  return item.backdrop || item.poster || item.image || item.logo || "";
}

function getStream(item) {
  return item.url || item.streamUrl || "";
}

function getDescription(item) {
  return (
    item.overview ||
    item.description ||
    item.plot ||
    item.subtitle ||
    item.group ||
    "Nu există descriere disponibilă."
  );
}

function normalizeVodUrl(url) {
  if (!url) return "";

  return url
    .replace("https://vod-server.tbserver.online/", "/vod/")
    .replace("https://hls-proxy.tbserver.online/", "/hls-proxy/");
}

function isHlsUrl(url) {
  return (
    url.includes(".m3u8") ||
    url.includes("hls-proxy") ||
    url.endsWith(".m3u")
  );
}

function setHero(title, text, image = "") {
  heroTitle.textContent = title || "TV.TBSERVER";
  heroText.textContent =
    text || "Filme, seriale, radio și Live TV într-o singură aplicație.";

  if (image && hero) {
    hero.style.background = `
      linear-gradient(
        90deg,
        rgba(4,10,24,.97) 0%,
        rgba(4,10,24,.88) 30%,
        rgba(4,10,24,.40) 65%,
        rgba(4,10,24,.15) 100%
      ),
      url('${image}')
    `;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  } else if (hero) {
    hero.style.background = `
      linear-gradient(
        90deg,
        rgba(4,10,24,.97) 0%,
        rgba(4,10,24,.88) 30%,
        rgba(4,10,24,.40) 65%,
        rgba(4,10,24,.15) 100%
      )
    `;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  }
}

function setActiveMenu(label) {
  document.querySelectorAll(".menu-btn").forEach(btn => {
    const text = btn.innerText.trim().toLowerCase();
    btn.classList.toggle("active", text.includes(label.toLowerCase()));
  });
}

function clearContent(title) {
  sectionTitle.textContent = title;
  content.innerHTML = "";
}

function showLoading(message = "Se încarcă...") {
  content.innerHTML = `
    <div class="state-box">
      <div class="loader"></div>
      <p>${safeText(message)}</p>
    </div>
  `;
}

function showError(message, error = null) {
  console.error(message, error);

  content.innerHTML = `
    <div class="state-box error">
      <h3>Oops...</h3>
      <p>${safeText(message)}</p>
    </div>
  `;
}

/* CARDS */

function createCard({
  title,
  subtitle = "",
  image = "",
  badge = "",
  type = "",
  description = "",
  onClick,
  subtitleHtml = false
}) {
  const card = document.createElement("div");
  card.className = `card ${type ? `card-${type}` : ""}`;
  card.tabIndex = 0;

  const finalDescription = description || "Nu există descriere disponibilă.";
  const hasDescription =
    type === "movie" ||
    type === "series" ||
    type === "episode";

  card.innerHTML = `
    ${
      image
        ? `
      <div class="card-image-wrap">
        <img src="${safeText(image)}" alt="${safeText(title)}" loading="lazy">

        ${hasDescription ? `
          <div class="card-desc-overlay">
            <div class="card-desc-title">${safeText(title)}</div>
            <div class="card-desc-text">${safeText(finalDescription)}</div>
          </div>
        ` : ""}
      </div>
    `
        : `
      <div class="card-placeholder">
        <span>${safeText(title).charAt(0).toUpperCase()}</span>

        ${hasDescription ? `
          <div class="card-desc-overlay">
            <div class="card-desc-title">${safeText(title)}</div>
            <div class="card-desc-text">${safeText(finalDescription)}</div>
          </div>
        ` : ""}
      </div>
    `
    }

    <div class="card-body">
      <div class="card-top-line">
        ${badge ? `<div class="card-badge">${safeText(badge)}</div>` : ""}
        ${hasDescription ? `<button class="desc-btn" type="button">Descriere</button>` : ""}
      </div>

      <div class="card-title">${safeText(title)}</div>
      <div class="card-subtitle">${subtitleHtml ? subtitle : safeText(subtitle)}</div>
    </div>
  `;

  card.onclick = onClick;

  const descBtn = card.querySelector(".desc-btn");

  if (descBtn) {
    descBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
    });

    descBtn.addEventListener("mouseenter", () => {
      card.classList.add("show-description");
    });

    descBtn.addEventListener("mouseleave", () => {
      card.classList.remove("show-description");
    });
  }

  card.addEventListener("mouseleave", () => {
    card.classList.remove("show-description");
  });

  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });

  return card;
}
function renderRow(targetId, items, badge, type) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = "";

  items.forEach(item => {
    target.appendChild(
      createCard({
        title: getTitle(item),
        subtitle: type === "live"
          ? [item.epgNow || item.group || item.subtitle || "Live TV", item.epgNext || ""].filter(Boolean).join("<br>")
          : (item.year || item.group || item.subtitle || ""),
        subtitleHtml: type === "live",
        image: getImage(item),
        badge,
        type,
        description: getDescription(item),
        onClick: () => handleItemClick(item, type)
      })
    );
  });
}

function renderCatalog(data, catalogType = "") {
  content.innerHTML = "";

  data.forEach(item => {
    const subtitle = catalogType === "live"
      ? [item.epgNow || item.group || "Live TV", item.epgNext || ""].filter(Boolean).join("<br>")
      : [
          item.year,
          item.rating ? `⭐ ${item.rating}` : ""
        ]
          .filter(Boolean)
          .join(" • ");

    content.appendChild(
      createCard({
        title: getTitle(item),
        subtitle,
        subtitleHtml: catalogType === "live",
        image: getImage(item),
        badge:
          catalogType === "movie"
            ? "Film"
            : catalogType === "series"
            ? "Serial"
            : catalogType === "live"
            ? "Live"
            : "Media",
        type: catalogType,
        description: getDescription(item),
        onClick: () => handleItemClick(item, catalogType)
      })
    );
  });
}


/* EPG UI - STABLE */
let currentLiveItem = null;

function playerProgramTitleFromNow(text = "") {
  return String(text || "")
    .replace(/^Acum\s+\d{1,2}:\d{2}\s*[-–]?\s*\d{1,2}:?\d{0,2}\s*: ?/i, "")
    .replace(/^Acum\s+\d{1,2}:\d{2}\s*: ?/i, "")
    .trim();
}

function setPlayerEpgInfo(item) {
  if (!playerWrap) return;

  let box = document.getElementById("playerEpgInfo");

  if (!box) {
    box = document.createElement("div");
    box.id = "playerEpgInfo";
    box.className = "player-epg-info";
    playerWrap.appendChild(box);
  }

  if (!item) {
    box.innerHTML = "";
    box.style.display = "none";
    if (typeof updateLiveOverlay === "function") updateLiveOverlay(null);
    return;
  }

  const nowTitle = item.epgCurrentTitle || playerProgramTitleFromNow(item.epgNow) || "Program TV";
  const nextTitle = item.epgNextTitle || playerProgramTitleFromNow(item.epgNext) || "";
  const nowStart = item.epgCurrentStart ? formatLiveClock(new Date(item.epgCurrentStart)) : "";
  const nowStop = item.epgCurrentStop ? formatLiveClock(new Date(item.epgCurrentStop)) : "";
  const nextStart = item.epgNextStart ? formatLiveClock(new Date(item.epgNextStart)) : "";
  const nowRange = nowStart && nowStop ? `${nowStart} - ${nowStop}` : "Acum";
  const desc = item.description && !String(item.description).startsWith("Canal din categoria") ? item.description : "";

  box.style.display = "block";
  box.innerHTML = `
    <div class="player-epg-main-card">
      <div class="player-epg-now-block">
        <div class="player-epg-channel">${safeText(item.name || "Live TV")}</div>
        <div class="player-epg-now-label">Acum ${safeText(nowRange)}</div>
        <div class="player-epg-now-title">${safeText(nowTitle)}</div>
        ${desc ? `<div class="player-epg-desc">${safeText(desc)}</div>` : ""}
      </div>

      <div class="player-epg-divider"></div>

      <div class="player-epg-next-block">
        <div class="player-epg-next-label">${nextTitle ? `Urmează ${safeText(nextStart || "")}` : "Urmează"}</div>
        <div class="player-epg-next-title">${safeText(nextTitle || "Program indisponibil")}</div>
        ${item.group ? `<div class="player-epg-next-extra">${safeText(item.group)}</div>` : ""}
      </div>
    </div>

    <div class="player-epg-list-card">
      <div class="player-epg-list-title">EPG - ${safeText(item.name || "Live TV")}</div>
      <div class="player-epg-row is-current">
        <div class="player-epg-row-badge">LIVE</div>
        <div class="player-epg-row-time">${safeText(nowRange)}</div>
        <div class="player-epg-row-title">${safeText(nowTitle)}</div>
        <div class="player-epg-row-next">Acum</div>
      </div>
      ${nextTitle ? `
      <div class="player-epg-row">
        <div></div>
        <div class="player-epg-row-time">${safeText(nextStart || "")}</div>
        <div class="player-epg-row-title">${safeText(nextTitle)}</div>
        <div class="player-epg-row-next">Următorul</div>
      </div>` : ""}
    </div>
  `;

  if (typeof updateLiveOverlay === "function") {
    updateLiveOverlay(item);
  }
}

async function refreshLiveTvEpg(channels, renderAgain = false) {
  if (!Array.isArray(channels) || !channels.length) return;

  if (typeof loadEpgData === "function" && typeof applyEpgToChannels === "function") {
    await loadEpgData();
    applyEpgToChannels(channels);
  }

  if (renderAgain) {
    renderCatalog(channels, "live");
  } else {
    document.querySelectorAll(".card-live").forEach(card => {
      const titleEl = card.querySelector(".card-title");
      const subtitleEl = card.querySelector(".card-subtitle");
      if (!titleEl || !subtitleEl) return;

      const name = titleEl.textContent.trim();
      const ch = channels.find(c => c.name === name);
      if (!ch) return;

      subtitleEl.innerHTML = [
        ch.epgNow || ch.group || "Live TV",
        ch.epgNext || ""
      ].filter(Boolean).join("<br>");
    });
  }

  if (currentLiveItem) {
    const updated = channels.find(c => c.name === currentLiveItem.name);
    if (updated) {
      currentLiveItem = updated;
      setPlayerEpgInfo(updated);
    }
  }
}


/* LIVE PLAYER OVERLAY + PROGRAM PROGRESS */
let liveOverlayTimer = null;

function getLiveEls() {
  return {
    title: document.getElementById("liveProgramTitle"),
    time: document.getElementById("liveProgramTime"),
    fill: document.getElementById("liveProgressFill"),
    dot: document.getElementById("liveProgressDot"),
    timeText: document.getElementById("liveTimeText"),
    pauseBtn: document.getElementById("livePauseBtn"),
    muteBtn: document.getElementById("liveMuteBtn"),
    fullscreenBtn: document.getElementById("liveFullscreenBtn")
  };
}

function formatLiveClock(date) {
  if (!date || isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function parseLiveDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function updateLiveOverlay(item) {
  ensureLivePlayerOverlayStructure();
  const els = getLiveEls();
  if (!playerWrap) return;

  if (!item) {
    playerWrap.classList.remove("is-live-tv");
    if (liveOverlayTimer) clearInterval(liveOverlayTimer);
    liveOverlayTimer = null;
    return;
  }

  playerWrap.classList.add("is-live-tv");

  const title = item.epgCurrentTitle || playerProgramTitleFromNow(item.epgNow) || item.name || "Live TV";
  const start = parseLiveDate(item.epgCurrentStart);
  const stop = parseLiveDate(item.epgCurrentStop);

  if (els.title) els.title.textContent = title;

  const tick = () => {
    const now = new Date();
    let pct = 0;

    if (start && stop && stop > start) {
      pct = ((now - start) / (stop - start)) * 100;
      pct = Math.max(0, Math.min(100, pct));
    }

    if (els.fill) els.fill.style.width = pct + "%";
    if (els.dot) els.dot.style.left = pct + "%";

    if (els.time) {
      els.time.textContent = start && stop
        ? `Acum: ${formatLiveClock(start)} - ${formatLiveClock(stop)}`
        : (item.epgNow || "Acum");
    }

    if (els.timeText) {
      els.timeText.textContent = start && stop
        ? `${formatLiveClock(start)} / ${formatLiveClock(stop)}`
        : "LIVE";
    }
  };

  tick();
  if (liveOverlayTimer) clearInterval(liveOverlayTimer);
  liveOverlayTimer = setInterval(tick, 30000);
}

function initLiveOverlayButtons() {
  ensureLivePlayerOverlayStructure();
  const els = getLiveEls();

  if (els.pauseBtn && player) {
    els.pauseBtn.onclick = () => {
      if (player.paused) {
        player.play().catch(() => {});
      } else {
        player.pause();
      }
      els.pauseBtn.innerHTML = player.paused
        ? '<i class="fa-solid fa-play"></i>'
        : '<i class="fa-solid fa-pause"></i>';
    };
  }

  if (els.muteBtn && player) {
    els.muteBtn.onclick = () => {
      player.muted = !player.muted;
      els.muteBtn.innerHTML = player.muted
        ? '<i class="fa-solid fa-volume-xmark"></i>'
        : '<i class="fa-solid fa-volume-high"></i>';
    };
  }

  if (els.fullscreenBtn) {
    els.fullscreenBtn.onclick = () => {
      const target = document.getElementById("playerVideoBox") || playerWrap || player;
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        target?.requestFullscreen?.();
      }
    };
  }

  if (player) {
    player.addEventListener("play", () => {
      const btn = document.getElementById("livePauseBtn");
      if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    });
    player.addEventListener("pause", () => {
      const btn = document.getElementById("livePauseBtn");
      if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    });
  }
}

function handleItemClick(item, type = "") {
  if (!item) return;

  if (type === "live") {
    currentLiveItem = item;
    setPlayerEpgInfo(item);
  } else {
    currentLiveItem = null;
    setPlayerEpgInfo(null);
  }

  if (item.type === "show" && item.file) {
    stopPlayback();

    const localSeriesFile = item.file.replace(
      "https://vod-server.tbserver.online/catalog/series/",
      "/api/series/"
    );

    loadShowEpisodes(localSeriesFile, getTitle(item));
    return;
  }

  const stream = getStream(item);

  if (!stream) {
    alert("Nu există link de redare pentru acest item.");
    return;
  }

  currentHeroItem = item;

  setHero(
    getTitle(item),
    getDescription(item),
    getBackdrop(item)
  );

  playUrl(stream, item.subtitles || []);
}

/* PLAYER */

async function prepareSubtitles(subtitles = []) {
  player.innerHTML = "";

  for (let i = 0; i < subtitles.length; i++) {
    const sub = subtitles[i];

    if (!sub.url) continue;

    try {
      const srtUrl = normalizeVodUrl(sub.url);
      const res = await fetch(srtUrl);

      if (!res.ok) continue;

      const srtText = await res.text();

      const vttText =
        "WEBVTT\n\n" +
        srtText
          .replace(/\r+/g, "")
          .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");

      const blob = new Blob([vttText], { type: "text/vtt" });
      const vttUrl = URL.createObjectURL(blob);

      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = sub.label || "Română";
      track.srclang = "ro";
      track.src = vttUrl;
      track.default = i === 0;

      player.appendChild(track);
    } catch (e) {
      console.log("Subtitle error:", e);
    }
  }
}

function enableSubtitles() {
  setTimeout(() => {
    for (let i = 0; i < player.textTracks.length; i++) {
      player.textTracks[i].mode = i === 0 ? "showing" : "disabled";
    }
  }, 700);
}

function stopPlayback() {
  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }

  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.innerHTML = "";
    player.load();
  }

  if (playerWrap) {
    playerWrap.style.display = "none";
  }

  document.body.classList.remove("is-playing");
  setPlayerEpgInfo(null);
}

async function playUrl(url, subtitles = []) {
  ensureLivePlayerOverlayStructure();
  if (!url) {
    alert("Nu există link de redare pentru acest item.");
    return;
  }

  const finalUrl = normalizeVodUrl(url);

  document.body.classList.add("is-playing");

  console.log("PLAY URL:", finalUrl);

  if (playerWrap) {
    playerWrap.style.display = "block";
    playerWrap.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  if (currentHls) {
    currentHls.destroy();
    currentHls = null;
  }

  player.pause();
  player.removeAttribute("src");
  player.innerHTML = "";
  player.load();

  await prepareSubtitles(subtitles);

  const startPlayback = () => {
    player.play().catch(err => {
      console.log("PLAY ERROR:", err);
    });
  };

  if (isHlsUrl(finalUrl) && window.Hls && Hls.isSupported()) {
    currentHls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60
    });

    currentHls.loadSource(finalUrl);
    currentHls.attachMedia(player);

    currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
      enableSubtitles();
      startPlayback();
    });

    currentHls.on(Hls.Events.ERROR, (event, data) => {
      console.log("HLS ERROR:", data);

      if (data.fatal) {
        currentHls.destroy();
        currentHls = null;

        player.src = finalUrl;
        player.load();
        startPlayback();
      }
    });

    return;
  }

  player.src = finalUrl;
  player.load();

  player.addEventListener(
    "loadedmetadata",
    () => {
      enableSubtitles();
      startPlayback();
    },
    { once: true }
  );
}

/* HOME */

async function showHome() {
  stopPlayback();

  setActiveMenu("Acasă");
  clearContent("Home");

  content.innerHTML = `
    <div class="home-sections">

      <div class="home-row">
        <div class="home-section-header">
          <h2 class="row-title">Explorează categorii</h2>
        </div>
        <div class="home-categories" id="homeCategories"></div>
      </div>

      <div class="home-row">
        <div class="home-section-header">
          <h2 class="row-title">Filme populare</h2>
          <button class="view-all-btn" onclick="loadMovies()">Vezi toate</button>
        </div>
        <div class="poster-row" id="popularMovies"></div>
      </div>

      <div class="home-row">
        <div class="home-section-header">
          <h2 class="row-title">Seriale recomandate</h2>
          <button class="view-all-btn" onclick="loadSeries()">Vezi toate</button>
        </div>
        <div class="poster-row" id="popularSeries"></div>
      </div>

      <div class="home-row">
        <div class="home-section-header">
          <h2 class="row-title">Live TV</h2>
          <button class="view-all-btn" onclick="loadLiveTv()">Vezi toate</button>
        </div>
        <div class="poster-row" id="livePreview"></div>
      </div>

    </div>
  `;

  const categoryWrap = document.getElementById("homeCategories");

  [
    {
      title: "Filme",
      subtitle: "Catalog VOD",
      badge: "VOD",
      type: "menu",
      description: "Deschide catalogul complet de filme.",
      onClick: loadMovies
    },
    {
      title: "Seriale",
      subtitle: "Episoade și sezoane",
      badge: "SERIES",
      type: "menu",
      description: "Deschide catalogul complet de seriale.",
      onClick: loadSeries
    },
    {
      title: "Radio",
      subtitle: "Radio online",
      badge: "AUDIO",
      type: "menu",
      description: "Ascultă posturile radio disponibile.",
      onClick: loadRadio
    },
    {
      title: "Live TV",
      subtitle: "Canale IPTV",
      badge: "LIVE",
      type: "menu",
      description: "Deschide lista de canale TV live.",
      onClick: loadLiveTv
    }
  ].forEach(item => categoryWrap.appendChild(createCard(item)));

  try {
    const movieRes = await fetch(MOVIES_URL);
    allMovies = await movieRes.json();

    const seriesRes = await fetch(SERIES_URL);
    allSeries = await seriesRes.json();

    const liveRes = await fetch(M3U_URL);
    allChannels = parseM3U(await liveRes.text());

    const randomMovies = [...allMovies]
      .sort(() => 0.5 - Math.random())
      .slice(0, 18);

    const randomSeries = [...allSeries]
      .sort(() => 0.5 - Math.random())
      .slice(0, 18);

    const livePreview = allChannels.slice(0, 18);

    if (randomMovies.length) {
      currentHeroItem = randomMovies[0];

      setHero(
        getTitle(currentHeroItem),
        getDescription(currentHeroItem),
        getBackdrop(currentHeroItem)
      );
    }

    renderRow("popularMovies", randomMovies, "Film", "movie");
    renderRow("popularSeries", randomSeries, "Serial", "series");
    renderRow("livePreview", livePreview, "LIVE", "live");
    refreshLiveTvEpg(allChannels, false);
  } catch (e) {
    console.log(e);
  }
}

/* MOVIES / SERIES */

async function loadMovies() {
  stopPlayback();

  setActiveMenu("Filme");
  clearContent("Filme");
  currentViewType = "movie";

  setHero("Filme", "Toate filmele tale într-un singur loc.");
  await loadJsonCatalog(MOVIES_URL, "movie");
}

async function loadSeries() {
  stopPlayback();

  setActiveMenu("Seriale");
  clearContent("Seriale");
  currentViewType = "series";

  setHero("Seriale", "Serialele tale organizate și ușor de accesat.");
  await loadJsonCatalog(SERIES_URL, "series");
}

async function loadJsonCatalog(url, catalogType = "") {
  showLoading("Se încarcă catalogul...");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Catalog invalid");
    }

    currentViewItems = data;
    currentViewType = catalogType;

    renderCatalog(data, catalogType);

    if (!data.length) {
      showError("Nu există conținut în acest catalog.");
    }
  } catch (e) {
    showError("Eroare la încărcarea catalogului.", e);
  }
}

/* RADIO */

function loadRadio() {
  stopPlayback();

  setActiveMenu("Radio");
  clearContent("Radio");
  currentViewType = "radio";

  setHero("Radio", "Posturile tale radio online.");

  currentViewItems = RADIO_STATIONS;

  RADIO_STATIONS.forEach(station => {
    content.appendChild(
      createCard({
        title: station.name,
        subtitle: station.subtitle,
        badge: "Radio",
        type: "radio",
        description: station.description,
        onClick: () => handleItemClick(station, "radio")
      })
    );
  });
}

/* LIVE TV */

async function loadLiveTv() {
  setActiveMenu("Live TV");
  clearContent("Live TV");
  setHero("Live TV", "Canale TV live din lista M3U.");

  content.innerHTML = "<p>Se încarcă lista Live TV...</p>";

  try {
    const response = await fetch(M3U_URL + "?v=" + Date.now(), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Nu pot încărca live.m3u");
    }

    const text = await response.text();
    allChannels = parseM3U(text);

    if (!allChannels || !allChannels.length) {
      content.innerHTML = "<p>Nu am găsit canale în live.m3u.</p>";
      return;
    }

    currentViewItems = allChannels;

    // 1. Canalele apar imediat.
    renderCatalog(allChannels, "live");

    // 2. EPG-ul se aplică după, fără să blocheze Live TV.
    refreshLiveTvEpg(allChannels, true);
    

  } catch (e) {
    console.error("LIVE TV ERROR:", e);
    content.innerHTML = `
      <p style="color:#ffb4b4;font-weight:800;">Eroare la încărcarea Live TV.</p>
      <pre style="white-space:pre-wrap;color:#9eaccf;">${e}</pre>
    `;
  }
}


function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let current = null;

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (line.startsWith("#EXTINF")) {
      const nameMatch = line.match(/,(.*)$/);
      const idMatch = line.match(/tvg-id="([^"]+)"/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);

      current = {
        name: nameMatch ? nameMatch[1].trim() : "Canal TV",
        tvgId: idMatch ? idMatch[1] : "",
        logo: logoMatch ? logoMatch[1] : "",
        group: groupMatch ? groupMatch[1] : "Live TV",
        description: groupMatch
          ? `Canal din categoria ${groupMatch[1]}.`
          : "Canal TV live.",
        url: ""
      };
    } else if (line && !line.startsWith("#") && current) {
      current.url = normalizeVodUrl(line);
      channels.push(current);
      current = null;
    }
  });

  return channels;
}

/* EPISODES */

async function loadShowEpisodes(fileUrl, showTitle) {
  stopPlayback();

  clearContent(showTitle);
  currentViewType = "episode";

  setHero(showTitle, "Alege episodul pe care vrei să îl vezi.");
  showLoading("Se încarcă episoadele...");

  try {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error("Nu pot încărca JSON-ul serialului");
    }

    const show = await response.json();

    if (!show.seasons || !Array.isArray(show.seasons)) {
      throw new Error("Structura seasons lipsește");
    }

    content.innerHTML = "";

    show.seasons.forEach(season => {
      const seasonBlock = document.createElement("div");
      seasonBlock.className = "season-block";

      const seasonTitle = document.createElement("h2");
      seasonTitle.className = "season-title";
      seasonTitle.textContent = season.title || "Sezon";

      const row = document.createElement("div");
      row.className = "grid";

      if (Array.isArray(season.episodes)) {
        season.episodes.forEach(ep => {
          row.appendChild(
            createCard({
              title: ep.title || "Episod",
              subtitle: `Sezon ${ep.seasonNumber || "?"} • Episod ${
                ep.episodeNumber || "?"
              }`,
              image: ep.poster || ep.image || ep.backdrop || "",
              badge: "Episod",
              type: "episode",
              description: getDescription(ep),
              onClick: () => handleItemClick(ep, "episode")
            })
          );
        });
      }

      seasonBlock.appendChild(seasonTitle);
      seasonBlock.appendChild(row);
      content.appendChild(seasonBlock);
    });
  } catch (e) {
    showError("Eroare la încărcarea episoadelor.", e);
  }
}

/* SEARCH */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();

    if (!q) {
      if (currentViewItems.length) {
        renderCatalog(currentViewItems, currentViewType);
      } else {
        showHome();

      }
      return;
    }

    const source = [
      ...allMovies.map(x => ({ ...x, _kind: "movie" })),
      ...allSeries.map(x => ({ ...x, _kind: "series" })),
      ...allChannels.map(x => ({ ...x, _kind: "live" }))
    ];

    const results = source.filter(item =>
      getTitle(item).toLowerCase().includes(q)
    );

    clearContent(`Căutare: ${searchInput.value}`);
    content.innerHTML = "";

    results.forEach(item => {
      content.appendChild(
        createCard({
          title: getTitle(item),
          subtitle: item.year || item.group || "",
          image: getImage(item),
          badge:
            item._kind === "movie"
              ? "Film"
              : item._kind === "series"
              ? "Serial"
              : "Live",
          type: item._kind,
          description: getDescription(item),
          onClick: () => handleItemClick(item, item._kind)
        })
      );
    });

    if (!results.length) {
      showError("Nu am găsit rezultate.");
    }
  });
}

/* DESCRIPTION MODAL */

function openDescriptionModal(title, description, image = "", subtitle = "") {
  let modal = document.getElementById("descModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "descModal";
    modal.className = "desc-modal";

    modal.innerHTML = `
      <div class="desc-modal-backdrop"></div>

      <div class="desc-modal-box">
        <button class="desc-modal-close" type="button">×</button>

        <div class="desc-modal-image-wrap">
          <img class="desc-modal-image" alt="">
        </div>

        <div class="desc-modal-content">
          <div class="desc-modal-label">Descriere</div>
          <h2 class="desc-modal-title"></h2>
          <div class="desc-modal-subtitle"></div>
          <p class="desc-modal-text"></p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".desc-modal-backdrop").onclick = closeDescriptionModal;
    modal.querySelector(".desc-modal-close").onclick = closeDescriptionModal;

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeDescriptionModal();
      }
    });
  }

  modal.querySelector(".desc-modal-title").textContent = title || "Fără titlu";
  modal.querySelector(".desc-modal-subtitle").textContent = subtitle || "";
  modal.querySelector(".desc-modal-text").textContent =
    description || "Nu există descriere disponibilă.";

  const img = modal.querySelector(".desc-modal-image");

  if (image) {
    img.src = image;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }

  document.body.classList.add("is-playing");
  modal.classList.add("show");
  document.body.classList.add("modal-open");
}

function closeDescriptionModal() {
  const modal = document.getElementById("descModal");

  if (modal) {
    modal.classList.remove("show");
  }

  document.body.classList.remove("modal-open");
}

function showDescriptionHover(title, description, image = "", subtitle = "", anchor = null) {
  let popup = document.getElementById("descHoverPopup");

  if (!popup) {
    popup = document.createElement("div");
    popup.id = "descHoverPopup";
    popup.className = "desc-hover-popup";

    popup.innerHTML = `
      <div class="desc-hover-image-wrap">
        <img class="desc-hover-image" alt="">
      </div>

      <div class="desc-hover-content">
        <div class="desc-hover-label">Descriere</div>
        <h3 class="desc-hover-title"></h3>
        <div class="desc-hover-subtitle"></div>
        <p class="desc-hover-text"></p>
      </div>
    `;

    document.body.appendChild(popup);
  }

  popup.querySelector(".desc-hover-title").textContent = title || "Fără titlu";
  popup.querySelector(".desc-hover-subtitle").textContent = subtitle || "";
  popup.querySelector(".desc-hover-text").textContent =
    description || "Nu există descriere disponibilă.";

  const img = popup.querySelector(".desc-hover-image");

  if (image) {
    img.src = image;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }

  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();

  const popupWidth = 420;
  const popupHeight = 470;
  const gap = 14;

  let left = rect.left + rect.width / 2 - popupWidth / 2;
  let top = rect.top - popupHeight - gap;

  if (top < 20) {
    top = rect.bottom + gap;
  }

  if (left < 20) {
    left = 20;
  }

  if (left + popupWidth > window.innerWidth - 20) {
    left = window.innerWidth - popupWidth - 20;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  popup.classList.add("show");
}
/* HERO BUTTONS */

if (heroPlayBtn) {
  heroPlayBtn.addEventListener("click", () => {
    if (currentHeroItem) {
      handleItemClick(currentHeroItem, "movie");
    } else {
      loadMovies();
    }
  });
}

if (heroInfoBtn) {
  heroInfoBtn.addEventListener("click", () => {
    sectionTitle.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

/* START */

showHome();



/* LIVE TV DESCRIPTION BUTTON FINAL */
document.addEventListener("click", function (event) {
  const btn = event.target.closest(".card-live .desc-btn");
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  const card = btn.closest(".card-live");
  if (!card) return;

  const title = card.querySelector(".card-title")?.textContent?.trim() || "Live TV";
  const subtitle = card.querySelector(".card-subtitle")?.innerText?.trim() || "Nu există descriere disponibilă.";

  if (typeof openDescriptionModal === "function") {
    openDescriptionModal(title, subtitle, "");
  } else {
    alert(title + "\n\n" + subtitle);
  }
}, true);



/* TVTB EPG PERIODIC REFRESH */
setInterval(() => {
  if (Array.isArray(allChannels) && allChannels.length) {
    refreshLiveTvEpg(allChannels, false);
  }
}, 60000);


initLiveOverlayButtons();

/* =========================================================
   TV.TBSERVER DEFINITIVE PLAYER OVERLAY FIX
   Forțează titlul, timpul, bara roșie și butoanele ÎN player,
   chiar dacă browserul folosește CSS vechi din cache.
   ========================================================= */
(function tvDefinitivePlayerOverlayFix(){
  function injectCriticalCss(){
    if (document.getElementById('tv-definitive-player-css')) return;
    const st = document.createElement('style');
    st.id = 'tv-definitive-player-css';
    st.textContent = `
      #playerWrap{width:min(1500px,100%)!important;max-width:none!important;margin:24px auto 18px!important;padding:14px!important;border-radius:22px!important;background:linear-gradient(180deg,rgba(15,24,45,.96),rgba(7,12,24,.98))!important;border:1px solid rgba(105,150,255,.16)!important;box-shadow:0 28px 80px rgba(0,0,0,.42)!important}
      #playerVideoBox{position:relative!important;display:block!important;width:100%!important;aspect-ratio:16/9!important;border-radius:18px!important;overflow:hidden!important;background:#000!important;isolation:isolate!important}
      #playerVideoBox:before{content:""!important;position:absolute!important;inset:0!important;z-index:2!important;pointer-events:none!important;background:transparent!important}
      #playerWrap:not(.is-live-tv) #playerVideoBox:before{background:linear-gradient(90deg,rgba(0,0,0,.30) 0%,rgba(0,0,0,.10) 28%,rgba(0,0,0,0) 58%),linear-gradient(180deg,rgba(0,0,0,.20) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,0) 62%,rgba(0,0,0,.35) 100%)!important}
      #playerVideoBox>#player{position:absolute!important;inset:0!important;z-index:1!important;width:100%!important;height:100%!important;max-height:none!important;aspect-ratio:auto!important;border-radius:0!important;display:block!important;object-fit:cover!important;background:#000!important}
      #liveProgramOverlay{position:absolute!important;top:28px!important;left:28px!important;z-index:30!important;display:block!important;max-width:58%!important;padding:0!important;background:transparent!important;color:#fff!important;pointer-events:none!important;opacity:1!important;visibility:visible!important;transform:none!important}
      #liveProgramTitle{font-size:clamp(22px,2vw,34px)!important;line-height:1.05!important;font-weight:950!important;color:#fff!important;text-shadow:0 3px 16px rgba(0,0,0,.95)!important}
      #liveProgramTime{margin-top:8px!important;font-size:clamp(14px,1vw,17px)!important;font-weight:850!important;color:#fff!important;text-shadow:0 3px 14px rgba(0,0,0,.95)!important}
      #liveProgramOverlay .live-program-badge{display:inline-flex!important;margin-top:10px!important;padding:5px 8px!important;border-radius:5px!important;background:#ff1f1f!important;color:#fff!important;font-size:10px!important;font-weight:950!important;letter-spacing:.45px!important}
      #liveControlOverlay{position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:32!important;display:block!important;padding:0 28px 20px!important;background:linear-gradient(0deg,rgba(0,0,0,.38),rgba(0,0,0,.10) 55%,rgba(0,0,0,0))!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}
      .live-progress-row{width:100%!important;padding:0 0 12px!important}.live-progress-track{position:relative!important;width:100%!important;height:5px!important;border-radius:999px!important;background:rgba(255,255,255,.30)!important;overflow:visible!important}.live-progress-fill{height:100%!important;border-radius:999px!important;background:#ff2020!important;box-shadow:0 0 14px rgba(255,32,32,.70)!important}.live-progress-dot{position:absolute!important;top:50%!important;width:14px!important;height:14px!important;border-radius:50%!important;background:#fff!important;transform:translate(-50%,-50%)!important}.live-controls-row{display:flex!important;align-items:center!important;gap:16px!important;color:#fff!important}.live-control-btn{width:30px!important;height:30px!important;border:0!important;background:transparent!important;color:#fff!important;font-size:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}.live-time-text{font-size:15px!important;font-weight:900!important;color:#fff!important}.live-controls-spacer{flex:1!important}
    `;
    document.head.appendChild(st);
  }

  function makeEl(id, cls, html){
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = cls;
      el.innerHTML = html;
    }
    return el;
  }

  function forceStructure(){
    injectCriticalCss();
    const wrap = document.getElementById('playerWrap');
    const video = document.getElementById('player');
    if (!wrap || !video) return;

    let box = document.getElementById('playerVideoBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'playerVideoBox';
      box.className = 'player-video-box';
      video.parentNode.insertBefore(box, video);
    }

    if (video.parentElement !== box) box.insertBefore(video, box.firstChild);
    video.removeAttribute('controls');

    const top = makeEl('liveProgramOverlay','live-program-overlay',
      '<div class="live-program-title" id="liveProgramTitle">Live TV</div><div class="live-program-time" id="liveProgramTime">Acum</div><div class="live-program-badge">LIVE</div>');
    const bottom = makeEl('liveControlOverlay','live-control-overlay',
      '<div class="live-progress-row"><div class="live-progress-track"><div class="live-progress-fill" id="liveProgressFill"></div><div class="live-progress-dot" id="liveProgressDot"></div></div></div><div class="live-controls-row"><button class="live-control-btn" id="livePauseBtn" type="button"><i class="fa-solid fa-pause"></i></button><button class="live-control-btn" id="liveMuteBtn" type="button"><i class="fa-solid fa-volume-high"></i></button><div class="live-time-text" id="liveTimeText">LIVE</div><div class="live-controls-spacer"></div><button class="live-control-btn" id="liveFullscreenBtn" type="button"><i class="fa-solid fa-expand"></i></button></div>');

    if (top.parentElement !== box) box.appendChild(top);
    if (bottom.parentElement !== box) box.appendChild(bottom);

    const btnPlay = document.getElementById('livePauseBtn');
    const btnMute = document.getElementById('liveMuteBtn');
    const btnFull = document.getElementById('liveFullscreenBtn');
    if (btnPlay && !btnPlay.dataset.bound) {
      btnPlay.dataset.bound = '1';
      btnPlay.onclick = function(){ if(video.paused){video.play().catch(()=>{});} else {video.pause();} btnPlay.innerHTML = video.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>'; };
    }
    if (btnMute && !btnMute.dataset.bound) {
      btnMute.dataset.bound = '1';
      btnMute.onclick = function(){ video.muted = !video.muted; btnMute.innerHTML = video.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>'; };
    }
    if (btnFull && !btnFull.dataset.bound) {
      btnFull.dataset.bound = '1';
      btnFull.onclick = function(){ if(document.fullscreenElement) document.exitFullscreen?.(); else box.requestFullscreen?.(); };
    }
  }

  document.addEventListener('DOMContentLoaded', forceStructure);
  window.addEventListener('load', forceStructure);
  setInterval(forceStructure, 1500);
  forceStructure();
})();


/* =========================================================
   TV.TBSERVER FINAL BEHAVIOUR FIX
   Cerință:
   1) Live TV: titlul emisiunii + bara EPG apar peste video și dispar după 5 secunde.
   2) Filme/Seriale: apare doar titlul sus-stânga, fără EPG/bară Live, și dispare după 5 secunde.
   3) Informația EPG de sub player este curată, fără dubluri/listă lungă.
   ========================================================= */
(function tvTbserverFinalAutoHideFix(){
  let uiHideTimer = null;
  let progressTimer = null;
  let lastMode = "none";
  let lastTitle = "";

  function esc(v) {
    return String(v || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function injectFinalCss() {
    if (document.getElementById("tv-final-autohide-css")) return;
    const st = document.createElement("style");
    st.id = "tv-final-autohide-css";
    st.textContent = `
      #playerWrap:not(.is-live-tv) #liveProgramOverlay,
      #playerWrap:not(.is-live-tv) #liveControlOverlay{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
      #vodTitleOverlay{position:absolute!important;top:28px!important;left:28px!important;z-index:31!important;max-width:70%!important;display:none!important;color:#fff!important;font-size:clamp(22px,2vw,34px)!important;line-height:1.08!important;font-weight:950!important;letter-spacing:-.02em!important;text-shadow:0 3px 18px rgba(0,0,0,.98)!important;pointer-events:none!important;transition:opacity .25s ease,visibility .25s ease!important}
      #playerWrap.is-vod #vodTitleOverlay{display:block!important}
      #playerWrap.player-ui-hidden #liveProgramOverlay,
      #playerWrap.player-ui-hidden #liveControlOverlay,
      #playerWrap.player-ui-hidden #vodTitleOverlay{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
      #playerWrap:not(.player-ui-hidden) #liveProgramOverlay,
      #playerWrap:not(.player-ui-hidden) #liveControlOverlay,
      #playerWrap:not(.player-ui-hidden) #vodTitleOverlay{opacity:1!important;visibility:visible!important}
      #playerWrap.is-live-tv #liveProgramOverlay,#playerWrap.is-live-tv #liveControlOverlay{display:block!important}
      .player-epg-list-card{display:none!important}
    `;
    document.head.appendChild(st);
  }

  function box() { return document.getElementById("playerVideoBox"); }
  function wrap() { return document.getElementById("playerWrap"); }
  function video() { return document.getElementById("player"); }

  function ensureVodTitleOverlay() {
    injectFinalCss();
    if (typeof ensureLivePlayerOverlayStructure === "function") ensureLivePlayerOverlayStructure();

    const b = box();
    if (!b) return null;

    let vod = document.getElementById("vodTitleOverlay");
    if (!vod) {
      vod = document.createElement("div");
      vod.id = "vodTitleOverlay";
      vod.className = "vod-title-overlay";
      b.appendChild(vod);
    } else if (vod.parentElement !== b) {
      b.appendChild(vod);
    }

    const v = video();
    if (v) v.removeAttribute("controls");

    return vod;
  }

  function showUiForFiveSeconds() {
    const w = wrap();
    if (!w) return;
    w.classList.remove("player-ui-hidden");
    if (uiHideTimer) clearTimeout(uiHideTimer);
    uiHideTimer = setTimeout(() => {
      w.classList.add("player-ui-hidden");
    }, 5000);
  }

  function setMode(mode, title) {
    const w = wrap();
    const vod = ensureVodTitleOverlay();
    if (!w) return;

    lastMode = mode || "none";
    lastTitle = title || lastTitle || "";

    w.classList.toggle("is-live-tv", lastMode === "live");
    w.classList.toggle("is-vod", lastMode === "vod");

    if (vod) vod.textContent = lastMode === "vod" ? lastTitle : "";

    showUiForFiveSeconds();
  }

  function fmt(d) {
    if (!d || isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  }

  function date(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function cleanProgramTitle(text) {
    return String(text || "")
      .replace(/^Acum\s+\d{1,2}:\d{2}\s*[-–]?\s*\d{0,2}:?\d{0,2}\s*: ?/i, "")
      .replace(/^Urmeaz[ăa]\s+\d{1,2}:\d{2}\s*: ?/i, "")
      .trim();
  }

  // Înlocuiește updateLiveOverlay: live overlay + progress, dar cu auto-hide 5 secunde.
  window.updateLiveOverlay = function(item) {
    ensureVodTitleOverlay();
    const w = wrap();
    if (!w) return;

    if (!item) {
      w.classList.remove("is-live-tv");
      if (progressTimer) clearInterval(progressTimer);
      progressTimer = null;
      return;
    }

    setMode("live", item.epgCurrentTitle || cleanProgramTitle(item.epgNow) || item.name || "Live TV");

    const titleEl = document.getElementById("liveProgramTitle");
    const timeEl = document.getElementById("liveProgramTime");
    const fillEl = document.getElementById("liveProgressFill");
    const dotEl = document.getElementById("liveProgressDot");
    const timeTextEl = document.getElementById("liveTimeText");

    const title = item.epgCurrentTitle || cleanProgramTitle(item.epgNow) || item.name || "Live TV";
    const start = date(item.epgCurrentStart);
    const stop = date(item.epgCurrentStop);

    if (titleEl) titleEl.textContent = title;

    function tick() {
      const now = new Date();
      let pct = 100;
      if (start && stop && stop > start) {
        pct = ((now - start) / (stop - start)) * 100;
        pct = Math.max(0, Math.min(100, pct));
      }
      if (fillEl) fillEl.style.width = pct + "%";
      if (dotEl) dotEl.style.left = pct + "%";
      if (timeEl) timeEl.textContent = start && stop ? `Acum: ${fmt(start)} - ${fmt(stop)}` : "LIVE";
      if (timeTextEl) timeTextEl.textContent = start && stop ? `${fmt(start)} / ${fmt(stop)}` : "LIVE";
    }

    tick();
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(tick, 30000);
  };

  // Înlocuiește cardul EPG de sub player cu unul curat, fără dubluri și fără listă mare.
  window.setPlayerEpgInfo = function(item) {
    const w = wrap();
    if (!w) return;

    let panel = document.getElementById("playerEpgInfo");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "playerEpgInfo";
      panel.className = "player-epg-info";
      w.appendChild(panel);
    }

    if (!item) {
      panel.innerHTML = "";
      panel.style.display = "none";
      window.updateLiveOverlay(null);
      return;
    }

    const nowTitle = item.epgCurrentTitle || cleanProgramTitle(item.epgNow) || "Program TV";
    const nextTitle = item.epgNextTitle || cleanProgramTitle(item.epgNext) || "Program indisponibil";
    const nowStart = item.epgCurrentStart ? fmt(new Date(item.epgCurrentStart)) : "";
    const nowStop = item.epgCurrentStop ? fmt(new Date(item.epgCurrentStop)) : "";
    const nextStart = item.epgNextStart ? fmt(new Date(item.epgNextStart)) : "";
    const nowRange = nowStart && nowStop ? `${nowStart} - ${nowStop}` : "Acum";
    const desc = item.description && !String(item.description).startsWith("Canal din categoria") ? item.description : "";

    panel.style.display = "block";
    panel.innerHTML = `
      <div class="player-epg-main-card clean-only">
        <div class="player-epg-now-block">
          <div class="player-epg-channel">${esc(item.name || "Live TV")}</div>
          <div class="player-epg-now-label">Acum ${esc(nowRange)}</div>
          <div class="player-epg-now-title">${esc(nowTitle)}</div>
          ${desc ? `<div class="player-epg-desc">${esc(desc)}</div>` : ""}
        </div>
        <div class="player-epg-divider"></div>
        <div class="player-epg-next-block">
          <div class="player-epg-next-label">Urmează ${esc(nextStart)}</div>
          <div class="player-epg-next-title">${esc(nextTitle)}</div>
        </div>
      </div>
    `;

    window.updateLiveOverlay(item);
  };

  // Reține ce se pornește: Live sau VOD.
  const oldHandle = window.handleItemClick;
  if (typeof oldHandle === "function" && !oldHandle.__tvFinalWrapped) {
    window.handleItemClick = function(item, type) {
      window.__TVTB_LAST_CLICK_TYPE = type || "";
      window.__TVTB_LAST_CLICK_TITLE = (item && (item.title || item.name)) || "";
      return oldHandle.apply(this, arguments);
    };
    window.handleItemClick.__tvFinalWrapped = true;
  }

  const oldPlayUrl = window.playUrl;
  if (typeof oldPlayUrl === "function" && !oldPlayUrl.__tvFinalWrapped) {
    window.playUrl = function(url, subtitles) {
      const type = window.__TVTB_LAST_CLICK_TYPE || "";
      const title = window.__TVTB_LAST_CLICK_TITLE || "";

      if (type === "live") {
        setMode("live", title || "Live TV");
      } else if (type === "movie" || type === "series" || type === "episode") {
        setMode("vod", title || "");
      } else {
        setMode("none", "");
      }

      const result = oldPlayUrl.apply(this, arguments);
      Promise.resolve(result).finally(() => {
        if (type === "movie" || type === "series" || type === "episode") {
          setMode("vod", title || "");
        } else if (type !== "live") {
          setMode("none", "");
        }
      });
      return result;
    };
    window.playUrl.__tvFinalWrapped = true;
  }

  function bindActivityEvents() {
    ensureVodTitleOverlay();
    const b = box();
    if (!b || b.dataset.tvAutoHideBound) return;
    b.dataset.tvAutoHideBound = "1";
    ["mousemove", "mousedown", "touchstart", "click", "keydown"].forEach(evt => {
      b.addEventListener(evt, showUiForFiveSeconds, { passive: true });
    });
    showUiForFiveSeconds();
  }

  document.addEventListener("DOMContentLoaded", bindActivityEvents);
  window.addEventListener("load", bindActivityEvents);
  setInterval(bindActivityEvents, 1500);
  bindActivityEvents();
})();


/* =========================================================
   TV.TBSERVER HOTFIX 2400
   - NU schimbă cardul EPG de sub player.
   - Live TV: titlul + bara peste video dispar automat după 5 secunde.
   - Filme/Seriale: doar titlul sus-stânga dispare după 5 secunde.
   - Filme/Seriale primesc controale native video: play/pause/seek/volume/fullscreen.
   ========================================================= */
(function tvTbserverHotfix2400(){
  let hideTimer = null;

  function wrap(){ return document.getElementById('playerWrap'); }
  function box(){ return document.getElementById('playerVideoBox'); }
  function video(){ return document.getElementById('player'); }
  function liveTop(){ return document.getElementById('liveProgramOverlay'); }
  function liveBottom(){ return document.getElementById('liveControlOverlay'); }
  function vodTitle(){ return document.getElementById('vodTitleOverlay'); }

  function important(el, prop, val){
    if (el) el.style.setProperty(prop, val, 'important');
  }

  function clearInlineVisibility(el){
    if (!el) return;
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  function isLive(){
    const w = wrap();
    return !!(w && w.classList.contains('is-live-tv'));
  }

  function isVod(){
    const w = wrap();
    return !!(w && w.classList.contains('is-vod'));
  }

  function applyControlsMode(){
    const v = video();
    if (!v) return;

    if (isLive()) {
      /* Live TV folosește bara custom peste video. */
      v.removeAttribute('controls');
      v.controls = false;
    } else if (isVod()) {
      /* Filme / seriale au nevoie de controale normale. */
      v.setAttribute('controls', 'controls');
      v.controls = true;
    }
  }

  function showPlayerUi(){
    const w = wrap();
    if (!w) return;

    applyControlsMode();
    w.classList.remove('player-ui-hidden');

    if (isLive()) {
      clearInlineVisibility(liveTop());
      clearInlineVisibility(liveBottom());
      important(liveTop(), 'opacity', '1');
      important(liveTop(), 'visibility', 'visible');
      important(liveBottom(), 'opacity', '1');
      important(liveBottom(), 'visibility', 'visible');
      important(liveBottom(), 'pointer-events', 'auto');
      if (vodTitle()) important(vodTitle(), 'opacity', '0');
    }

    if (isVod()) {
      if (liveTop()) important(liveTop(), 'opacity', '0');
      if (liveBottom()) important(liveBottom(), 'opacity', '0');
      important(vodTitle(), 'opacity', '1');
      important(vodTitle(), 'visibility', 'visible');
    }

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePlayerUi, 5000);
  }

  function hidePlayerUi(){
    const w = wrap();
    if (!w) return;

    w.classList.add('player-ui-hidden');

    /* Ascunde DOAR overlay-ul de peste video. Cardul EPG de sub player rămâne neatins. */
    important(liveTop(), 'opacity', '0');
    important(liveTop(), 'visibility', 'hidden');
    important(liveTop(), 'pointer-events', 'none');

    important(liveBottom(), 'opacity', '0');
    important(liveBottom(), 'visibility', 'hidden');
    important(liveBottom(), 'pointer-events', 'none');

    important(vodTitle(), 'opacity', '0');
    important(vodTitle(), 'visibility', 'hidden');
    important(vodTitle(), 'pointer-events', 'none');

    applyControlsMode();
  }

  function injectCss(){
    if (document.getElementById('tv-hotfix-2400-css')) return;
    const st = document.createElement('style');
    st.id = 'tv-hotfix-2400-css';
    st.textContent = `
      /* prioritate mai mare decât regulile vechi cu !important */
      body #playerWrap.player-ui-hidden.is-live-tv #playerVideoBox #liveProgramOverlay,
      body #playerWrap.player-ui-hidden.is-live-tv #playerVideoBox #liveControlOverlay,
      body #playerWrap.player-ui-hidden.is-vod #playerVideoBox #vodTitleOverlay {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      body #playerWrap.is-vod #playerVideoBox #liveProgramOverlay,
      body #playerWrap.is-vod #playerVideoBox #liveControlOverlay {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      body #playerWrap.is-vod #playerVideoBox #vodTitleOverlay {
        display: block !important;
      }
    `;
    document.head.appendChild(st);
  }

  function bind(){
    injectCss();
    applyControlsMode();

    const b = box();
    const v = video();
    if (b && !b.dataset.hotfix2400Bound) {
      b.dataset.hotfix2400Bound = '1';
      ['mousemove','mousedown','click','touchstart'].forEach(ev => {
        b.addEventListener(ev, showPlayerUi, { passive: true });
      });
    }

    if (v && !v.dataset.hotfix2400Bound) {
      v.dataset.hotfix2400Bound = '1';
      ['play','loadedmetadata','canplay'].forEach(ev => {
        v.addEventListener(ev, () => {
          applyControlsMode();
          showPlayerUi();
        });
      });
    }
  }

  document.addEventListener('keydown', showPlayerUi, { passive: true });
  document.addEventListener('DOMContentLoaded', () => { bind(); showPlayerUi(); });
  window.addEventListener('load', () => { bind(); showPlayerUi(); });

  /* Reaplică deoarece codul vechi scotea controls la fiecare 1.5 secunde. */
  setInterval(() => {
    bind();
    applyControlsMode();
    const w = wrap();
    if (w && w.classList.contains('player-ui-hidden')) hidePlayerUi();
  }, 500);

  /* Lasă funcțiile disponibile pentru celelalte bucăți de cod. */
  window.TVTB_SHOW_PLAYER_UI = showPlayerUi;
  window.TVTB_HIDE_PLAYER_UI = hidePlayerUi;
})();

/* =========================================================
   TV.TBSERVER HOTFIX 2500 - DOAR FILME / SERIALE
   IMPORTANT: NU modifică Live TV.
   - Filme/Seriale folosesc bară custom albă, curată.
   - Controalele dispar automat după 5 secunde inclusiv în fullscreen.
   - Native controls sunt ascunse doar pentru VOD ca să nu rămână gri.
   ========================================================= */
(function tvTbserverVodControls2500(){
  let hideTimer = null;
  let progressTimer = null;

  function wrap(){ return document.getElementById('playerWrap'); }
  function box(){ return document.getElementById('playerVideoBox'); }
  function video(){ return document.getElementById('player'); }
  function isVod(){ const w = wrap(); return !!(w && w.classList.contains('is-vod') && !w.classList.contains('is-live-tv')); }
  function isLive(){ const w = wrap(); return !!(w && w.classList.contains('is-live-tv')); }

  function fmt(sec){
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function ensureOverlay(){
    const b = box();
    if (!b) return null;
    let o = document.getElementById('vodControlOverlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'vodControlOverlay';
      o.className = 'vod-control-overlay';
      o.innerHTML = `
        <div class="vod-progress-row" id="vodProgressRow">
          <div class="vod-progress-track" id="vodProgressTrack">
            <div class="vod-progress-fill" id="vodProgressFill"></div>
            <div class="vod-progress-dot" id="vodProgressDot"></div>
          </div>
        </div>
        <div class="vod-controls-row">
          <button class="vod-control-btn" id="vodPlayBtn" type="button" aria-label="Pauză / Play"><i class="fa-solid fa-pause"></i></button>
          <button class="vod-control-btn" id="vodBackBtn" type="button" aria-label="Înapoi 10 secunde"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="vod-control-btn" id="vodMuteBtn" type="button" aria-label="Sunet"><i class="fa-solid fa-volume-high"></i></button>
          <div class="vod-time-text" id="vodTimeText">0:00 / 0:00</div>
          <div class="vod-controls-spacer"></div>
          <button class="vod-control-btn" id="vodFullBtn" type="button" aria-label="Fullscreen"><i class="fa-solid fa-expand"></i></button>
        </div>`;
      b.appendChild(o);
    }
    return o;
  }

  function updateButtons(){
    const v = video();
    const play = document.getElementById('vodPlayBtn');
    const mute = document.getElementById('vodMuteBtn');
    if (play && v) play.innerHTML = v.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    if (mute && v) mute.innerHTML = v.muted || v.volume === 0 ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  }

  function updateProgress(){
    if (!isVod()) return;
    const v = video();
    if (!v) return;
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const cur = isFinite(v.currentTime) ? v.currentTime : 0;
    const pct = dur ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
    const fill = document.getElementById('vodProgressFill');
    const dot = document.getElementById('vodProgressDot');
    const txt = document.getElementById('vodTimeText');
    if (fill) fill.style.width = pct + '%';
    if (dot) dot.style.left = pct + '%';
    if (txt) txt.textContent = `${fmt(cur)} / ${fmt(dur)}`;
    updateButtons();
  }

  function showUi(){
    if (!isVod()) return;
    const w = wrap();
    const o = ensureOverlay();
    const v = video();
    if (!w || !o || !v) return;

    /* Doar pentru Filme/Seriale: nu folosim native controls, ca să nu rămână gri. */
    v.removeAttribute('controls');
    v.controls = false;

    w.classList.remove('vod-ui-hidden');
    w.classList.add('vod-ui-visible');
    updateProgress();

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (isVod() && !v.paused) hideUi();
    }, 5000);
  }

  function hideUi(){
    if (!isVod()) return;
    const w = wrap();
    if (!w) return;
    w.classList.add('vod-ui-hidden');
    w.classList.remove('vod-ui-visible');
  }

  function bind(){
    const b = box();
    const v = video();
    if (!b || !v) return;

    ensureOverlay();

    if (!b.dataset.vodControls2500Bound) {
      b.dataset.vodControls2500Bound = '1';
      ['mousemove','mousedown','click','touchstart'].forEach(ev => b.addEventListener(ev, showUi, {passive:true}));
      b.addEventListener('mouseleave', () => { if (isVod() && !v.paused) hideUi(); }, {passive:true});
    }

    if (!v.dataset.vodControls2500Bound) {
      v.dataset.vodControls2500Bound = '1';
      ['play','pause','timeupdate','durationchange','loadedmetadata','volumechange'].forEach(ev => v.addEventListener(ev, () => {
        if (!isVod()) return;
        updateProgress();
        if (ev === 'pause') showUi();
      }));
    }

    const play = document.getElementById('vodPlayBtn');
    const back = document.getElementById('vodBackBtn');
    const mute = document.getElementById('vodMuteBtn');
    const full = document.getElementById('vodFullBtn');
    const track = document.getElementById('vodProgressTrack');

    if (play && !play.dataset.bound2500) {
      play.dataset.bound2500 = '1';
      play.onclick = e => { e.preventDefault(); e.stopPropagation(); v.paused ? v.play().catch(()=>{}) : v.pause(); showUi(); };
    }
    if (back && !back.dataset.bound2500) {
      back.dataset.bound2500 = '1';
      back.onclick = e => { e.preventDefault(); e.stopPropagation(); v.currentTime = Math.max(0, (v.currentTime || 0) - 10); showUi(); };
    }
    if (mute && !mute.dataset.bound2500) {
      mute.dataset.bound2500 = '1';
      mute.onclick = e => { e.preventDefault(); e.stopPropagation(); v.muted = !v.muted; updateButtons(); showUi(); };
    }
    if (full && !full.dataset.bound2500) {
      full.dataset.bound2500 = '1';
      full.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        const target = box() || v;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else target.requestFullscreen?.();
        showUi();
      };
    }
    if (track && !track.dataset.bound2500) {
      track.dataset.bound2500 = '1';
      track.addEventListener('click', e => {
        if (!isVod()) return;
        e.preventDefault(); e.stopPropagation();
        const r = track.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (isFinite(v.duration) && v.duration > 0) v.currentTime = pct * v.duration;
        updateProgress(); showUi();
      });
    }
  }

  function applyMode(){
    bind();
    const v = video();
    const o = document.getElementById('vodControlOverlay');
    if (!v) return;

    if (isLive()) {
      /* Live TV rămâne neatins. */
      if (o) o.style.display = 'none';
      return;
    }

    if (isVod()) {
      if (o) o.style.display = 'block';
      v.removeAttribute('controls');
      v.controls = false;
      updateProgress();
      if (!wrap()?.classList.contains('vod-ui-hidden')) showUi();
    } else {
      if (o) o.style.display = 'none';
    }
  }

  document.addEventListener('keydown', () => { if (isVod()) showUi(); }, {passive:true});
  document.addEventListener('fullscreenchange', () => { if (isVod()) showUi(); });
  document.addEventListener('DOMContentLoaded', applyMode);
  window.addEventListener('load', applyMode);

  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(applyMode, 500);
})();

/* =========================================================
   TV.TBSERVER HOTFIX 2600 - DOAR FILME / SERIALE
   NU ATINGE Live TV.
   Repară:
   - bara custom Filme/Seriale dispare după 5 secunde, inclusiv fullscreen
   - selector subtitrări / traducere
   - oprește complet filmul/episodul anterior când pornești altul
   ========================================================= */
(function tvTbserverVodOnlyHotfix2600(){
  let hideTimer = null;
  let bindTimer = null;
  let playToken = 0;

  function w(){ return document.getElementById('playerWrap'); }
  function b(){ return document.getElementById('playerVideoBox'); }
  function v(){ return document.getElementById('player'); }
  function isLive(){ const x=w(); return !!(x && x.classList.contains('is-live-tv')); }
  function isVod(){ const x=w(); return !!(x && x.classList.contains('is-vod') && !x.classList.contains('is-live-tv')); }

  function fmt(sec){
    sec = Number(sec);
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function injectCss(){
    if (document.getElementById('tv-vod-only-hotfix-2600-css')) return;
    const st = document.createElement('style');
    st.id = 'tv-vod-only-hotfix-2600-css';
    st.textContent = `
      body #playerWrap.is-vod #playerVideoBox #vodControlOverlay{
        position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:60!important;
        display:block!important;padding:0 26px 18px!important;
        background:linear-gradient(0deg,rgba(0,0,0,.88),rgba(0,0,0,.35) 62%,rgba(0,0,0,0))!important;
        opacity:1!important;visibility:visible!important;pointer-events:auto!important;
        transition:opacity .25s ease,visibility .25s ease!important;
      }
      body #playerWrap.is-vod.vod-ui-hidden #playerVideoBox #vodControlOverlay,
      body #playerWrap.is-vod.vod-ui-hidden #playerVideoBox #vodTitleOverlay{
        opacity:0!important;visibility:hidden!important;pointer-events:none!important;
      }
      body #playerWrap.is-vod #playerVideoBox .vod-progress-row{width:100%!important;padding-bottom:12px!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-progress-track{position:relative!important;width:100%!important;height:5px!important;border-radius:999px!important;background:rgba(255,255,255,.32)!important;cursor:pointer!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-progress-fill{height:100%!important;border-radius:999px!important;background:#fff!important;box-shadow:0 0 12px rgba(255,255,255,.5)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-progress-dot{position:absolute!important;top:50%!important;width:13px!important;height:13px!important;border-radius:50%!important;background:#fff!important;transform:translate(-50%,-50%)!important;box-shadow:0 2px 10px rgba(0,0,0,.8)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-controls-row{display:flex!important;align-items:center!important;gap:14px!important;color:#fff!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-control-btn{width:32px!important;height:32px!important;min-width:32px!important;border:0!important;background:rgba(255,255,255,.06)!important;color:#fff!important;border-radius:8px!important;font-size:17px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-control-btn:hover{background:rgba(255,255,255,.16)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-time-text{font-size:14px!important;font-weight:800!important;color:#fff!important;white-space:nowrap!important;text-shadow:0 2px 10px rgba(0,0,0,.9)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-controls-spacer{flex:1!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-subtitle-select{max-width:260px!important;height:32px!important;border-radius:8px!important;border:1px solid rgba(255,255,255,.25)!important;background:rgba(0,0,0,.65)!important;color:#fff!important;padding:0 8px!important;font-weight:800!important;outline:none!important;}
      body #playerWrap.is-vod #playerVideoBox video::-webkit-media-controls{display:none!important;}
      body #playerWrap.is-vod #playerVideoBox video::-webkit-media-controls-enclosure{display:none!important;}
      body #playerWrap.is-live-tv #playerVideoBox #vodControlOverlay{display:none!important;}
    `;
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    injectCss();
    const box = b();
    if (!box) return null;
    let o = document.getElementById('vodControlOverlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'vodControlOverlay';
      o.className = 'vod-control-overlay';
      o.innerHTML = `
        <div class="vod-progress-row"><div class="vod-progress-track" id="vodProgressTrack"><div class="vod-progress-fill" id="vodProgressFill"></div><div class="vod-progress-dot" id="vodProgressDot"></div></div></div>
        <div class="vod-controls-row">
          <button class="vod-control-btn" id="vodPlayBtn" type="button" title="Play / Pauză"><i class="fa-solid fa-pause"></i></button>
          <button class="vod-control-btn" id="vodBackBtn" type="button" title="Înapoi 10 secunde"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="vod-control-btn" id="vodMuteBtn" type="button" title="Sunet"><i class="fa-solid fa-volume-high"></i></button>
          <div class="vod-time-text" id="vodTimeText">0:00 / 0:00</div>
          <select class="vod-subtitle-select" id="vodSubtitleSelect" title="Subtitrare"><option value="off">Subtitrare: Oprită</option></select>
          <div class="vod-controls-spacer"></div>
          <button class="vod-control-btn" id="vodFullBtn" type="button" title="Fullscreen"><i class="fa-solid fa-expand"></i></button>
        </div>`;
      box.appendChild(o);
    } else if (o.parentElement !== box) {
      box.appendChild(o);
    }
    return o;
  }

  function hardStopBeforeNewPlayback(){
    const video = v();
    playToken++;
    try { if (typeof currentHls !== 'undefined' && currentHls) { currentHls.destroy(); currentHls = null; } } catch(e) {}
    if (video) {
      try { video.pause(); } catch(e) {}
      try { video.removeAttribute('src'); video.src = ''; } catch(e) {}
      try { video.querySelectorAll('source,track').forEach(n => n.remove()); } catch(e) {}
      try { video.load(); } catch(e) {}
    }
  }

  function applyTrack(index){
    const video = v();
    if (!video) return;
    const tracks = Array.from(video.textTracks || []);
    tracks.forEach((t, i) => { t.mode = String(i) === String(index) ? 'showing' : 'disabled'; });
  }

  function refreshSubtitleSelect(){
    if (!isVod()) return;
    const video = v();
    const sel = document.getElementById('vodSubtitleSelect');
    if (!video || !sel) return;
    const tracks = Array.from(video.textTracks || []);
    const current = sel.value;
    sel.innerHTML = '<option value="off">Subtitrare: Oprită</option>';
    tracks.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = t.label ? `Subtitrare: ${t.label}` : `Subtitrare ${i + 1}`;
      sel.appendChild(opt);
    });
    const showing = tracks.findIndex(t => t.mode === 'showing');
    if (showing >= 0) sel.value = String(showing);
    else if ([...sel.options].some(o => o.value === current)) sel.value = current;
    else sel.value = 'off';
  }

  function updateProgress(){
    if (!isVod()) return;
    const video = v();
    if (!video) return;
    const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const cur = isFinite(video.currentTime) ? video.currentTime : 0;
    const pct = dur ? Math.max(0, Math.min(100, cur / dur * 100)) : 0;
    const fill = document.getElementById('vodProgressFill');
    const dot = document.getElementById('vodProgressDot');
    const txt = document.getElementById('vodTimeText');
    const play = document.getElementById('vodPlayBtn');
    const mute = document.getElementById('vodMuteBtn');
    if (fill) fill.style.width = pct + '%';
    if (dot) dot.style.left = pct + '%';
    if (txt) txt.textContent = `${fmt(cur)} / ${fmt(dur)}`;
    if (play) play.innerHTML = video.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    if (mute) mute.innerHTML = (video.muted || video.volume === 0) ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  }

  function hideVodUi(){
    if (!isVod()) return;
    const wrap = w();
    if (!wrap) return;
    wrap.classList.add('vod-ui-hidden');
    wrap.classList.remove('vod-ui-visible');
  }

  function showVodUi(){
    if (!isVod()) return;
    const wrap = w();
    const video = v();
    ensureOverlay();
    if (!wrap || !video) return;
    video.controls = false;
    video.removeAttribute('controls');
    wrap.classList.remove('vod-ui-hidden');
    wrap.classList.add('vod-ui-visible');
    updateProgress();
    refreshSubtitleSelect();
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (isVod() && !video.paused) hideVodUi(); }, 5000);
  }

  function bindControls(){
    injectCss();
    const box = b();
    const video = v();
    if (!box || !video) return;
    ensureOverlay();

    if (isVod()) {
      video.controls = false;
      video.removeAttribute('controls');
    }

    if (!box.dataset.vod2600ActivityBound) {
      box.dataset.vod2600ActivityBound = '1';
      ['mousemove','mousedown','click','touchstart'].forEach(ev => box.addEventListener(ev, showVodUi, {passive:true}));
      box.addEventListener('mouseleave', () => { if (isVod() && !video.paused) hideVodUi(); }, {passive:true});
    }

    if (!video.dataset.vod2600VideoBound) {
      video.dataset.vod2600VideoBound = '1';
      ['play','pause','timeupdate','durationchange','loadedmetadata','loadeddata','canplay','volumechange'].forEach(ev => {
        video.addEventListener(ev, () => {
          if (!isVod()) return;
          video.controls = false;
          video.removeAttribute('controls');
          updateProgress();
          refreshSubtitleSelect();
          if (ev === 'pause' || ev === 'loadedmetadata' || ev === 'canplay') showVodUi();
        });
      });
    }

    const play = document.getElementById('vodPlayBtn');
    const back = document.getElementById('vodBackBtn');
    const mute = document.getElementById('vodMuteBtn');
    const full = document.getElementById('vodFullBtn');
    const track = document.getElementById('vodProgressTrack');
    const sel = document.getElementById('vodSubtitleSelect');

    if (play && !play.dataset.bound2600) { play.dataset.bound2600='1'; play.onclick = e => { e.preventDefault(); e.stopPropagation(); video.paused ? video.play().catch(()=>{}) : video.pause(); showVodUi(); }; }
    if (back && !back.dataset.bound2600) { back.dataset.bound2600='1'; back.onclick = e => { e.preventDefault(); e.stopPropagation(); video.currentTime = Math.max(0, (video.currentTime||0)-10); showVodUi(); }; }
    if (mute && !mute.dataset.bound2600) { mute.dataset.bound2600='1'; mute.onclick = e => { e.preventDefault(); e.stopPropagation(); video.muted = !video.muted; updateProgress(); showVodUi(); }; }
    if (full && !full.dataset.bound2600) { full.dataset.bound2600='1'; full.onclick = e => { e.preventDefault(); e.stopPropagation(); const target = b() || video; document.fullscreenElement ? document.exitFullscreen?.() : target.requestFullscreen?.(); showVodUi(); }; }
    if (track && !track.dataset.bound2600) { track.dataset.bound2600='1'; track.onclick = e => { if (!isVod()) return; e.preventDefault(); e.stopPropagation(); const r=track.getBoundingClientRect(); const pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if (isFinite(video.duration) && video.duration > 0) video.currentTime = pct * video.duration; updateProgress(); showVodUi(); }; }
    if (sel && !sel.dataset.bound2600) { sel.dataset.bound2600='1'; sel.onchange = e => { e.preventDefault(); e.stopPropagation(); const value = sel.value; if (value === 'off') Array.from(video.textTracks || []).forEach(t => t.mode='disabled'); else applyTrack(value); showVodUi(); }; }
  }

  /* Oprește sunetul vechi când alegi alt film/episod. Live TV nu este schimbat vizual. */
  const oldHandle = window.handleItemClick;
  if (typeof oldHandle === 'function' && !oldHandle.__vod2600Wrapped) {
    window.handleItemClick = function(item, type){
      if (type !== 'show') hardStopBeforeNewPlayback();
      const result = oldHandle.apply(this, arguments);
      setTimeout(() => { bindControls(); if (type === 'movie' || type === 'series' || type === 'episode') showVodUi(); }, 250);
      return result;
    };
    window.handleItemClick.__vod2600Wrapped = true;
  }

  const oldPlay = window.playUrl;
  if (typeof oldPlay === 'function' && !oldPlay.__vod2600Wrapped) {
    window.playUrl = function(url, subtitles){
      const myToken = ++playToken;
      const result = oldPlay.apply(this, arguments);
      setTimeout(() => {
        if (myToken !== playToken) return;
        bindControls();
        if (isVod()) showVodUi();
      }, 500);
      return result;
    };
    window.playUrl.__vod2600Wrapped = true;
  }

  document.addEventListener('keydown', () => { if (isVod()) showVodUi(); }, {passive:true});
  document.addEventListener('fullscreenchange', () => { if (isVod()) { bindControls(); showVodUi(); } });
  document.addEventListener('DOMContentLoaded', () => { bindControls(); });
  window.addEventListener('load', () => { bindControls(); });

  if (bindTimer) clearInterval(bindTimer);
  bindTimer = setInterval(() => {
    bindControls();
    if (isVod()) {
      const video = v();
      if (video) { video.controls = false; video.removeAttribute('controls'); }
      updateProgress();
      refreshSubtitleSelect();
    }
  }, 700);
})();

/* =========================================================
   TV.TBSERVER HOTFIX 2700 - DOAR FILME / SERIALE
   NU ATINGE Live TV.
   Fix final:
   - controalele Filme/Seriale dispar forțat după 5 secunde și în fullscreen
   - selector subtitrări vizibil mereu când există subtitrări/track-uri
   - lista de subtitrări se reconstruiește din tracks + array-ul primit la playUrl
   ========================================================= */
(function tvTbserverVodOnlyHotfix2700(){
  let hideTimer = null;
  let lastSubs = [];
  let refreshTimer = null;

  function w(){ return document.getElementById('playerWrap'); }
  function b(){ return document.getElementById('playerVideoBox'); }
  function v(){ return document.getElementById('player'); }
  function isLive(){ const x=w(); return !!(x && x.classList.contains('is-live-tv')); }
  function isVod(){ const x=w(); return !!(x && x.classList.contains('is-vod') && !x.classList.contains('is-live-tv')); }

  function injectCss(){
    if (document.getElementById('tv-vod-only-hotfix-2700-css')) return;
    const st = document.createElement('style');
    st.id = 'tv-vod-only-hotfix-2700-css';
    st.textContent = `
      body #playerWrap.is-live-tv #vodControlOverlay{display:none!important;}
      body #playerWrap.is-vod #playerVideoBox{cursor:none;}
      body #playerWrap.is-vod.vod-ui-visible #playerVideoBox{cursor:default;}
      body #playerWrap.is-vod #playerVideoBox #vodControlOverlay{
        position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:999999!important;
        display:block!important;padding:0 26px 18px!important;
        background:linear-gradient(0deg,rgba(0,0,0,.92),rgba(0,0,0,.45) 62%,rgba(0,0,0,0))!important;
        opacity:1!important;visibility:visible!important;transform:translateY(0)!important;
        pointer-events:auto!important;transition:opacity .22s ease,visibility .22s ease,transform .22s ease!important;
      }
      body #playerWrap.is-vod.vod-ui-hidden #playerVideoBox #vodControlOverlay,
      body #playerWrap.is-vod.player-ui-hidden #playerVideoBox #vodControlOverlay{
        opacity:0!important;visibility:hidden!important;transform:translateY(18px)!important;pointer-events:none!important;
      }
      body #playerWrap.is-vod #playerVideoBox .vod-progress-track{height:5px!important;background:rgba(255,255,255,.36)!important;border-radius:999px!important;position:relative!important;cursor:pointer!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-progress-fill{height:100%!important;background:#fff!important;border-radius:999px!important;box-shadow:0 0 14px rgba(255,255,255,.55)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-progress-dot{position:absolute!important;top:50%!important;width:13px!important;height:13px!important;border-radius:50%!important;background:#fff!important;transform:translate(-50%,-50%)!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-controls-row{display:flex!important;align-items:center!important;gap:14px!important;color:#fff!important;margin-top:10px!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-control-btn{width:34px!important;height:34px!important;min-width:34px!important;border:0!important;background:rgba(0,0,0,.48)!important;color:#fff!important;border-radius:9px!important;font-size:17px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-time-text{font-size:14px!important;font-weight:900!important;color:#fff!important;text-shadow:0 2px 8px #000!important;white-space:nowrap!important;}
      body #playerWrap.is-vod #playerVideoBox .vod-controls-spacer{flex:1!important;}
      body #playerWrap.is-vod #playerVideoBox #vodSubtitleSelect{height:34px!important;min-width:190px!important;max-width:320px!important;border-radius:9px!important;border:1px solid rgba(255,255,255,.32)!important;background:rgba(0,0,0,.78)!important;color:#fff!important;padding:0 10px!important;font-weight:900!important;outline:none!important;display:inline-block!important;}
      body #playerWrap.is-vod #playerVideoBox #vodSubtitleSelect.no-subs{opacity:.55!important;}
      body #playerWrap.is-vod #playerVideoBox video::-webkit-media-controls,
      body #playerWrap.is-vod #playerVideoBox video::-webkit-media-controls-enclosure,
      body #playerWrap.is-vod #playerVideoBox video::-webkit-media-controls-panel{display:none!important;opacity:0!important;visibility:hidden!important;}
    `;
    document.head.appendChild(st);
  }

  function fmt(sec){
    sec = Number(sec); if (!isFinite(sec) || sec < 0) sec = 0; sec = Math.floor(sec);
    const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function ensureOverlay(){
    injectCss();
    const box=b(); if(!box) return null;
    let o=document.getElementById('vodControlOverlay');
    if(!o){
      o=document.createElement('div');
      o.id='vodControlOverlay';
      o.className='vod-control-overlay';
      o.innerHTML=`
        <div class="vod-progress-row"><div class="vod-progress-track" id="vodProgressTrack"><div class="vod-progress-fill" id="vodProgressFill"></div><div class="vod-progress-dot" id="vodProgressDot"></div></div></div>
        <div class="vod-controls-row">
          <button class="vod-control-btn" id="vodPlayBtn" type="button" title="Play / Pauză"><i class="fa-solid fa-pause"></i></button>
          <button class="vod-control-btn" id="vodBackBtn" type="button" title="Înapoi 10 secunde"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="vod-control-btn" id="vodMuteBtn" type="button" title="Sunet"><i class="fa-solid fa-volume-high"></i></button>
          <div class="vod-time-text" id="vodTimeText">0:00 / 0:00</div>
          <select class="vod-subtitle-select" id="vodSubtitleSelect" title="Alege subtitrarea"></select>
          <div class="vod-controls-spacer"></div>
          <button class="vod-control-btn" id="vodFullBtn" type="button" title="Fullscreen"><i class="fa-solid fa-expand"></i></button>
        </div>`;
      box.appendChild(o);
    } else if(o.parentElement!==box) box.appendChild(o);
    return o;
  }

  function forceNoNativeControls(){
    const video=v();
    if(!video || !isVod()) return;
    video.controls=false;
    video.removeAttribute('controls');
    video.setAttribute('controlsList','nodownload noplaybackrate noremoteplayback');
    video.disablePictureInPicture = true;
  }

  function updateProgress(){
    if(!isVod()) return;
    const video=v(); if(!video) return;
    const dur=isFinite(video.duration)&&video.duration>0?video.duration:0;
    const cur=isFinite(video.currentTime)?video.currentTime:0;
    const pct=dur?Math.max(0,Math.min(100,(cur/dur)*100)):0;
    const fill=document.getElementById('vodProgressFill');
    const dot=document.getElementById('vodProgressDot');
    const txt=document.getElementById('vodTimeText');
    const play=document.getElementById('vodPlayBtn');
    const mute=document.getElementById('vodMuteBtn');
    if(fill) fill.style.width=pct+'%';
    if(dot) dot.style.left=pct+'%';
    if(txt) txt.textContent=`${fmt(cur)} / ${fmt(dur)}`;
    if(play) play.innerHTML=video.paused?'<i class="fa-solid fa-play"></i>':'<i class="fa-solid fa-pause"></i>';
    if(mute) mute.innerHTML=(video.muted||video.volume===0)?'<i class="fa-solid fa-volume-xmark"></i>':'<i class="fa-solid fa-volume-high"></i>';
  }

  function subtitleLabelFromUrl(url, fallback){
    const u=String(url||'').toLowerCase();
    if(u.includes('roman')||u.includes('romana')||u.includes('română')||u.includes('.ro')||u.includes('_ro')||u.includes('-ro')) return 'Română';
    if(u.includes('english')||u.includes('.en')||u.includes('_en')||u.includes('-en')) return 'English';
    if(u.includes('spanish')||u.includes('.es')||u.includes('_es')||u.includes('-es')) return 'Español';
    if(u.includes('french')||u.includes('.fr')||u.includes('_fr')||u.includes('-fr')) return 'Français';
    if(u.includes('german')||u.includes('.de')||u.includes('_de')||u.includes('-de')) return 'Deutsch';
    return fallback || 'Subtitrare';
  }

  function setTrackMode(value){
    const video=v(); if(!video) return;
    const tracks=Array.from(video.textTracks||[]);
    tracks.forEach((t,i)=>{ t.mode=(String(i)===String(value))?'showing':'disabled'; });
  }

  function rebuildSubtitleSelect(){
    if(!isVod()) return;
    const video=v(); const sel=document.getElementById('vodSubtitleSelect');
    if(!video || !sel) return;
    const tracks=Array.from(video.textTracks||[]);
    const old=sel.value;
    sel.innerHTML='';
    const off=document.createElement('option'); off.value='off'; off.textContent='Subtitrare: Oprită'; sel.appendChild(off);

    if(tracks.length){
      tracks.forEach((t,i)=>{
        const opt=document.createElement('option');
        opt.value=String(i);
        opt.textContent='Subtitrare: '+(t.label || subtitleLabelFromUrl('', 'Limba '+(i+1)));
        sel.appendChild(opt);
      });
    } else if(Array.isArray(lastSubs) && lastSubs.length){
      lastSubs.forEach((s,i)=>{
        const opt=document.createElement('option');
        opt.value='wait-'+i;
        opt.textContent='Se încarcă: '+(s.label || subtitleLabelFromUrl(s.url, 'Limba '+(i+1)));
        sel.appendChild(opt);
      });
    }

    const showing=tracks.findIndex(t=>t.mode==='showing');
    if(showing>=0) sel.value=String(showing);
    else if([...sel.options].some(o=>o.value===old)) sel.value=old;
    else sel.value='off';

    sel.classList.toggle('no-subs', tracks.length===0 && (!lastSubs || !lastSubs.length));
  }

  function hideUi(){
    if(!isVod()) return;
    const wrap=w(); if(!wrap) return;
    wrap.classList.add('vod-ui-hidden','player-ui-hidden');
    wrap.classList.remove('vod-ui-visible');
  }

  function showUi(){
    if(!isVod()) return;
    const wrap=w(); if(!wrap) return;
    ensureOverlay();
    forceNoNativeControls();
    wrap.classList.remove('vod-ui-hidden','player-ui-hidden');
    wrap.classList.add('vod-ui-visible');
    updateProgress();
    rebuildSubtitleSelect();
    clearTimeout(hideTimer);
    hideTimer=setTimeout(hideUi,5000);
  }

  function bind(){
    injectCss();
    const box=b(); const video=v(); if(!box||!video) return;
    ensureOverlay();

    if(isLive()) return; // Live TV neatins.
    if(isVod()) forceNoNativeControls();

    if(!box.dataset.vod2700ActivityBound){
      box.dataset.vod2700ActivityBound='1';
      ['mousemove','mousedown','click','touchstart','pointermove'].forEach(ev=>box.addEventListener(ev,()=>{ if(isVod()) showUi(); },{passive:true}));
      box.addEventListener('mouseleave',()=>{ if(isVod()) hideUi(); },{passive:true});
    }

    if(!video.dataset.vod2700VideoBound){
      video.dataset.vod2700VideoBound='1';
      ['play','pause','timeupdate','durationchange','loadedmetadata','loadeddata','canplay','volumechange'].forEach(ev=>{
        video.addEventListener(ev,()=>{ if(isVod()){ forceNoNativeControls(); updateProgress(); rebuildSubtitleSelect(); if(ev==='pause') showUi(); } });
      });
    }

    const play=document.getElementById('vodPlayBtn');
    const back=document.getElementById('vodBackBtn');
    const mute=document.getElementById('vodMuteBtn');
    const full=document.getElementById('vodFullBtn');
    const track=document.getElementById('vodProgressTrack');
    const sel=document.getElementById('vodSubtitleSelect');

    if(play && !play.dataset.bound2700){ play.dataset.bound2700='1'; play.onclick=e=>{e.preventDefault();e.stopPropagation(); video.paused?video.play().catch(()=>{}):video.pause(); showUi();}; }
    if(back && !back.dataset.bound2700){ back.dataset.bound2700='1'; back.onclick=e=>{e.preventDefault();e.stopPropagation(); video.currentTime=Math.max(0,(video.currentTime||0)-10); showUi();}; }
    if(mute && !mute.dataset.bound2700){ mute.dataset.bound2700='1'; mute.onclick=e=>{e.preventDefault();e.stopPropagation(); video.muted=!video.muted; updateProgress(); showUi();}; }
    if(full && !full.dataset.bound2700){ full.dataset.bound2700='1'; full.onclick=e=>{e.preventDefault();e.stopPropagation(); const target=b()||video; document.fullscreenElement?document.exitFullscreen?.():target.requestFullscreen?.(); showUi();}; }
    if(track && !track.dataset.bound2700){ track.dataset.bound2700='1'; track.onclick=e=>{ if(!isVod())return; e.preventDefault();e.stopPropagation(); const r=track.getBoundingClientRect(); const pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(isFinite(video.duration)&&video.duration>0) video.currentTime=pct*video.duration; updateProgress(); showUi();}; }
    if(sel && !sel.dataset.bound2700){ sel.dataset.bound2700='1'; sel.onchange=e=>{ e.preventDefault(); e.stopPropagation(); if(sel.value==='off' || sel.value.startsWith('wait-')) Array.from(video.textTracks||[]).forEach(t=>t.mode='disabled'); else setTrackMode(sel.value); showUi(); }; }
  }

  const oldPlay=window.playUrl;
  if(typeof oldPlay==='function' && !oldPlay.__vod2700Wrapped){
    window.playUrl=function(url, subtitles){
      lastSubs = Array.isArray(subtitles) ? subtitles : [];
      const res=oldPlay.apply(this, arguments);
      setTimeout(()=>{ bind(); if(isVod()) showUi(); },250);
      setTimeout(()=>{ bind(); if(isVod()) { rebuildSubtitleSelect(); showUi(); } },1200);
      setTimeout(()=>{ bind(); if(isVod()) { rebuildSubtitleSelect(); hideUi(); } },5200);
      return res;
    };
    window.playUrl.__vod2700Wrapped=true;
  }

  document.addEventListener('fullscreenchange',()=>{ setTimeout(()=>{ bind(); if(isVod()) showUi(); },80); setTimeout(()=>{ if(isVod()) hideUi(); },5100); });
  document.addEventListener('keydown',()=>{ if(isVod()) showUi(); },{passive:true});
  document.addEventListener('DOMContentLoaded',bind);
  window.addEventListener('load',bind);

  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{
    bind();
    if(isVod()){
      forceNoNativeControls();
      updateProgress();
      rebuildSubtitleSelect();
      const wrap=w();
      if(wrap && !wrap.classList.contains('vod-ui-visible')) hideUi();
    }
  },600);
})();


/* =========================================================
   TV.TBSERVER HOTFIX 2800 - DOAR FILME / SERIALE
   NU ATINGE LIVE TV.
   - repară selectorul de subtitrare când overlay-ul exista deja fără <select>
   - subtitrările sunt afișate custom, clare, fără blur
   - selectorul rămâne în bara custom VOD
   ========================================================= */
(function tvTbserverVodSubtitlesClean2800(){
  let activeSubtitleIndex = null;
  let lastKnownTrackCount = 0;

  function wrap(){ return document.getElementById('playerWrap'); }
  function box(){ return document.getElementById('playerVideoBox'); }
  function video(){ return document.getElementById('player'); }
  function isLive(){ const w = wrap(); return !!(w && w.classList.contains('is-live-tv')); }
  function isVod(){ const w = wrap(); return !!(w && w.classList.contains('is-vod') && !w.classList.contains('is-live-tv')); }

  function injectCss(){
    if (document.getElementById('tv-vod-subtitles-clean-2800-css')) return;
    const st = document.createElement('style');
    st.id = 'tv-vod-subtitles-clean-2800-css';
    st.textContent = `
      body #playerWrap.is-live-tv #vodSubtitleSelect,
      body #playerWrap.is-live-tv #vodCaptionOverlay{display:none!important;}

      body #playerWrap.is-vod #playerVideoBox #vodSubtitleSelect{
        display:inline-block!important;
        height:34px!important;
        min-width:220px!important;
        max-width:360px!important;
        border-radius:9px!important;
        border:1px solid rgba(255,255,255,.36)!important;
        background:rgba(0,0,0,.84)!important;
        color:#fff!important;
        padding:0 10px!important;
        font-size:13px!important;
        font-weight:900!important;
        outline:none!important;
        opacity:1!important;
        visibility:visible!important;
      }

      body #playerWrap.is-vod #playerVideoBox #vodSubtitleSelect.no-subs{
        opacity:.72!important;
      }

      body #playerWrap.is-vod #playerVideoBox #vodCaptionOverlay{
        position:absolute!important;
        left:7%!important;
        right:7%!important;
        bottom:78px!important;
        z-index:999998!important;
        display:flex!important;
        justify-content:center!important;
        align-items:center!important;
        text-align:center!important;
        pointer-events:none!important;
        color:#fff!important;
        font-family:Arial, Helvetica, sans-serif!important;
        font-size:clamp(18px, 2.15vw, 30px)!important;
        line-height:1.18!important;
        font-weight:800!important;
        text-shadow:2px 2px 3px #000, -1px -1px 2px #000, 0 0 4px #000!important;
        filter:none!important;
        opacity:1!important;
        transform:none!important;
        -webkit-font-smoothing:antialiased!important;
        text-rendering:geometricPrecision!important;
      }

      body #playerWrap.is-vod.vod-ui-hidden #playerVideoBox #vodCaptionOverlay,
      body #playerWrap.is-vod.player-ui-hidden #playerVideoBox #vodCaptionOverlay{
        bottom:34px!important;
      }

      body #playerWrap.is-vod #playerVideoBox #vodCaptionOverlay .vod-caption-line{
        display:inline-block!important;
        max-width:100%!important;
        padding:4px 10px 5px!important;
        border-radius:6px!important;
        background:rgba(0,0,0,.46)!important;
        color:#fff!important;
        box-decoration-break:clone!important;
        -webkit-box-decoration-break:clone!important;
        filter:none!important;
        backdrop-filter:none!important;
      }

      body #playerWrap.is-vod #playerVideoBox video::cue{
        color:#fff!important;
        background:rgba(0,0,0,.55)!important;
        font-family:Arial, Helvetica, sans-serif!important;
        font-size:22px!important;
        font-weight:800!important;
        text-shadow:2px 2px 3px #000!important;
      }
    `;
    document.head.appendChild(st);
  }

  function labelFromTrack(track, i){
    if (!track) return 'Limba ' + (i + 1);
    const label = track.label || track.language || '';
    if (label) return label;
    return 'Limba ' + (i + 1);
  }

  function ensureSelect(){
    if (isLive()) return null;
    injectCss();
    const b = box();
    if (!b) return null;

    let overlay = document.getElementById('vodControlOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vodControlOverlay';
      overlay.className = 'vod-control-overlay';
      overlay.innerHTML = `
        <div class="vod-progress-row"><div class="vod-progress-track" id="vodProgressTrack"><div class="vod-progress-fill" id="vodProgressFill"></div><div class="vod-progress-dot" id="vodProgressDot"></div></div></div>
        <div class="vod-controls-row">
          <button class="vod-control-btn" id="vodPlayBtn" type="button" title="Play / Pauză"><i class="fa-solid fa-pause"></i></button>
          <button class="vod-control-btn" id="vodBackBtn" type="button" title="Înapoi 10 secunde"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="vod-control-btn" id="vodMuteBtn" type="button" title="Sunet"><i class="fa-solid fa-volume-high"></i></button>
          <div class="vod-time-text" id="vodTimeText">0:00 / 0:00</div>
          <select class="vod-subtitle-select" id="vodSubtitleSelect" title="Alege subtitrarea"></select>
          <div class="vod-controls-spacer"></div>
          <button class="vod-control-btn" id="vodFullBtn" type="button" title="Fullscreen"><i class="fa-solid fa-expand"></i></button>
        </div>`;
      b.appendChild(overlay);
    } else if (overlay.parentElement !== b) {
      b.appendChild(overlay);
    }

    let row = overlay.querySelector('.vod-controls-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'vod-controls-row';
      overlay.appendChild(row);
    }

    let sel = document.getElementById('vodSubtitleSelect');
    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'vodSubtitleSelect';
      sel.className = 'vod-subtitle-select';
      sel.title = 'Alege subtitrarea';

      const spacer = row.querySelector('.vod-controls-spacer');
      if (spacer) row.insertBefore(sel, spacer);
      else row.appendChild(sel);
    }

    if (!sel.dataset.bound2800) {
      sel.dataset.bound2800 = '1';
      sel.addEventListener('click', e => { e.stopPropagation(); });
      sel.addEventListener('mousedown', e => { e.stopPropagation(); });
      sel.addEventListener('change', e => {
        e.stopPropagation();
        const value = sel.value;
        if (value === 'off') activeSubtitleIndex = null;
        else activeSubtitleIndex = Number(value);
        applySubtitleMode();
        updateCaptionText();
        if (window.TVTB_SHOW_PLAYER_UI) window.TVTB_SHOW_PLAYER_UI();
      });
    }
    return sel;
  }

  function ensureCaptionBox(){
    if (isLive()) return null;
    injectCss();
    const b = box();
    if (!b) return null;
    let cap = document.getElementById('vodCaptionOverlay');
    if (!cap) {
      cap = document.createElement('div');
      cap.id = 'vodCaptionOverlay';
      cap.innerHTML = '<span class="vod-caption-line"></span>';
      b.appendChild(cap);
    } else if (cap.parentElement !== b) {
      b.appendChild(cap);
    }
    return cap;
  }

  function getTracks(){
    const v = video();
    return v ? Array.from(v.textTracks || []) : [];
  }

  function rebuildSelect(){
    if (!isVod()) return;
    const sel = ensureSelect();
    if (!sel) return;
    const tracks = getTracks();
    const previous = sel.value;

    sel.innerHTML = '';
    const off = document.createElement('option');
    off.value = 'off';
    off.textContent = 'Subtitrare: Oprită';
    sel.appendChild(off);

    tracks.forEach((track, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = 'Subtitrare: ' + labelFromTrack(track, i);
      sel.appendChild(opt);
    });

    sel.classList.toggle('no-subs', tracks.length === 0);

    if (activeSubtitleIndex !== null && tracks[activeSubtitleIndex]) {
      sel.value = String(activeSubtitleIndex);
    } else if (previous !== 'off' && tracks[Number(previous)]) {
      activeSubtitleIndex = Number(previous);
      sel.value = previous;
    } else if (tracks.length > 0) {
      // Păstrăm comportamentul existent: prima subtitrare pornește automat.
      activeSubtitleIndex = 0;
      sel.value = '0';
    } else {
      activeSubtitleIndex = null;
      sel.value = 'off';
    }

    applySubtitleMode();
  }

  function applySubtitleMode(){
    if (!isVod()) return;
    const tracks = getTracks();
    tracks.forEach((track, i) => {
      // hidden = browserul nu desenează subtitrarea nativă, dar activeCues rămâne disponibil.
      track.mode = (activeSubtitleIndex !== null && i === activeSubtitleIndex) ? 'hidden' : 'disabled';
    });
  }

  function cleanCueText(text){
    return String(text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function updateCaptionText(){
    if (!isVod()) return;
    const cap = ensureCaptionBox();
    const line = cap ? cap.querySelector('.vod-caption-line') : null;
    if (!cap || !line) return;

    if (activeSubtitleIndex === null) {
      cap.style.display = 'none';
      line.textContent = '';
      return;
    }

    const track = getTracks()[activeSubtitleIndex];
    const cues = track && track.activeCues ? Array.from(track.activeCues) : [];
    const text = cues.map(c => cleanCueText(c.text)).filter(Boolean).join('\n');

    if (!text) {
      cap.style.display = 'none';
      line.textContent = '';
      return;
    }

    cap.style.display = 'flex';
    line.textContent = text;
  }

  function bind(){
    if (isLive()) return;
    injectCss();
    ensureSelect();
    ensureCaptionBox();

    const v = video();
    if (!v) return;

    if (!v.dataset.vodSubtitlesClean2800Bound) {
      v.dataset.vodSubtitlesClean2800Bound = '1';
      ['loadedmetadata','loadeddata','canplay','play','timeupdate','seeked','durationchange'].forEach(ev => {
        v.addEventListener(ev, () => {
          if (!isVod()) return;
          rebuildSelect();
          updateCaptionText();
        });
      });
    }

    const tracks = getTracks();
    if (tracks.length !== lastKnownTrackCount) {
      lastKnownTrackCount = tracks.length;
      rebuildSelect();
    } else {
      applySubtitleMode();
    }
    updateCaptionText();
  }

  const oldPlay = window.playUrl;
  if (typeof oldPlay === 'function' && !oldPlay.__vod2800Wrapped) {
    window.playUrl = function(url, subtitles){
      activeSubtitleIndex = null;
      lastKnownTrackCount = 0;
      const res = oldPlay.apply(this, arguments);
      setTimeout(bind, 200);
      setTimeout(bind, 800);
      setTimeout(bind, 1600);
      setTimeout(bind, 3000);
      return res;
    };
    window.playUrl.__vod2800Wrapped = true;
  }

  document.addEventListener('fullscreenchange', () => {
    setTimeout(bind, 80);
    setTimeout(updateCaptionText, 180);
  });
  document.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('load', bind);

  setInterval(() => {
    if (!isVod()) return;
    bind();
    updateCaptionText();
  }, 350);
})();

/* =========================================================
   TV.TBSERVER HOTFIX 2900 - DOAR SERIALE DETAIL + RADIO
   Nu atinge Live TV, filme, subtitrări sau controale existente.
   ========================================================= */
(function tvTbserverSeriesRadioOnly2900(){
  function wrap(){ return document.getElementById('playerWrap'); }
  function box(){ return document.getElementById('playerVideoBox'); }
  function video(){ return document.getElementById('player'); }

  function removeRadioMode(){
    const w = wrap();
    if (w) w.classList.remove('is-radio');
    const overlay = document.getElementById('radioVisualOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function ensureRadioOverlay(station){
    const b = box();
    const w = wrap();
    if (!b || !w) return;

    let overlay = document.getElementById('radioVisualOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'radioVisualOverlay';
      overlay.innerHTML = `
        <div class="radio-visual-card">
          <img class="radio-visual-logo" src="https://owncloud.tbserver.online/index.php/s/tzZXGpI8Ri7Ndqa/download" alt="TV.TBSERVER">
          <div class="radio-visual-title" id="radioVisualTitle">Radio TV.TBSERVER</div>
          <div class="radio-visual-subtitle" id="radioVisualSubtitle">Se redă live</div>
          <div class="radio-bars"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        </div>`;
      b.appendChild(overlay);
    } else if (overlay.parentElement !== b) {
      b.appendChild(overlay);
    }

    const t = document.getElementById('radioVisualTitle');
    const s = document.getElementById('radioVisualSubtitle');
    if (t) t.textContent = (station && (station.name || station.title)) || 'Radio TV.TBSERVER';
    if (s) s.textContent = (station && (station.subtitle || station.description)) || 'Se redă live';

    w.classList.add('is-radio');
    w.classList.remove('is-vod', 'is-live-tv');
    overlay.style.display = 'flex';

    const v = video();
    if (v) {
      v.controls = false;
      v.removeAttribute('controls');
    }
  }

  const oldHandle = window.handleItemClick;
  if (typeof oldHandle === 'function' && !oldHandle.__seriesRadio2900Wrapped) {
    window.handleItemClick = function(item, type){
      if (type !== 'radio') removeRadioMode();
      const result = oldHandle.apply(this, arguments);
      if (type === 'radio') {
        setTimeout(function(){ ensureRadioOverlay(item); }, 120);
        setTimeout(function(){ ensureRadioOverlay(item); }, 700);
      }
      return result;
    };
    window.handleItemClick.__seriesRadio2900Wrapped = true;
  }

  const oldStop = window.stopPlayback;
  if (typeof oldStop === 'function' && !oldStop.__seriesRadio2900Wrapped) {
    window.stopPlayback = function(){
      removeRadioMode();
      return oldStop.apply(this, arguments);
    };
    window.stopPlayback.__seriesRadio2900Wrapped = true;
  }

  const oldLoadRadio = window.loadRadio;
  if (typeof oldLoadRadio === 'function' && !oldLoadRadio.__seriesRadio2900Wrapped) {
    window.loadRadio = function(){
      const result = oldLoadRadio.apply(this, arguments);
      setTimeout(function(){
        const title = document.getElementById('sectionTitle');
        if (title) title.textContent = 'Radio';
      }, 50);
      return result;
    };
    window.loadRadio.__seriesRadio2900Wrapped = true;
  }
})();

/* ============================= */
/* LIVE TV FORCE CLEAR VIDEO FIX */
/* NU ATINGE FILME/SERIALE       */
/* ============================= */

function forceClearLiveTvVideo() {
    const video = document.querySelector("video");

    if (!video) return;

    const isLive =
        document.body.classList.contains("live-tv") ||
        document.body.classList.contains("livetv") ||
        location.href.toLowerCase().includes("live") ||
        document.querySelector(".live-info-card") ||
        document.querySelector(".epg-now-card");

    if (!isLive) return;

    video.style.filter = "none";
    video.style.backdropFilter = "none";
    video.style.opacity = "1";
    video.style.mixBlendMode = "normal";
    video.style.transform = "none";

    const wrappers = [
        ".player",
        ".player-shell",
        ".video-wrapper",
        ".video-shell",
        ".live-player",
        ".player-box",
        "#player",
        "#playerContainer"
    ];

    wrappers.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.style.filter = "none";
            el.style.backdropFilter = "none";
            el.style.opacity = "1";
            el.style.mixBlendMode = "normal";
        });
    });

    document.querySelectorAll(".player-overlay, .video-overlay, .live-overlay").forEach(el => {
        el.style.backdropFilter = "none";
        el.style.filter = "none";
        el.style.background = "transparent";
    });
}

setInterval(forceClearLiveTvVideo, 500);
document.addEventListener("DOMContentLoaded", forceClearLiveTvVideo);
document.addEventListener("click", () => {
    setTimeout(forceClearLiveTvVideo, 300);
});

/* LIVE TV OSD AUTO HIDE - scoate gradientul după 5 secunde */
(function () {
    let liveOsdTimer = null;

    function hideLiveOsd() {
        document.body.classList.add("osd-hidden");
    }

    function showLiveOsd() {
        document.body.classList.remove("osd-hidden");

        clearTimeout(liveOsdTimer);
        liveOsdTimer = setTimeout(hideLiveOsd, 5000);
    }

    document.addEventListener("mousemove", showLiveOsd);
    document.addEventListener("click", showLiveOsd);
    document.addEventListener("keydown", showLiveOsd);
    document.addEventListener("touchstart", showLiveOsd);

    setTimeout(showLiveOsd, 500);
})();

/* =========================================================
   TV.TBSERVER HOTFIX 3100 - LIVE TV CLEAR VIDEO FINAL
   IMPORTANT: rulează după toate fix-urile vechi și scoate doar pelicula
   de pe Live TV. Nu atinge Filme/Seriale/Radio.
   ========================================================= */
(function tvLiveClearVideoFinal3100(){
  function inject(){
    let st = document.getElementById('tv-live-clear-video-final-3100');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tv-live-clear-video-final-3100';
      document.head.appendChild(st);
    }
    st.textContent = `
      #playerWrap.is-live-tv #playerVideoBox::before,
      #playerWrap.is-live-tv .player-video-box::before,
      #playerWrap.is-live-tv .tv-fixed-player-box::before{
        background:transparent!important;
        opacity:0!important;
        filter:none!important;
        backdrop-filter:none!important;
      }
      #playerWrap.is-live-tv #player,
      #playerWrap.is-live-tv video#player,
      #playerWrap.is-live-tv #playerVideoBox video{
        filter:none!important;
        backdrop-filter:none!important;
        opacity:1!important;
        mix-blend-mode:normal!important;
        image-rendering:auto!important;
      }
      #playerWrap.is-live-tv #liveControlOverlay{
        background:linear-gradient(0deg,rgba(0,0,0,.38),rgba(0,0,0,.10) 55%,rgba(0,0,0,0))!important;
      }
      #playerWrap.is-live-tv.player-ui-hidden #liveProgramOverlay,
      #playerWrap.is-live-tv.player-ui-hidden #liveControlOverlay{
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
    `;
  }
  function cleanInline(){
    const wrap = document.getElementById('playerWrap');
    const video = document.getElementById('player');
    if (!wrap || !wrap.classList.contains('is-live-tv')) return;
    if (video) {
      video.style.filter = 'none';
      video.style.backdropFilter = 'none';
      video.style.opacity = '1';
      video.style.mixBlendMode = 'normal';
    }
  }
  inject();
  setInterval(function(){ inject(); cleanInline(); }, 700);
  document.addEventListener('DOMContentLoaded', function(){ inject(); cleanInline(); });
  document.addEventListener('click', function(){ setTimeout(cleanInline, 50); });
})();
