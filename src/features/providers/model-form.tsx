import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { SaveStatus } from '../../components/ui/request-state';
import { useSaveAction } from '../../lib/use-save-action';
import { createModel, updateModel, type Model, type ProviderDetail } from './api';
import { positiveInteger, validModelName } from './validation';
import { useRefreshProviders } from './queries';

export function ModelForm({
  provider,
  model,
  onSaved,
}: {
  provider: ProviderDetail;
  model?: Model;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(String(model?.priority ?? 1));
  const [rpd, setRpd] = useState(model?.rpdLimit?.toString() ?? '');
  const [tpd, setTpd] = useState(model?.tpdLimit?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refresh = useRefreshProviders();
  const action = useSaveAction(refresh);
  return (
    <form
      aria-busy={action.pending}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (!model && !validModelName(name))
          next.name = '모델 식별자는 영문, 숫자, 점, 밑줄, 하이픈으로 1~100자 입력해 주세요';
        if (!positiveInteger(priority)) next.priority = '1 이상의 정수를 입력해 주세요';
        if (rpd && !positiveInteger(rpd)) next.rpd = '1 이상의 정수를 입력해 주세요';
        if (tpd && !positiveInteger(tpd)) next.tpd = '1 이상의 정수를 입력해 주세요';
        setErrors(next);
        if (Object.keys(next).length) return;
        void action.run(async () => {
          const settings = {
            priority: Number(priority),
            rpdLimit: rpd ? Number(rpd) : null,
            tpdLimit: tpd ? Number(tpd) : null,
          };
          if (model) await updateModel(model.id, settings);
          else await createModel(provider.id, name, settings);
          await onSaved();
        });
      }}
    >
      {model ? (
        <div className="note">
          <p>모델 식별자: {model.model}</p>
          <p>
            소속: {provider.type} · 제공자 번호 {provider.id}
          </p>
          <p>모델 번호: {model.id}</p>
          <p>모델명을 바꾸려면 새 모델을 추가해 주세요</p>
        </div>
      ) : (
        <TextField
          label="모델 식별자"
          value={name}
          readOnly={action.pending}
          error={
            errors.name ??
            (action.code === 'AI_409_0002'
              ? '이미 등록된 모델이에요'
              : ['AI_400_0005', 'AI_400_0006', 'AI_400_0007'].includes(action.code)
                ? '모델 식별자를 확인해 주세요'
                : undefined)
          }
          onChange={(event) => setName(event.target.value)}
        />
      )}
      <TextField
        label="우선순위"
        inputMode="numeric"
        value={priority}
        description="작은 숫자가 먼저 표시돼요. 같은 우선순위는 모델 번호가 작은 순서예요."
        readOnly={action.pending}
        error={
          errors.priority ??
          (action.code === 'AI_400_0008' ? '1 이상의 정수를 입력해 주세요' : undefined)
        }
        onChange={(event) => setPriority(event.target.value)}
      />
      <TextField
        label="일일 요청 제한"
        inputMode="numeric"
        value={rpd}
        description="비우면 제한 없음"
        readOnly={action.pending}
        error={
          errors.rpd ?? (action.code === 'AI_400_0009' ? '일일 제한을 확인해 주세요' : undefined)
        }
        onChange={(event) => setRpd(event.target.value)}
      />
      <TextField
        label="일일 토큰 제한"
        inputMode="numeric"
        value={tpd}
        description="비우면 제한 없음"
        readOnly={action.pending}
        error={
          errors.tpd ?? (action.code === 'AI_400_0009' ? '일일 제한을 확인해 주세요' : undefined)
        }
        onChange={(event) => setTpd(event.target.value)}
      />
      <SaveStatus {...action} />
      <div className="actions">
        <Button type="submit" aria-disabled={action.pending}>
          {action.pending ? '저장 중…' : model ? '저장' : '추가'}
        </Button>
      </div>
    </form>
  );
}
