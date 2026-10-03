// Keep national networks while excluding local US/UK station and regional feeds.
export function isExcludedRegionalChannel(channel, info = {}, feed = {}) {
  const id = channel.id?.split('@')[0] || '';
  const country = (info.country || id.split('.').pop() || '').toUpperCase();
  if (!['US', 'UK'].includes(country)) return false;
  const name = `${channel.name || ''} ${info.name || ''}`;
  if (feed.broadcast_area?.some((area) => /^[sr]\/(US|UK)[-\/]/i.test(area))) return true;
  if (country === 'US') {
    if (/^(?:ABCNewsLive\d*|CBSNews(?:247|Live)?|NBCNewsNOW|FoxNews|FoxNewsRadio|FoxWeather|Newsmax2|NewsmaxTV|NewsNation|CNN|CNBC|MSNBC)\.us$/.test(id)) return false;
    const localSource = `${channel.primaryUrl || ''} ${info.website || ''}`;
    if (/cablecast|castus\.tv|tightrope|reflect-live/i.test(localSource)) return true;
    if (/^(?:ATXN|BHTV|CANTV|CCX|CMAC|CMAP|CreaTV|CVTV|DerryTV|MCN|MCTV|NCTV|PCTV|PEGTV|RVTV|SFGovTV|SMCTV|TAPTV|WeHoTV)/.test(id)) return true;
    if (/\b(?:access\s*\d|accessvision|access nashua|akaku|ATXN|BATV|BHTV|BMC-HD|BIG Civic|BX (?:Arts|Culture|Inform|Inspire|Omni)|CAN TV|CC-TV|CCX\d|CMAC|CMAP|CMCTV|CMTV|CreaTV|CVTV|DerryTV|DKN|MCN\d|MCTV|LMC-TV|LMC TV|NCTV|PCTV|PEGTV|RCTV|RVTV|SCVTV|SFGovTV|SMCTV|TAP TV|Temecula TV|TSTV|TUTV|WeHoTV|City TV|Detroit Channel|Scottsdale Channel)\b/i.test(name)) return true;
    if (/\b(?:ABC\s+(?!News Live\b)|CBS\s+(?!News(?:\s+24\/7|\s+Live)?(?:\s*\(|\s*$)))/i.test(channel.name || '')) return true;
    if (/^(?:CBSNews(?!247|Live|\.us)|News12(?!\.us)|NBC[1-9]|FOX[1-9])/.test(id)) return true;
    if (/\b[KW][A-Z0-9]{2,5}(?:[- ](?:DT|TV|LD))?\b/.test(name)) return true;
    if (/\b(?:ABC|CBS|NBC|FOX|CW|News)\s*\d+\b|\b(?:city of|county|community|public access|government|local|metro|municipal)\b/i.test(name)) return true;
    if (info.categories?.includes('legislative')) return true;
  } else {
    if (/^(BBCOne|BBCTwo|ITV1|STV)\.uk$/.test(id) && feed.is_main === false) return true;
    if (/\b(?:London Live|Belfast|Birmingham|Bristol|Cardiff|Leeds|Liverpool|Manchester|Notts|Sheffield|Teesside|Tyne|That's Local)\b/i.test(name)) return true;
    if (/\b(?:BBC One|BBC Two|ITV1|ITV 1|STV)\b/i.test(name) && !/\b(?:HD|SD|UK|National)\b/i.test(feed.name || '')) return true;
  }
  return false;
}

export function isEnglishOnlyFeed(channel, feed) {
  if (!feed || feed.languages?.length !== 1 || feed.languages[0] !== 'eng') return false;
  // Some upstream language records are overly broad; reject explicit non-English labels.
  return !/\b(?:Spanish|Portuguese|French|German|Hindi|Urdu|Arabic|Bangla|Punjabi|Tamil|Telugu|Korean|Latino|Latina|Bollywood|Telemundo|Univision|UniMas|espanol|Español|Francais|Français|Deportes|Esportes|Cine aventura|Cine Romantico|Crimenes|Tortues Ninja)\b/i.test(channel.name || '');
}
