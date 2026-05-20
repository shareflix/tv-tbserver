/* TV.TBSERVER EPG - FINAL STABLE
   1) Încearcă /epg.json local.
   2) Dacă nu există, încearcă /epg.xml, /epg.xml.gz și URL-urile din js/config.js.
   3) Aplică EPG pe cardurile Live TV, Home Live TV și sub player.
*/

window.TVTB_EPG = {
  ready: false,
  loading: false,
  promise: null,
  source: "",
  aliases: new Map(),
  compactAliases: new Map(),
  programmes: new Map()
};

function epgCleanName(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(hd|fhd|sd|uhd|4k|ro|romania|romanian|tv|channel)\b/g, " ")
    .replace(/\+/g, " plus ")
    .replace(/&/g, " si ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function epgCompactName(value = "") {
  return epgCleanName(value).replace(/\s+/g, "");
}

function epgFormatTime(date) {
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function epgAddAlias(alias, id) {
  if (!alias || !id) return;

  const key = epgCleanName(alias);
  const compactKey = epgCompactName(alias);

  if (key) window.TVTB_EPG.aliases.set(key, id);
  if (compactKey) window.TVTB_EPG.compactAliases.set(compactKey, id);
}

function epgParseXmltvDate(value = "") {
  const text = String(value || "").trim();
  const m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);

  if (!m) {
    const fallback = new Date(text);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const tz = m[7] || "+0000";

  const sign = tz.startsWith("-") ? -1 : 1;
  const tzh = Number(tz.slice(1, 3));
  const tzm = Number(tz.slice(3, 5));
  const offsetMinutes = sign * (tzh * 60 + tzm);

  const utc = Date.UTC(y, mo, d, h, mi, s) - offsetMinutes * 60000;
  return new Date(utc);
}

function epgDecodeResponseBuffer(buffer, url = "") {
  const lower = String(url || "").toLowerCase();

  if (lower.endsWith(".gz") && window.pako) {
    const inflated = window.pako.ungzip(new Uint8Array(buffer));
    return new TextDecoder("utf-8").decode(inflated);
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function epgResetStore() {
  window.TVTB_EPG.aliases = new Map();
  window.TVTB_EPG.compactAliases = new Map();
  window.TVTB_EPG.programmes = new Map();
}

function epgLoadFromJson(data, source = "epg.json") {
  epgResetStore();

  window.TVTB_EPG.programmes = new Map(Object.entries(data.programmes || {}));

  Object.entries(data.aliases || {}).forEach(([alias, id]) => {
    epgAddAlias(alias, id);
    epgAddAlias(id, id);
  });

  Object.entries(data.channelNames || {}).forEach(([id, name]) => {
    epgAddAlias(id, id);
    epgAddAlias(name, id);
  });

  window.TVTB_EPG.ready = true;
  window.TVTB_EPG.source = source;
  return window.TVTB_EPG;
}

function epgLoadFromXml(xmlText, source = "xmltv") {
  epgResetStore();

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  if (xml.querySelector("parsererror")) {
    throw new Error("XMLTV invalid");
  }

  xml.querySelectorAll("channel").forEach(channel => {
    const id = channel.getAttribute("id") || "";
    if (!id) return;

    epgAddAlias(id, id);

    channel.querySelectorAll("display-name").forEach(nameEl => {
      epgAddAlias(nameEl.textContent || "", id);
    });
  });

  xml.querySelectorAll("programme").forEach(programme => {
    const channelId = programme.getAttribute("channel") || "";
    if (!channelId) return;

    const start = epgParseXmltvDate(programme.getAttribute("start"));
    const stop = epgParseXmltvDate(programme.getAttribute("stop"));
    if (!start) return;

    const title = programme.querySelector("title")?.textContent?.trim() || "Program TV";
    const desc = programme.querySelector("desc")?.textContent?.trim() || "";
    const category = programme.querySelector("category")?.textContent?.trim() || "";

    if (!window.TVTB_EPG.programmes.has(channelId)) {
      window.TVTB_EPG.programmes.set(channelId, []);
    }

    window.TVTB_EPG.programmes.get(channelId).push({
      start: start.toISOString(),
      stop: stop ? stop.toISOString() : "",
      title,
      desc,
      category
    });
  });

  for (const list of window.TVTB_EPG.programmes.values()) {
    list.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  window.TVTB_EPG.ready = true;
  window.TVTB_EPG.source = source;
  return window.TVTB_EPG;
}

function epgGetSources() {
  const cfg = window.TVTB_CONFIG || {};
  const external = Array.isArray(cfg.EPG_URLS) ? cfg.EPG_URLS : [];

  return [
    "/epg.json",
    "/epg.xml",
    "/epg.xml.gz",
    ...external
  ].filter(Boolean);
}

async function epgFetchSource(url) {
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now(), {
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`EPG ${res.status}: ${url}`);

  if (url.toLowerCase().includes(".json")) {
    const data = await res.json();
    return epgLoadFromJson(data, url);
  }

  const buffer = await res.arrayBuffer();
  const text = epgDecodeResponseBuffer(buffer, url);
  return epgLoadFromXml(text, url);
}

async function loadEpgData() {
  if (window.TVTB_EPG.ready) return window.TVTB_EPG;
  if (window.TVTB_EPG.promise) return window.TVTB_EPG.promise;

  window.TVTB_EPG.loading = true;

  window.TVTB_EPG.promise = (async () => {
    const sources = epgGetSources();
    let lastError = null;

    for (const source of sources) {
      try {
        const epg = await epgFetchSource(source);
        console.log("EPG loaded from:", epg.source);
        window.TVTB_EPG.loading = false;
        return epg;
      } catch (err) {
        lastError = err;
        console.warn("EPG source failed:", source, err);
      }
    }

    window.TVTB_EPG.ready = false;
    window.TVTB_EPG.loading = false;
    window.TVTB_EPG.promise = null;
    console.warn("No EPG source loaded", lastError);
    return window.TVTB_EPG;
  })();

  return window.TVTB_EPG.promise;
}

function findEpgChannelId(channel) {
  if (!channel || !window.TVTB_EPG) return "";

  const rawCandidates = [
    channel.tvgId,
    channel.name,
    String(channel.name || "").replace(/\s+HD$/i, ""),
    String(channel.name || "").replace(/\s+FHD$/i, ""),
    String(channel.name || "").replace(/\s+SD$/i, "")
  ].filter(Boolean);

  for (const candidate of rawCandidates) {
    const key = epgCleanName(candidate);
    const compact = epgCompactName(candidate);

    if (window.TVTB_EPG.aliases.has(key)) return window.TVTB_EPG.aliases.get(key);
    if (window.TVTB_EPG.compactAliases.has(compact)) return window.TVTB_EPG.compactAliases.get(compact);
  }

  const wanted = epgCompactName(channel.name || channel.tvgId || "");
  if (wanted) {
    for (const [key, id] of window.TVTB_EPG.compactAliases.entries()) {
      if (key.includes(wanted) || wanted.includes(key)) return id;
    }
  }

  return "";
}

function getNowAndNextForChannel(channel) {
  const id = findEpgChannelId(channel);
  if (!id) return null;

  const list = window.TVTB_EPG.programmes.get(id);
  if (!Array.isArray(list) || !list.length) return null;

  const now = new Date();

  const current = list.find(item => {
    const start = new Date(item.start);
    const stop = item.stop ? new Date(item.stop) : null;
    return stop ? (start <= now && stop > now) : (start <= now);
  });

  const next = current
    ? list.find(item => new Date(item.start) > new Date(current.start))
    : list.find(item => new Date(item.start) > now);

  if (!current && !next) return null;
  return { current, next };
}

function applyEpgToChannels(channels = []) {
  if (!Array.isArray(channels)) return channels;

  channels.forEach(channel => {
    const epg = getNowAndNextForChannel(channel);

    if (!epg) {
      channel.epgNow = "EPG indisponibil momentan";
      channel.epgNextTitle = "";
      channel.epgNextStart = "";
      channel.epgNext = "";
      channel.epgCurrentTitle = "";
      channel.epgCurrentStart = "";
      channel.epgCurrentStop = "";
      channel.epgNextTitle = "";
      channel.epgNextStart = "";
      channel.description = channel.description || channel.group || "Live TV";
      return;
    }

    if (epg.current) {
      channel.epgCurrentTitle = epg.current.title || "Program TV";
      channel.epgCurrentStart = epg.current.start || "";
      channel.epgCurrentStop = epg.current.stop || "";
      channel.epgNow = `Acum ${epgFormatTime(new Date(epg.current.start))}: ${epg.current.title}`;
      channel.description = epg.current.desc || `Acum: ${epg.current.title}`;
    } else {
      channel.epgCurrentTitle = "";
      channel.epgCurrentStart = "";
      channel.epgCurrentStop = "";
      channel.epgNow = channel.group || "Live TV";
    }

    if (epg.next) {
      channel.epgNextTitle = epg.next.title || "";
      channel.epgNextStart = epg.next.start || "";
      channel.epgNext = `Urmează ${epgFormatTime(new Date(epg.next.start))}: ${epg.next.title}`;
    } else {
      channel.epgNextTitle = "";
      channel.epgNextStart = "";
      channel.epgNext = "";
    }
  });

  return channels;
}

window.loadEpgData = loadEpgData;
window.applyEpgToChannels = applyEpgToChannels;
window.findEpgChannelId = findEpgChannelId;
window.getNowAndNextForChannel = getNowAndNextForChannel;
