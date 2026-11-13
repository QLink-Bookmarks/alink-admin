import type { Model, ProviderDetail } from '../../src/features/providers/api';
import type { Post } from '../../src/features/announcements/api';
import type { ServerId } from '../../src/lib/server';

const timestamp = '2026-11-11T09:00:00Z';
export function createFixture() {
  const models: Model[] = [1, 2, 3, 4].map((id) => ({
    id,
    model: id === 1 ? 'gemini-2.5-flash' : id === 4 ? 'a'.repeat(100) : `gemini-model-${id}`,
    priority: id === 2 ? 1 : id,
    rpdLimit: id === 1 ? 1500 : null,
    tpdLimit: null,
    isActive: id !== 4,
    updatedAt: timestamp,
  }));
  const providers: ProviderDetail[] = [
    {
      id: 1,
      type: 'GEMINI',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      isActive: true,
      isExecutable: true,
      modelCount: 4,
      activeModelCount: 3,
      models,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 2,
      type: 'OPENAI',
      baseUrl: 'https://api.openai.com/v1',
      isActive: true,
      isExecutable: true,
      modelCount: 0,
      activeModelCount: 0,
      models: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 3,
      type: 'CLAUDE',
      baseUrl: 'https://api.anthropic.com',
      isActive: false,
      isExecutable: false,
      modelCount: 0,
      activeModelCount: 0,
      models: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const posts: Post[] = [false, true].flatMap((feedback) =>
    Array.from({ length: 17 }, (_, index) => ({
      id: feedback ? 100 + index : 20 + index,
      title: `${feedback ? '피드백' : '공지'} ${17 - index}`,
      contents: feedback
        ? '사용자 의견\n두 번째 줄'
        : '첫 번째 줄\n두 번째 줄\n[btn:ALink 열기|https://example.com]\n[link:도움말|https://example.com/help]\n[img:https://fixture.test/broken.png]',
      author: feedback ? '테스터' : '운영자',
      authorId: feedback ? 10 : 1,
      type: feedback ? ('FEEDBACK' as const) : ('ANNOUNCEMENT' as const),
      imageUrls: feedback && index === 0 ? ['https://fixture.test/attachment.png'] : [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  return {
    providers,
    posts,
    sessions: { dev: true, prod: true } as Record<ServerId, boolean>,
    role: 'ADMIN',
    nickname: '김관리',
    deny: false,
    fail: '' as string,
    failStatus: 500,
    failCode: '',
    delay: 0,
    slowQuery: '',
    signForbidden: false,
    offline: [] as ServerId[],
    hang: '',
    expireOnData: false,
    requests: [] as {
      server: ServerId;
      origin: string;
      method: string;
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }[],
  };
}
export const fixtureServer = (url: URL): ServerId =>
  url.hostname === 'api.archivelink.app' ? 'prod' : 'dev';
export type Fixture = ReturnType<typeof createFixture>;
export type FixtureResponse = { status: number; data?: unknown; code?: string; abort?: boolean };
export async function handleFixture(
  state: Fixture,
  method: string,
  input: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<FixtureResponse> {
  const url = new URL(input, 'http://localhost');
  const path = url.pathname;
  const server = fixtureServer(url);
  state.requests.push({
    server,
    origin: url.origin,
    method,
    path: `${path}${url.search}`,
    body,
    headers,
  });
  if (state.offline.includes(server)) return { status: 0, abort: true };
  if (state.hang && `${method} ${path}` === state.hang) return new Promise(() => {});
  if (method === 'GET' && state.slowQuery && url.searchParams.get('query') === state.slowQuery)
    await new Promise((resolve) => setTimeout(resolve, 700));
  const ok = (data: unknown = null): FixtureResponse => ({ status: 200, data });
  const fail = (status: number, code: string): FixtureResponse => ({ status, code });
  if (state.delay && method !== 'GET')
    await new Promise((resolve) => setTimeout(resolve, state.delay));
  if (state.fail && `${method} ${path}` === state.fail)
    return state.failStatus === 0
      ? { status: 0, abort: true }
      : fail(state.failStatus, state.failCode);
  if (path.endsWith('/signout')) {
    state.sessions[server] = false;
    return ok();
  }
  if (path.endsWith('/sign')) {
    if (state.signForbidden) return fail(403, 'AUTH_403_0002');
    state.sessions[server] = true;
    return ok({ accessToken: `fixture-access-${server}` });
  }
  if (path.endsWith('/token/refresh'))
    return state.deny
      ? fail(403, 'AUTH_403_0002')
      : state.sessions[server]
        ? ok({ accessToken: `fixture-access-${server}` })
        : fail(401, 'AUTH_401_0001');
  if (headers.authorization && headers.authorization !== `Bearer fixture-access-${server}`)
    return fail(401, 'AUTH_401_0001');
  if (state.expireOnData && path !== '/api/users/me') {
    state.expireOnData = false;
    state.sessions[server] = false;
    return fail(401, 'AUTH_401_0001');
  }
  if (
    state.deny &&
    (path.includes('/ai/') ||
      path === '/api/users/me' ||
      method !== 'GET' ||
      url.searchParams.get('type') === 'FEEDBACK')
  )
    return fail(403, 'AI_403_0002');
  if (path === '/api/users/me') return ok({ nickname: state.nickname, role: state.role });
  if (path === '/api/ai/providers' && method === 'GET')
    return ok(
      state.providers.map((provider) => ({
        ...provider,
        modelCount: provider.models.length,
        activeModelCount: provider.models.filter((model) => model.isActive).length,
      })),
    );
  if (path === '/api/ai/providers' && method === 'POST') {
    if (state.providers.some((provider) => provider.type === body.type))
      return fail(409, 'AI_409_0001');
    const id = 50;
    state.providers.push({
      id,
      type: body.type as ProviderDetail['type'],
      baseUrl: String(body.baseUrl).replace(/\/+$/, ''),
      isActive: false,
      isExecutable: body.type !== 'CLAUDE',
      models: [],
      modelCount: 0,
      activeModelCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return ok({ id });
  }
  if (path.startsWith('/api/ai/providers/')) {
    const provider = state.providers.find((item) => item.id === Number(path.split('/')[4]));
    if (!provider) return fail(404, 'AI_404_0005');
    if (method === 'PUT') {
      if (path.endsWith('/active')) {
        if (body.isActive && !provider.isExecutable) return fail(422, 'AI_422_0003');
        provider.isActive = Boolean(body.isActive);
      } else provider.baseUrl = String(body.baseUrl).replace(/\/+$/, '');
      provider.updatedAt = '2026-11-12T10:30:00Z';
    }
    return ok(provider);
  }
  if (path === '/api/ai/models' && method === 'POST') {
    const provider = state.providers.find((item) => item.id === body.providerId)!;
    if (provider.models.some((model) => model.model === body.model))
      return fail(409, 'AI_409_0002');
    provider.models.push({
      id: 50,
      model: String(body.model),
      priority: Number(body.priority),
      rpdLimit: body.rpdLimit as number | null,
      tpdLimit: body.tpdLimit as number | null,
      isActive: true,
      updatedAt: timestamp,
    });
    return ok({ id: 50 });
  }
  if (path.startsWith('/api/ai/models/')) {
    const model = state.providers
      .flatMap((provider) => provider.models)
      .find((item) => item.id === Number(path.split('/')[4]));
    if (!model) return fail(404, 'AI_404_0007');
    if (path.endsWith('/active')) model.isActive = Boolean(body.isActive);
    else {
      model.priority = Number(body.priority);
      model.rpdLimit = body.rpdLimit as number | null;
      model.tpdLimit = body.tpdLimit as number | null;
    }
    return ok(model);
  }
  if (path === '/api/images') return ok({ url: 'https://fixture.test/uploaded.png' });
  if (path === '/api/posts' && method === 'GET') {
    const items = state.posts.filter(
      (post) =>
        post.type === url.searchParams.get('type') &&
        post.title.includes(url.searchParams.get('query') ?? ''),
    );
    const offset = Number(url.searchParams.get('cursor') ?? 0);
    const contents = items.slice(offset, offset + 15);
    const hasNext = offset + 15 < items.length;
    return ok({ contents, hasNext, nextCursor: hasNext ? String(offset + 15) : null });
  }
  if (path === '/api/posts' && method === 'POST') {
    const id = 500;
    state.posts.unshift({
      id,
      title: String(body.title),
      contents: String(body.contents),
      author: '운영자',
      authorId: 1,
      type: 'ANNOUNCEMENT',
      imageUrls: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return ok({ id });
  }
  if (path.startsWith('/api/posts/')) {
    const post = state.posts.find((item) => item.id === Number(path.split('/')[3]));
    if (!post) return fail(404, 'POST_404_0002');
    if (state.deny && post.type === 'FEEDBACK') return fail(403, 'POST_403_0002');
    if (method === 'DELETE') {
      state.posts.splice(state.posts.indexOf(post), 1);
      return ok();
    }
    if (method === 'PUT') {
      post.title = String(body.title);
      post.contents = String(body.contents);
    }
    return ok(post);
  }
  return fail(404, 'COMMON_404_0001');
}
export const gisStub = `window.google={accounts:{id:{initialize(options){(window.fixtureClientIds??=[]).push(options.client_id);window.fixtureCredential=()=>options.callback({credential:'fixture-google-id'});},renderButton(element){element.replaceChildren();const button=document.createElement('button');button.textContent='Google로 로그인';button.onclick=()=>window.fixtureCredential();element.append(button);}}}};`;
