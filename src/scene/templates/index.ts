import { buildChurch } from './church';
import { buildGeneric } from './generic';
import { buildPagoda } from './pagoda';
import type { TemplateInput, TemplateResult } from './types';

export type TemplateId = 'church' | 'pagoda' | 'generic';

/** Chọn mẫu công trình theo loại địa điểm. */
export function pickTemplate(kind: string, isWorship: boolean): TemplateId {
  if (kind === 'Nhà thờ') return 'church';
  if (['Chùa', 'Đình', 'Đền', 'Miếu / Phủ'].includes(kind)) return 'pagoda';
  // Nơi thờ tự không rõ loại: ở Việt Nam đa số là chùa, đình, đền.
  if (isWorship) return 'pagoda';
  return 'generic';
}

export function buildTemplate(id: TemplateId, input: TemplateInput): TemplateResult {
  if (id === 'church') return buildChurch(input);
  if (id === 'pagoda') return buildPagoda(input);
  return buildGeneric(input);
}

export type { TemplateInput, TemplateResult };
