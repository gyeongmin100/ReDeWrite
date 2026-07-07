const MAX_ITEMS = 8;

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripUrls(value) {
  return asText(value)
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]*\)/gi, '$1')
    .replace(/\[\]\((?:https?:\/\/|www\.)[^)]*\)/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?\b/gi, '')
    .replace(/(?:출처|source)\s*[:：]?\s*/gi, '')
    .replace(/[\s([{]*[\[\]]+[\s)\]}]*/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.。])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function asTextArray(value, maxItems = MAX_ITEMS) {
  if (!Array.isArray(value)) return [];
  return value
    .map(stripUrls)
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeNewsItem(item) {
  const title = asText(item?.title);

  return {
    title: stripUrls(title),
    summary: stripUrls(item?.summary),
    date: asText(item?.date),
  };
}

export function normalizeResearchReport(report = {}) {
  const news = Array.isArray(report.news)
    ? report.news.map(normalizeNewsItem).filter(item => item.title).slice(0, 5)
    : [];
  const sources = [];

  return {
    company: asText(report.company),
    role: asText(report.role),
    summary: stripUrls(report.summary),
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
