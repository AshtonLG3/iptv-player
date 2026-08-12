export const APP_NAME = 'Rugare TV';
export const APP_VERSION = '1.6.7';

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
    shortLabel: 'SABC+',
    logo: 'assets/services/sabc-plus.png',
    country: 'South Africa',
    url: 'https://sabc-plus.com/',
    androidPackage: 'tv.sabcplus.vod',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=tv.sabcplus.vod',
    note: 'Official SABC+ app for live TV, radio, sport',
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
    shortLabel: 'e+',
    logo: 'assets/services/evod.svg',
    country: 'South Africa',
    url: 'https://watch.evod.co.za/live-tv',
    androidPackage: 'com.brightcove.evod',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.brightcove.evod',
    note: 'Official eVOD app for e.tv and eMedia streaming',
  },
  {
    id: 'afree-tv',
    name: 'Afree TV',
    shortLabel: 'AfreeTV',
    logo: 'assets/services/afreetv.svg',
    country: 'South Africa',
    url: 'https://afreetv.net/',
    note: 'African live TV and on-demand',
  },
  {
    id: 'zplus',
    name: 'Z+ / ZBC',
    shortLabel: 'Z+',
    logo: 'assets/services/zplus.png',
    country: 'Zimbabwe',
    url: 'https://zbc.ottplatform.com/',
    androidPackage: 'com.zbc.ottapp',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.zbc.ottapp',
    note: 'Official Z+ app for ZBC TV, News 24, Jive TV',
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
  {
    id: 'sportytv-app',
    name: 'SportyTV',
    shortLabel: 'SportyTV',
    logo: 'assets/services/sportytv.svg',
    country: 'Africa',
    url: 'https://sporty.com/sporty-tv',
    androidPackage: 'com.sporty.android',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.sporty.android',
    androidDeepLink: 'sporty-com://com.sporty.android/channel-247',
    note: 'Official SportyTV 24/7 player',
  },
];

export const FEATURED_OFFICIAL_SERVICE_IDS = [
  'afree-tv',
  'evod',
  'sabc-plus',
  'zplus',
  'sportytv-app',
];
