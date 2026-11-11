import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Table } from '../../components/ui/table';
import { TextField } from '../../components/ui/text-field';
import { RequestState, SaveStatus } from '../../components/ui/request-state';
import { formatDate } from '../../lib/format';
import { useSaveAction } from '../../lib/use-save-action';
import {
  createProvider,
  providerTypes,
  setModelActive,
  setProviderActive,
  updateProvider,
  type Model,
  type ProviderType,
} from './api';
import { useProvider, useProviders, useRefreshProviders } from './queries';
import { providerKeys } from './queries';
import { ApiError } from '../../lib/api-error';
import { officialHosts, validBaseUrl } from './validation';
import { ModelForm } from './model-form';

export function ProvidersPage() {
  const { id } = useParams();
  const query = useProviders();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const available = providerTypes.filter(
    (type) => !query.data?.some((provider) => provider.type === type),
  );
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>제공자 및 모델</h1>
          <p>AI 제공자 설정과 모델을 관리해요</p>
        </div>
        {query.data && available.length > 0 && (
          <Button onClick={() => setAdding(true)}>제공자 추가</Button>
        )}
      </div>
      <RequestState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {query.data?.length === 0 && (
        <section className="state" role="status">
          <h2>등록된 제공자가 없어요</h2>
          <p>제공자를 추가해 시작해 주세요</p>
        </section>
      )}
      {query.data?.map((provider) => (
        <section className="provider card" key={provider.id}>
          <div className="provider-head">
            <div className="grow">
              <div className="row">
                <h2>
                  <Link
                    to={id === String(provider.id) ? '/providers' : `/providers/${provider.id}`}
                    aria-expanded={id === String(provider.id)}
                  >
                    {provider.type}
                  </Link>
                </h2>
                <Badge active={provider.isActive} />
              </div>
              <p>
                활성 모델 {provider.activeModelCount}개 / 전체 {provider.modelCount}개{' '}
                <span className="separator">·</span> 수정 {formatDate(provider.updatedAt)}
              </p>
              {!provider.isExecutable && <p>실행 어댑터 없음</p>}
            </div>
            <Link
              className="button"
              to={id === String(provider.id) ? '/providers' : `/providers/${provider.id}`}
            >
              {id === String(provider.id) ? '접기' : '상세 보기'}
            </Link>
          </div>
          {id === String(provider.id) && <ProviderPanel id={id} />}
        </section>
      ))}
      {id && query.data && !query.data.some((provider) => String(provider.id) === id) && (
        <section className="state" role="alert">
          <h2>이미 삭제됐어요</h2>
          <Link to="/providers">목록으로</Link>
        </section>
      )}
      <Dialog open={adding} title="제공자 추가" onClose={() => setAdding(false)}>
        {adding && available[0] && (
          <ProviderCreate
            available={available}
            onSaved={async (newId) => {
              await query.refetch();
              setAdding(false);
              void navigate(`/providers/${newId}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function ProviderCreate({
  available,
  onSaved,
}: {
  available: ProviderType[];
  onSaved: (id: number) => Promise<void>;
}) {
  const [type, setType] = useState(available[0]!);
  const [url, setUrl] = useState(`https://${officialHosts[type]}`);
  const [invalid, setInvalid] = useState(false);
  const action = useSaveAction();
  return (
    <form
      noValidate
      aria-busy={action.pending}
      onSubmit={(event) => {
        event.preventDefault();
        setInvalid(!validBaseUrl(type, url));
        if (!validBaseUrl(type, url)) return;
        void action.run(async () => {
          const result = await createProvider(type, url);
          await onSaved(result.id);
        });
      }}
    >
      <div className="field">
        <label htmlFor="provider-type">업체</label>
        <select
          id="provider-type"
          value={type}
          aria-disabled={action.pending}
          onChange={(event) => {
            if (action.pending) return;
            const value = event.target.value as ProviderType;
            setType(value);
            setUrl(`https://${officialHosts[value]}`);
          }}
        >
          {available.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <TextField
        label="기본 URL"
        value={url}
        readOnly={action.pending}
        error={
          invalid || action.code === 'AI_400_0004'
            ? '업체의 공식 API 주소만 쓸 수 있어요'
            : undefined
        }
        onChange={(event) => setUrl(event.target.value)}
      />
      <p className="note">새 제공자는 비활성으로 추가돼요</p>
      <SaveStatus {...action} />
      <Button type="submit" aria-disabled={action.pending}>
        {action.pending ? '저장 중…' : '추가'}
      </Button>
    </form>
  );
}

function ProviderPanel({ id }: { id: string }) {
  const query = useProvider(id);
  const refresh = useRefreshProviders();
  const client = useQueryClient();
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404)
      void client.invalidateQueries({ queryKey: providerKeys.list });
  }, [query.error, client]);
  const provider = query.data;
  const [draftUrl, setUrl] = useState<string | null>(null);
  const url = draftUrl ?? provider?.baseUrl ?? '';
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState<Model | 'new' | null>(null);
  const [confirm, setConfirm] = useState<Model | 'provider' | null>(null);
  const action = useSaveAction(refresh);
  const handleSaved = async () => {
    await refresh();
    setEditing(null);
    action.setNotice('저장했어요');
  };
  const models = [...(provider?.models ?? [])].sort(
    (a, b) => a.priority - b.priority || a.id - b.id,
  );
  const active = confirm === 'provider' ? provider?.isActive : confirm?.isActive;
  return (
    <div className="provider-body">
      <RequestState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {provider && (
        <>
          {!provider.isActive && (
            <p className="note">
              이 제공자의 모든 모델은 사용자에게 숨겨져요. 신규 선택·실행에서 제외되며 기존 연결과
              이력은 보존돼요.
            </p>
          )}
          <form
            noValidate
            aria-busy={action.pending}
            onSubmit={(event) => {
              event.preventDefault();
              setInvalid(!validBaseUrl(provider.type, url));
              if (!validBaseUrl(provider.type, url)) return;
              void action.run(async () => {
                await updateProvider(provider.id, url);
                await refresh();
                setUrl(null);
              });
            }}
          >
            <div className="url-row">
              <TextField
                label="기본 URL"
                value={url}
                description={`공식 호스트: ${officialHosts[provider.type]}`}
                error={
                  invalid || action.code === 'AI_400_0004'
                    ? '업체의 공식 API 주소만 쓸 수 있어요'
                    : undefined
                }
                readOnly={action.pending}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button type="submit" aria-disabled={action.pending}>
                {action.pending ? '저장 중…' : '주소 저장'}
              </Button>
            </div>
          </form>
          <div className="row">
            <Button
              aria-disabled={!provider.isActive && !provider.isExecutable}
              aria-describedby={!provider.isExecutable ? 'adapter-reason' : undefined}
              onClick={() => {
                if (!provider.isActive && !provider.isExecutable) return;
                setConfirm('provider');
              }}
            >
              {provider.isActive ? '제공자 비활성화' : '제공자 활성화'}
            </Button>
            {!provider.isExecutable && (
              <p id="adapter-reason">실행 어댑터가 없는 업체는 활성화할 수 없어요</p>
            )}
          </div>
          <SaveStatus {...action} />
          <div className="page-head">
            <h3>
              모델 <span className="muted">{models.length}</span>
            </h3>
            <Button onClick={() => setEditing('new')}>모델 추가</Button>
          </div>
          {models.length === 0 ? (
            <div className="state" role="status">
              <h2>등록된 모델이 없어요</h2>
            </div>
          ) : (
            <>
              <div className="wide-models">
                <Table caption="모델 설정">
                  <thead>
                    <tr>
                      {[
                        '모델 식별자',
                        '우선순위',
                        '일일 요청 제한',
                        '일일 토큰 제한',
                        '상태',
                        '관리',
                      ].map((value) => (
                        <th key={value} scope="col">
                          {value}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.id} data-inactive={!model.isActive}>
                        <th scope="row">
                          <span className="truncate model-name" title={model.model}>
                            {model.model}
                          </span>
                        </th>
                        <td>{model.priority}</td>
                        <td>{model.rpdLimit ?? '제한 없음'}</td>
                        <td>{model.tpdLimit ?? '제한 없음'}</td>
                        <td>
                          <Badge active={model.isActive} />
                        </td>
                        <td>
                          <ModelActions
                            model={model}
                            onEdit={() => setEditing(model)}
                            onState={() => setConfirm(model)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="model-cards">
                {models.map((model) => (
                  <article key={model.id} className="model-card" data-inactive={!model.isActive}>
                    <div className="row">
                      <strong className="truncate grow" title={model.model}>
                        {model.model}
                      </strong>
                      <Badge active={model.isActive} />
                    </div>
                    <dl>
                      <dt>우선순위</dt>
                      <dd>{model.priority}</dd>
                      <dt>일일 요청 제한</dt>
                      <dd>{model.rpdLimit ?? '제한 없음'}</dd>
                      <dt>일일 토큰 제한</dt>
                      <dd>{model.tpdLimit ?? '제한 없음'}</dd>
                    </dl>
                    <ModelActions
                      model={model}
                      onEdit={() => setEditing(model)}
                      onState={() => setConfirm(model)}
                    />
                  </article>
                ))}
              </div>
            </>
          )}
          <Dialog
            open={editing !== null}
            title={editing === 'new' ? '모델 추가' : '모델 수정'}
            onClose={() => setEditing(null)}
          >
            {editing && (
              <ModelForm
                key={editing === 'new' ? 'new' : editing.id}
                provider={provider}
                model={editing === 'new' ? undefined : editing}
                onSaved={handleSaved}
              />
            )}
          </Dialog>
          <Dialog
            open={confirm !== null}
            title={`${confirm === 'provider' ? '제공자' : '모델'} ${active ? '비활성화' : '활성화'}`}
            initialFocus="cancel"
            onClose={() => {
              if (!action.pending) setConfirm(null);
            }}
          >
            <p>
              {confirm === 'provider'
                ? `활성 모델 ${models.filter((model) => model.isActive).length}개가 ${active ? '사용자에게 숨겨져요' : '다시 표시돼요'}`
                : `이 모델을 ${active ? '사용자 선택·실행에서 제외할까요' : '다시 활성화할까요'}?`}
            </p>
            <p>기존 연결과 이력은 보존돼요</p>
            <SaveStatus {...action} />
            <Button
              aria-disabled={action.pending}
              onClick={() => {
                if (!confirm) return;
                void action.run(async () => {
                  if (confirm === 'provider')
                    await setProviderActive(provider.id, !provider.isActive);
                  else await setModelActive(confirm.id, !confirm.isActive);
                  await refresh();
                  setConfirm(null);
                });
              }}
            >
              {action.pending ? '저장 중…' : '확인'}
            </Button>
          </Dialog>
        </>
      )}
    </div>
  );
}

function ModelActions({
  model,
  onEdit,
  onState,
}: {
  model: Model;
  onEdit: () => void;
  onState: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const handleAction = (action: () => void) => {
    if (ref.current) {
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus();
    }
    action();
  };
  return (
    <details
      className="row-menu"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (ref.current) ref.current.open = false;
          ref.current?.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={`${model.model} 행 메뉴`}>⋯</summary>
      <div className="menu-panel">
        <Button onClick={() => handleAction(onEdit)}>수정</Button>
        <Button onClick={() => handleAction(onState)}>
          {model.isActive ? '비활성화' : '활성화'}
        </Button>
      </div>
    </details>
  );
}
