export const APP_NAME = 'FTA IPTV Player';
export const APP_VERSION = '1.2.6';

export const FTA_COUNTRIES = {
  zw: 'Zimbabwe',
  za: 'South Africa',
  zm: 'Zambia',
  bw: 'Botswana',
  ke: 'Kenya',
  gh: 'Ghana',
  ng: 'Nigeria',
  uk: 'United Kingdom',
  us: 'United States',
};

export const CURATED_PLAYLISTS = [
  {
    id: 'main',
    name: 'Main M3U',
    description: 'English Africa, UK, USA',
    url: 'playlists/english-africa-uk-us-verified.m3u',
    publicUrl: 'https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/english-africa-uk-us-verified.m3u',
  },
  {
    id: 'sports',
    name: 'Sports M3U',
    description: 'Sports and cue sports',
    url: 'playlists/sports-africa-uk-us-verified.m3u',
    publicUrl: 'https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/sports-africa-uk-us-verified.m3u',
  },
];

export const COMPATIBLE_PLAYERS = [
  {
    id: 'vlc-android',
    name: 'VLC Android',
    platform: 'Android / Google TV',
    url: 'https://play.google.com/store/apps/details?id=org.videolan.vlc',
  },
  {
    id: 'vlc-desktop',
    name: 'VLC desktop',
    platform: 'Windows / macOS / Linux',
    url: 'https://www.videolan.org/vlc/',
  },
  {
    id: 'tivimate',
    name: 'TiviMate',
    platform: 'Android TV',
    url: 'https://tivimate.com/',
  },
];

export const OFFICIAL_SERVICES = [
  {
    id: 'sabc-plus',
    name: 'SABC+',
    country: 'South Africa',
    url: 'https://sabc-plus.com/',
    note: 'SABC live TV, radio, sport',
  },
  {
    id: 'sabc-sport',
    name: 'SABC Sport',
    country: 'South Africa',
    url: 'https://www.sabcsport.com/tv/live',
    note: 'Live sport schedule',
  },
  {
    id: 'evod',
    name: 'eVOD / e.tv',
    country: 'South Africa',
    url: 'https://watch.evod.co.za/live-tv',
    note: 'e.tv and eMedia streaming',
  },
  {
    id: 'afree-tv',
    name: 'Afree TV',
    country: 'South Africa',
    url: 'https://afreetv.net/',
    note: 'African live TV and on-demand',
  },
  {
    id: 'zplus',
    name: 'Z+ / ZBC',
    country: 'Zimbabwe',
    url: 'https://zbc.ottplatform.com/',
    note: 'ZBC TV, News 24, Jive TV',
  },
  {
    id: 'zbc-youtube',
    name: 'ZBC YouTube',
    country: 'Zimbabwe',
    url: 'https://www.youtube.com/@zbcentertainment/streams',
    note: 'ZBC live streams',
  },
  {
    id: 'openview',
    name: 'Openview',
    country: 'South Africa',
    url: 'https://www.openview.co.za/',
    note: 'Free satellite channels',
  },
];
