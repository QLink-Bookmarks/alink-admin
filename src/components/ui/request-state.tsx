import { Button } from './button';
import { ApiError } from '../../lib/api-error';

export function RequestState({
  pending,
  error,
  onRetry,
}: {
  pending?: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  if (pending)
    return (
      <section className="state skeleton" role="status">
        <h2>불러오는 중이에요</h2>
        <div />
        <div />
      </section>
    );
  if (!error) return null;
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <section className="state" role="alert">
      <h2>{missing ? '이미 삭제됐어요' : '불러오지 못했어요'}</h2>
      <p>{missing ? '목록에서 다른 항목을 선택해 주세요' : '잠시 후 다시 시도해 주세요'}</p>
      <Button onClick={onRetry}>다시 시도</Button>
    </section>
  );
}

export function SaveStatus({
  pending,
  error,
  notice,
}: {
  pending?: boolean;
  error?: string;
  notice?: string;
}) {
  return (
    <>
      <p role="status" aria-live="polite">
        {pending ? '저장 중이에요…' : notice}
      </p>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
