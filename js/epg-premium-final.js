
/* ========================================================= */
/* TV.TBSERVER FINAL 3300 - LIVE TV EPG PREMIUM CARD         */
/* Un singur chenar: Acum / Urmează + navigare 48h           */
/* ========================================================= */
(function () {
    "use strict";

    let activeChannel = null;
    let programs = [];
    let currentIndex = 0;
    let renderTimer = null;

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function fmtTime(value) {
        const d = new Date(value);
        if (!value || isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    }

    function collectPrograms(channel) {
        try {
            if (!channel || !window.TVTB_EPG || !window.TVTB_EPG.programmes) return [];
            if (typeof window.findEpgChannelId !== "function" && typeof findEpgChannelId !== "function") return [];

            const findId = window.findEpgChannelId || findEpgChannelId;
            const id = findId(channel);
            if (!id) return [];

            const list = window.TVTB_EPG.programmes.get(id);
            if (!Array.isArray(list) || !list.length) return [];

            const now = Date.now();
            const max = now + 48 * 60 * 60 * 1000;

            return list
                .filter(function (p) {
                    const start = new Date(p.start).getTime();
                    const stop = p.stop ? new Date(p.stop).getTime() : start + 30 * 60 * 1000;
                    return start <= max && stop >= now;
                })
                .slice(0, 80);
        } catch (err) {
            console.warn("TVTB final EPG collect error", err);
            return [];
        }
    }

    function cardEl() {
        return document.getElementById("playerEpgInfo");
    }

    function buildShell() {
        const card = cardEl();
        if (!card) return null;

        if (card.dataset.tvtbFinalEpg !== "3300") {
            card.dataset.tvtbFinalEpg = "3300";
            card.classList.add("tvtb-epg-premium");

            card.innerHTML = `
                <button id="tvtbEpgPrev" class="tvtb-epg-nav" type="button" aria-label="Program anterior">‹</button>

                <section id="tvtbEpgNow" class="tvtb-epg-side tvtb-epg-now"></section>

                <div class="tvtb-epg-divider" aria-hidden="true"></div>

                <section id="tvtbEpgNext" class="tvtb-epg-side tvtb-epg-next"></section>

                <button id="tvtbEpgNextBtn" class="tvtb-epg-nav" type="button" aria-label="Program următor">›</button>

                <div id="tvtbEpgCount" class="tvtb-epg-count"></div>
            `;
        }

        const prev = document.getElementById("tvtbEpgPrev");
        const next = document.getElementById("tvtbEpgNextBtn");

        if (prev && !prev.dataset.bound) {
            prev.dataset.bound = "1";
            prev.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                step(-1);
            });
        }

        if (next && !next.dataset.bound) {
            next.dataset.bound = "1";
            next.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                step(1);
            });
        }

        return card;
    }

    function render(force) {
        if (!activeChannel || !programs.length) return;

        const card = buildShell();
        if (!card) return;

        const nowBox = document.getElementById("tvtbEpgNow");
        const nextBox = document.getElementById("tvtbEpgNext");
        const count = document.getElementById("tvtbEpgCount");

        if (!nowBox || !nextBox) return;

        const p = programs[currentIndex];
        const nextP = programs[currentIndex + 1] || null;

        nowBox.innerHTML = `
            <div class="tvtb-epg-channel">${esc(activeChannel.name || "")}</div>
            <div class="tvtb-epg-time">${currentIndex === 0 ? "Acum " : ""}${esc(fmtTime(p.start))}${p.stop ? " - " + esc(fmtTime(p.stop)) : ""}</div>
            <div class="tvtb-epg-title">${esc(p.title || "Program TV")}</div>
            ${p.desc ? `<p class="tvtb-epg-desc">${esc(p.desc)}</p>` : ""}
        `;

        nextBox.innerHTML = nextP ? `
            <div class="tvtb-epg-time">Urmează ${esc(fmtTime(nextP.start))}</div>
            <div class="tvtb-epg-title">${esc(nextP.title || "Program TV")}</div>
            ${nextP.desc ? `<p class="tvtb-epg-desc">${esc(nextP.desc)}</p>` : ""}
        ` : `
            <div class="tvtb-epg-time">Urmează</div>
            <div class="tvtb-epg-title">Nu există program disponibil</div>
        `;

        if (count) count.textContent = `${currentIndex + 1} / ${programs.length}`;
    }

    function step(delta) {
        if (!programs.length) return;

        currentIndex = Math.max(0, Math.min(programs.length - 1, currentIndex + delta));
        render(true);
    }

    function loadForChannel(channel) {
        if (!channel) return;

        activeChannel = channel;

        function run() {
            const nextPrograms = collectPrograms(channel);
            if (!nextPrograms.length) return;

            programs = nextPrograms;
            currentIndex = 0;

            clearTimeout(renderTimer);
            renderTimer = setTimeout(function () { render(true); }, 120);

            setTimeout(function () { render(true); }, 700);
            setTimeout(function () { render(true); }, 1600);
        }

        if (typeof window.loadEpgData === "function") {
            window.loadEpgData().then(run).catch(run);
        } else if (typeof loadEpgData === "function") {
            loadEpgData().then(run).catch(run);
        } else {
            run();
        }
    }

    // Prindem schimbarea canalului Live TV fără să atingem restul aplicației.
    const wrapHandle = function () {
        const oldHandle = window.handleItemClick;
        if (typeof oldHandle === "function" && !oldHandle.__tvtbFinalEpg3300) {
            window.handleItemClick = function (item, type) {
                const result = oldHandle.apply(this, arguments);

                if (type === "live" && item) {
                    setTimeout(function () { loadForChannel(item); }, 450);
                    setTimeout(function () { loadForChannel(item); }, 1400);
                }

                return result;
            };
            window.handleItemClick.__tvtbFinalEpg3300 = true;
        }
    };

    const wrapSetInfo = function () {
        const oldSet = window.setPlayerEpgInfo;
        if (typeof oldSet === "function" && !oldSet.__tvtbFinalEpg3300) {
            window.setPlayerEpgInfo = function (item) {
                const result = oldSet.apply(this, arguments);

                if (item) {
                    setTimeout(function () { loadForChannel(item); }, 250);
                    setTimeout(function () { loadForChannel(item); }, 1100);
                }

                return result;
            };
            window.setPlayerEpgInfo.__tvtbFinalEpg3300 = true;
        }
    };

    // Fallback: dacă alte scripturi rescriu cardul, îl refacem.
    function watchdog() {
        wrapHandle();
        wrapSetInfo();

        const card = cardEl();
        if (card && activeChannel && programs.length && card.dataset.tvtbFinalEpg !== "3300") {
            render(true);
        }
    }

    document.addEventListener("keydown", function (e) {
        if (!cardEl() || !programs.length) return;

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
        }

        if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
        }
    }, true);

    document.addEventListener("DOMContentLoaded", function () {
        wrapHandle();
        wrapSetInfo();
        setInterval(watchdog, 1000);
    });

    setTimeout(function () {
        wrapHandle();
        wrapSetInfo();
        setInterval(watchdog, 1000);
    }, 500);
})();


/* ========================================================= */
/* TV.TBSERVER FINAL 3304 - EPG LIVE ONLY STABLE             */
/* Ascunde EPG doar când pornește Film/Serial/Radio.         */
/* Nu folosește timer agresiv, deci Live TV nu mai dispare.  */
/* ========================================================= */
(function () {
    "use strict";

    function isLiveType(type, item) {
        const t = String(type || "").toLowerCase();

        if (t === "live" || t === "livetv" || t === "live-tv" || t === "tv" || t.includes("live")) {
            return true;
        }

        if (item) {
            const hasEpgIdentity = !!(item.tvgId || item.tvgName || item.epgCurrentTitle || item.epgNow);
            const group = String(item.group || "").toLowerCase();
            const name = String(item.name || item.title || "").toLowerCase();

            if (hasEpgIdentity) return true;
            if (group.includes("live") || group.includes("tv")) return true;

            // Canale românești uzual au nume TV/HD și obiect EPG/logo.
            if ((name.includes(" tv") || name.endsWith("tv") || name.includes(" hd")) && (item.logo || item.tvgLogo)) {
                return true;
            }
        }

        return false;
    }

    function isNonLiveType(type) {
        const t = String(type || "").toLowerCase();

        return (
            t.includes("movie") ||
            t.includes("film") ||
            t.includes("series") ||
            t.includes("serial") ||
            t.includes("episode") ||
            t.includes("vod") ||
            t.includes("radio")
        );
    }

    function markLive() {
        document.body.classList.add("tvtb-live-player");
        document.body.classList.remove("tvtb-non-live-player");

        const card = document.getElementById("playerEpgInfo");
        if (card) {
            card.style.display = "";
        }
    }

    function markNonLive() {
        document.body.classList.remove("tvtb-live-player");
        document.body.classList.add("tvtb-non-live-player");

        const card = document.getElementById("playerEpgInfo");
        if (card && card.classList.contains("tvtb-epg-premium")) {
            card.style.display = "none";
        }
    }

    function patchHandleItemClick() {
        if (typeof window.handleItemClick !== "function") return false;
        if (window.handleItemClick.__tvtb3304StableLiveOnly) return true;

        const oldHandle = window.handleItemClick;

        window.handleItemClick = function (item, type) {
            const live = isLiveType(type, item);
            const nonLive = !live && isNonLiveType(type);

            if (live) {
                markLive();
            } else if (nonLive) {
                markNonLive();
            }

            const result = oldHandle.apply(this, arguments);

            if (live) {
                setTimeout(markLive, 100);
                setTimeout(markLive, 600);
                setTimeout(markLive, 1400);
            } else if (nonLive) {
                setTimeout(markNonLive, 80);
                setTimeout(markNonLive, 400);
            }

            return result;
        };

        window.handleItemClick.__tvtb3304StableLiveOnly = true;
        return true;
    }

    function patchSetPlayerEpgInfo() {
        if (typeof window.setPlayerEpgInfo !== "function") return false;
        if (window.setPlayerEpgInfo.__tvtb3304StableLiveOnly) return true;

        const oldSet = window.setPlayerEpgInfo;

        window.setPlayerEpgInfo = function (item) {
            markLive();

            const result = oldSet.apply(this, arguments);

            setTimeout(markLive, 100);
            setTimeout(markLive, 700);
            setTimeout(markLive, 1400);

            return result;
        };

        window.setPlayerEpgInfo.__tvtb3304StableLiveOnly = true;
        return true;
    }

    // Click pe meniul principal: ascunde doar pe secțiuni non-live.
    document.addEventListener("click", function (e) {
        const text = (e.target && e.target.textContent ? e.target.textContent : "").trim().toLowerCase();

        if (text === "live tv" || text.includes("live tv")) {
            setTimeout(markLive, 120);
            return;
        }

        if (
            text === "filme" ||
            text === "seriale" ||
            text === "radio" ||
            text === "acasă" ||
            text === "acasa"
        ) {
            setTimeout(markNonLive, 120);
        }
    }, true);

    const patchTimer = setInterval(function () {
        const a = patchHandleItemClick();
        const b = patchSetPlayerEpgInfo();

        if (a && b) {
            clearInterval(patchTimer);
        }
    }, 250);

    setTimeout(function () {
        clearInterval(patchTimer);
        patchHandleItemClick();
        patchSetPlayerEpgInfo();
    }, 8000);
})();


/* ========================================================= */
/* TV.TBSERVER FINAL 3305 - FIX 2 PROBLEME                   */
/* 1) Live EPG nu se mai strică după câteva secunde           */
/* 2) Filme/Seriale/Radio nu mai lasă chenar gol sub player   */
/* ========================================================= */
(function () {
    "use strict";

    let lastLiveChannel3305 = null;
    let lastPrograms3305 = [];
    let lastIndex3305 = 0;
    let liveLock3305 = false;

    function esc3305(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function time3305(value) {
        const d = new Date(value);
        if (!value || isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    }

    function isLiveItem3305(type, item) {
        const t = String(type || "").toLowerCase();

        if (t === "live" || t === "livetv" || t === "live-tv" || t.includes("live")) {
            return true;
        }

        if (!item) return false;

        if (item.tvgId || item.tvgName || item.epgNow || item.epgCurrentTitle || item.epgCurrentStart) {
            return true;
        }

        const group = String(item.group || "").toLowerCase();
        const name = String(item.name || item.title || "").toLowerCase();

        if (group.includes("live") || group.includes("tv")) return true;
        if ((name.includes(" tv") || name.endsWith("tv") || name.includes(" hd")) && (item.logo || item.tvgLogo)) return true;

        return false;
    }

    function isNonLiveItem3305(type) {
        const t = String(type || "").toLowerCase();

        return (
            t.includes("movie") ||
            t.includes("film") ||
            t.includes("series") ||
            t.includes("serial") ||
            t.includes("episode") ||
            t.includes("vod") ||
            t.includes("radio")
        );
    }

    function getPrograms3305(channel) {
        try {
            if (!channel || !window.TVTB_EPG || !window.TVTB_EPG.programmes) return [];
            if (typeof window.findEpgChannelId !== "function") return [];

            const id = window.findEpgChannelId(channel);
            if (!id) return [];

            const list = window.TVTB_EPG.programmes.get(id);
            if (!Array.isArray(list)) return [];

            const now = Date.now();
            const max = now + 48 * 60 * 60 * 1000;

            return list.filter(function (p) {
                const start = new Date(p.start).getTime();
                const stop = p.stop ? new Date(p.stop).getTime() : start + 30 * 60 * 1000;
                return start <= max && stop >= now;
            }).slice(0, 80);
        } catch (e) {
            console.warn("3305 EPG programs error", e);
            return [];
        }
    }

    function markLive3305() {
        liveLock3305 = true;
        document.body.classList.add("tvtb-live-player");
        document.body.classList.remove("tvtb-non-live-player");

        const card = document.getElementById("playerEpgInfo");
        if (card) {
            card.style.display = "";
            card.style.height = "";
            card.style.minHeight = "";
            card.style.padding = "";
            card.style.margin = "";
            card.style.border = "";
        }
    }

    function markNonLive3305() {
        liveLock3305 = false;
        document.body.classList.remove("tvtb-live-player");
        document.body.classList.add("tvtb-non-live-player");

        const card = document.getElementById("playerEpgInfo");
        if (card) {
            card.innerHTML = "";
            card.classList.remove("tvtb-epg-premium");
            card.removeAttribute("data-tvtb-final-epg");
            card.style.display = "none";
            card.style.height = "0";
            card.style.minHeight = "0";
            card.style.padding = "0";
            card.style.margin = "0";
            card.style.border = "0";
            card.style.overflow = "hidden";
        }
    }

    function buildPremiumShell3305() {
        const card = document.getElementById("playerEpgInfo");
        if (!card || !liveLock3305) return null;

        card.classList.add("tvtb-epg-premium");
        card.dataset.tvtbFinalEpg = "3305";

        card.innerHTML = `
            <button id="tvtbEpgPrev" class="tvtb-epg-nav" type="button" aria-label="Program anterior">‹</button>

            <section id="tvtbEpgNow" class="tvtb-epg-side tvtb-epg-now"></section>

            <div class="tvtb-epg-divider" aria-hidden="true"></div>

            <section id="tvtbEpgNext" class="tvtb-epg-side tvtb-epg-next"></section>

            <button id="tvtbEpgNextBtn" class="tvtb-epg-nav" type="button" aria-label="Program următor">›</button>

            <div id="tvtbEpgCount" class="tvtb-epg-count"></div>
        `;

        const prev = document.getElementById("tvtbEpgPrev");
        const next = document.getElementById("tvtbEpgNextBtn");

        if (prev) {
            prev.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                step3305(-1);
            };
        }

        if (next) {
            next.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                step3305(1);
            };
        }

        return card;
    }

    function render3305(force) {
        if (!liveLock3305 || !lastLiveChannel3305 || !lastPrograms3305.length) return;

        let card = document.getElementById("playerEpgInfo");

        const broken =
            !card ||
            !card.classList.contains("tvtb-epg-premium") ||
            !document.getElementById("tvtbEpgNow") ||
            !document.getElementById("tvtbEpgNext") ||
            !document.getElementById("tvtbEpgPrev") ||
            !document.getElementById("tvtbEpgNextBtn");

        if (broken || force) {
            card = buildPremiumShell3305();
        }

        if (!card) return;

        markLive3305();

        const p = lastPrograms3305[lastIndex3305];
        const nextP = lastPrograms3305[lastIndex3305 + 1] || null;

        const nowBox = document.getElementById("tvtbEpgNow");
        const nextBox = document.getElementById("tvtbEpgNext");
        const count = document.getElementById("tvtbEpgCount");

        if (!nowBox || !nextBox) return;

        nowBox.innerHTML = `
            <div class="tvtb-epg-channel">${esc3305(lastLiveChannel3305.name || "")}</div>
            <div class="tvtb-epg-time">${lastIndex3305 === 0 ? "Acum " : ""}${esc3305(time3305(p.start))}${p.stop ? " - " + esc3305(time3305(p.stop)) : ""}</div>
            <div class="tvtb-epg-title">${esc3305(p.title || "Program TV")}</div>
            ${p.desc ? `<p class="tvtb-epg-desc">${esc3305(p.desc)}</p>` : ""}
        `;

        nextBox.innerHTML = nextP ? `
            <div class="tvtb-epg-time">Urmează ${esc3305(time3305(nextP.start))}</div>
            <div class="tvtb-epg-title">${esc3305(nextP.title || "Program TV")}</div>
            ${nextP.desc ? `<p class="tvtb-epg-desc">${esc3305(nextP.desc)}</p>` : ""}
        ` : `
            <div class="tvtb-epg-time">Urmează</div>
            <div class="tvtb-epg-title">Nu există program disponibil</div>
        `;

        if (count) {
            count.textContent = `${lastIndex3305 + 1} / ${lastPrograms3305.length}`;
        }
    }

    function step3305(delta) {
        if (!lastPrograms3305.length) return;

        lastIndex3305 = Math.max(0, Math.min(lastPrograms3305.length - 1, lastIndex3305 + delta));
        render3305(true);
    }

    function loadLive3305(channel) {
        lastLiveChannel3305 = channel;
        markLive3305();

        function run() {
            const list = getPrograms3305(channel);

            if (list.length) {
                lastPrograms3305 = list;
                lastIndex3305 = 0;
                render3305(true);

                setTimeout(function () { render3305(true); }, 600);
                setTimeout(function () { render3305(true); }, 1600);
            }
        }

        if (typeof window.loadEpgData === "function") {
            window.loadEpgData().then(run).catch(run);
        } else {
            run();
        }
    }

    function patchClicks3305() {
        if (typeof window.handleItemClick === "function" && !window.handleItemClick.__tvtb3305) {
            const oldHandle = window.handleItemClick;

            window.handleItemClick = function (item, type) {
                const live = isLiveItem3305(type, item);
                const nonLive = !live && isNonLiveItem3305(type);

                if (live) {
                    markLive3305();
                } else if (nonLive) {
                    markNonLive3305();
                }

                const result = oldHandle.apply(this, arguments);

                if (live) {
                    setTimeout(function () { loadLive3305(item); }, 250);
                    setTimeout(function () { loadLive3305(item); }, 1100);
                } else if (nonLive) {
                    setTimeout(markNonLive3305, 60);
                    setTimeout(markNonLive3305, 500);
                    setTimeout(markNonLive3305, 1500);
                }

                return result;
            };

            window.handleItemClick.__tvtb3305 = true;
        }

        if (typeof window.setPlayerEpgInfo === "function" && !window.setPlayerEpgInfo.__tvtb3305) {
            const oldSet = window.setPlayerEpgInfo;

            window.setPlayerEpgInfo = function (item) {
                markLive3305();

                const result = oldSet.apply(this, arguments);

                setTimeout(function () { loadLive3305(item); }, 120);
                setTimeout(function () { loadLive3305(item); }, 800);

                return result;
            };

            window.setPlayerEpgInfo.__tvtb3305 = true;
        }
    }

    document.addEventListener("click", function (e) {
        const text = (e.target && e.target.textContent ? e.target.textContent : "").trim().toLowerCase();

        if (text === "live tv" || text.includes("live tv")) {
            setTimeout(function () {
                markLive3305();
                if (lastLiveChannel3305) render3305(true);
            }, 150);
            return;
        }

        if (
            text === "filme" ||
            text === "seriale" ||
            text === "radio" ||
            text === "acasă" ||
            text === "acasa"
        ) {
            setTimeout(markNonLive3305, 80);
        }
    }, true);

    document.addEventListener("keydown", function (e) {
        if (!liveLock3305 || !document.getElementById("playerEpgInfo")) return;

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            step3305(-1);
        }

        if (e.key === "ArrowRight") {
            e.preventDefault();
            step3305(1);
        }
    }, true);

    // Watchdog: dacă aplicația rescrie cardul după câteva secunde, îl reconstruim premium.
    setInterval(function () {
        patchClicks3305();

        const card = document.getElementById("playerEpgInfo");

        if (!liveLock3305) {
            if (card && card.innerHTML.trim() !== "") {
                markNonLive3305();
            }
            return;
        }

        if (card && lastLiveChannel3305 && lastPrograms3305.length) {
            const broken =
                !card.classList.contains("tvtb-epg-premium") ||
                !document.getElementById("tvtbEpgNow") ||
                !document.getElementById("tvtbEpgNext");

            if (broken) {
                render3305(true);
            }
        }
    }, 700);

    patchClicks3305();
})();
