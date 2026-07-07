const DEFAULT_PIPELINE = ['active', 'pending', 'pending'];
const FAILED_RESEARCH_MESSAGE = '분석에 실패했습니다. 다시 시도해 주세요.';

const isValidPipeline = pipeline =>
  Array.isArray(pipeline) && pipeline.length === 3 && pipeline.every(Boolean);

export const deriveInitialResearchFields = query => {
  const normalized = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
  if (!normalized) return { name: '', role: '' };

  const [name, ...roleParts] = normalized.split(' ');
  return {
    name,
    role: roleParts.join(' '),
  };
};

export const buildCollectingResearchReportMarker = ({
  query,
  requestedAt,
  lastError,
} = {}) => {
  const marker = {
    status: 'collecting',
    query: typeof query === 'string' ? query.trim() : '',
    requestedAt: requestedAt || new Date().toISOString(),
  };

  if (lastError) marker.lastError = String(lastError).slice(0, 500);

  return marker;
};

export const normalizeResearchRecord = record => {
  const storedReport = record.research_report ?? null;
  const isCollecting = storedReport?.status === 'collecting';
  const researchReport = isCollecting ? null : storedReport;
  const pipeline = isValidPipeline(record.pipeline) ? record.pipeline : DEFAULT_PIPELINE;
  const completedSteps = Number.isInteger(record.completed_steps) ? record.completed_steps : 1;
  const hasReport = Boolean(researchReport);

  return {
    companyId: record.company_id,
    name: record.name || '기업',
    role: record.role || '',
    pipeline,
    completedSteps,
    researchReport,
    readResult: record.read_result || null,
    bestFit: record.best_fit || null,
    essay: record.essay || null,
    status: isCollecting ? 'collecting' : hasReport ? 'ready' : 'failed',
    query: isCollecting ? storedReport.query || record.name || '' : undefined,
    errorMessage: isCollecting || hasReport ? null : FAILED_RESEARCH_MESSAGE,
  };
};

export const buildResearchInsertPayload = (research, userId) => ({
  user_id: userId,
  company_id: research.companyId,
  name: research.name,
  role: research.role || '',
  pipeline: isValidPipeline(research.pipeline) ? research.pipeline : DEFAULT_PIPELINE,
  completed_steps: Number.isInteger(research.completedSteps) ? research.completedSteps : 1,
  research_report: research.status === 'collecting'
    ? buildCollectingResearchReportMarker({
        query: research.query || research.name || '',
        requestedAt: research.createdAt,
      })
    : research.researchReport || null,
});

export const buildResearchPatchPayload = patch => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'name')) payload.name = patch.name;
  if (Object.prototype.hasOwnProperty.call(patch, 'role')) payload.role = patch.role || '';
  if (Object.prototype.hasOwnProperty.call(patch, 'pipeline')) payload.pipeline = patch.pipeline;
  if (Object.prototype.hasOwnProperty.call(patch, 'completedSteps')) {
    payload.completed_steps = patch.completedSteps;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'researchReport')) {
    payload.research_report = patch.researchReport || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'readResult')) {
    payload.read_result = patch.readResult || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'bestFit')) {
    payload.best_fit = patch.bestFit || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'essay')) payload.essay = patch.essay || null;

  return payload;
};
