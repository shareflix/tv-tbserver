/* =============================
   CONFIG
   Schimbi aici sursele principale.
   ============================= */

window.TVTB_CONFIG = {
  APP_NAME: "TV.TBSERVER",

  MOVIES_URL: "https://vod-server.tbserver.online/catalog/movies.json",
  SERIES_URL: "https://vod-server.tbserver.online/catalog/series.json",
  M3U_URL: "live.m3u",

  RADIO_STATIONS: [
    {
      name: "Radio TV.TBSERVER",
      subtitle: "MY.RADIO",
      url: "https://tb.shareflix.co.uk/listen/myradio/radio.mp3"
    }
  ],

  EPG_URLS: [
    "https://iptv-epg.org/files/epg-ro.xml",
    "https://epgshare01.online/epgshare01/epg_ripper_RO1.xml.gz"
  ],

  EPG_MAX_HOURS_LOOKAHEAD: 4
};
