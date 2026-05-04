const MONTHLY_RESEARCH_UPDATE_LIMIT = 10;

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function countMonthlyResearchUpdates(researches = [], now = new Date()) {
  const monthKey = getMonthKey(now);

  return researches.reduce((count, research) => {
    const history = research?.researchReport?.updateHistory;
    if (!Array.isArray(history)) return count;

    return count + history.filter(timestamp => String(timestamp).startsWith(monthKey)).length;
  }, 0);
}

export function canUseResearchUpdate(researches = [], now = new Date()) {
  return countMonthlyResearchUpdates(researches, now) < MONTHLY_RESEARCH_UPDATE_LIMIT;
}

export function getRemainingResearchUpdates(researches = [], now = new Date()) {
  return Math.max(0, MONTHLY_RESEARCH_UPDATE_LIMIT - countMonthlyResearchUpdates(researches, now));
}

export function appendResearchUpdateHistory(report = {}, timestamp = new Date().toISOString()) {
  const updateHistory = Array.isArray(report.updateHistory) ? report.updateHistory : [];
  return {
    ...report,
    updateHistory: [...updateHistory, timestamp],
  };
}
