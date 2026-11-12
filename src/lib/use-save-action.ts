import { useRef, useState } from 'react';
import { ApiError } from './api-error';

export function useSaveAction(onMissing?: () => Promise<unknown>) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  async function run(action: () => Promise<void>, message = '저장했어요') {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    setError('');
    setCode('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) await onMissing?.();
      setCode(cause instanceof ApiError ? cause.code : '');
      setError(
        cause instanceof ApiError && cause.status === 404
          ? '이미 삭제됐어요'
          : cause instanceof ApiError && cause.code === 'AI_409_0002'
            ? '이미 등록된 모델이에요'
            : cause instanceof ApiError && cause.code === 'AI_409_0001'
              ? '이미 등록된 AI 업체예요'
              : '저장하지 못했어요. 입력을 확인하고 다시 시도해 주세요',
      );
      return false;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return { pending, error, code, notice, run, setError, setCode, setNotice };
}

export function clearServerError(action: ReturnType<typeof useSaveAction>, codes: string[]) {
  if (!codes.includes(action.code)) return;
  action.setCode('');
  action.setError('');
}
