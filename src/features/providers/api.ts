import { session } from '../auth/session';
import { jsonBody } from '../../lib/format';

export const providerTypes = ['GEMINI', 'OPENAI', 'CLAUDE'] as const;
export type ProviderType = (typeof providerTypes)[number];
export type Model = {
  id: number;
  model: string;
  priority: number;
  rpdLimit: number | null;
  tpdLimit: number | null;
  isActive: boolean;
  updatedAt: string;
};
export type Provider = {
  id: number;
  type: ProviderType;
  isActive: boolean;
  isExecutable: boolean;
  modelCount: number;
  activeModelCount: number;
  updatedAt: string;
};
export type ProviderDetail = Provider & { baseUrl: string; createdAt: string; models: Model[] };
export type ModelSettings = { priority: number; rpdLimit: number | null; tpdLimit: number | null };
export const getProviders = (signal: AbortSignal) =>
  session.request<Provider[]>('/api/ai/providers?includesInactive=true', { signal });
export const getProvider = (id: string, signal: AbortSignal) =>
  session.request<ProviderDetail>(`/api/ai/providers/${encodeURIComponent(id)}`, { signal });
export const createProvider = (type: ProviderType, baseUrl: string) =>
  session.request<{ id: number }>('/api/ai/providers', {
    method: 'POST',
    ...jsonBody({ type, baseUrl }),
  });
export const updateProvider = (id: number, baseUrl: string) =>
  session.request(`/api/ai/providers/${id}`, { method: 'PUT', ...jsonBody({ baseUrl }) });
export const setProviderActive = (id: number, isActive: boolean) =>
  session.request(`/api/ai/providers/${id}/active`, { method: 'PUT', ...jsonBody({ isActive }) });
export const createModel = (providerId: number, model: string, settings: ModelSettings) =>
  session.request('/api/ai/models', {
    method: 'POST',
    ...jsonBody({ providerId, model, ...settings }),
  });
export const updateModel = (id: number, settings: ModelSettings) =>
  session.request(`/api/ai/models/${id}`, { method: 'PUT', ...jsonBody(settings) });
export const setModelActive = (id: number, isActive: boolean) =>
  session.request(`/api/ai/models/${id}/active`, { method: 'PUT', ...jsonBody({ isActive }) });
