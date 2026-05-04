const MAX_ITEMS = 8;

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asTextArray(value, maxItems = MAX_ITEMS) {
  if (!Array.isArray(value)) return [];
  return value
    .map(asText)
    .filter(Boolean)
    .slice(0, maxItems);
}

function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeNewsItem(item) {
  const title = asText(item?.title);
  const url = asText(item?.url);

  return {
    title,
    summary: asText(item?.summary),
    date: asText(item?.date),
    url: isHttpUrl(url) ? url : '',
    source: asText(item?.source),
  };
}

function normalizeSource(item) {
  const url = asText(item?.url);

  return {
    title: asText(item?.title),
    url: isHttpUrl(url) ? url : '',
  };
}

export function normalizeResearchReport(report = {}) {
  const news = Array.isArray(report.news)
    ? report.news.map(normalizeNewsItem).filter(item => item.title).slice(0, 5)
    : [];
  const sources = Array.isArray(report.sources)
    ? report.sources.map(normalizeSource).filter(item => item.url).slice(0, 8)
    : [];

  return {
    company: asText(report.company),
    role: asText(report.role),
    summary: asText(report.summary),
    traits: asTextArray(report.traits),
    jdKeywords: asTextArray(report.jdKeywords),
    businessInsights: asTextArray(report.businessInsights),
    roleFitAnalysis: asTextArray(report.roleFitAnalysis),
    hiringSignals: asTextArray(report.hiringSignals),
    risks: asTextArray(report.risks),
    news,
    culture: asTextArray(report.culture),
    sources,
    updateHistory: Array.isArray(report.updateHistory) ? report.updateHistory : [],
  };
}

export function getNewsTargetUrl(newsItem) {
  const url = asText(newsItem?.url);
  return isHttpUrl(url) ? url : null;
}
