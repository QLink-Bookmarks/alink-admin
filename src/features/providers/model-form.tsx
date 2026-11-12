import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { SaveStatus } from '../../components/ui/request-state';
import { clearServerError, useSaveAction } from '../../lib/use-save-action';
import { focusFirstInvalid } from '../../lib/focus';
import { createModel, updateModel, type Model, type ProviderDetail } from './api';
import { positiveInteger, validModelName } from './validation';
import { useRefreshProviders } from './queries';

type Field = 'name' | 'priority' | 'rpd' | 'tpd';
const serverCodes: Record<Field, string[]> = {
  name: ['AI_409_0002', 'AI_400_0005', 'AI_400_0006', 'AI_400_0007'],
  priority: ['AI_400_0008'],
  rpd: ['AI_400_0009'],
  tpd: ['AI_400_0009'],
};

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
  const [checked, setChecked] = useState(false);
  const refresh = useRefreshProviders();
  const action = useSaveAction(refresh);
  const form = useRef<HTMLFormElement>(null);
  const invalid: Record<Field, string | undefined> = {
    name:
      !model && !validModelName(name)
        ? '모델 식별자는 영문, 숫자, 점, 밑줄, 하이픈으로 1~100자 입력해 주세요'
        : undefined,
    priority: positiveInteger(priority) ? undefined : '1 이상의 정수를 입력해 주세요',
    rpd: rpd && !positiveInteger(rpd) ? '1 이상의 정수를 입력해 주세요' : undefined,
    tpd: tpd && !positiveInteger(tpd) ? '1 이상의 정수를 입력해 주세요' : undefined,
  };
  const errors: Partial<Record<Field, string>> = checked ? invalid : {};
  const fieldProps = (field: Field, value: string, setValue: (value: string) => void) => ({
    value,
    readOnly: action.pending,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      clearServerError(action, serverCodes[field]);
    },
  });
  return (
    <form
      ref={form}
      aria-busy={action.pending}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setChecked(true);
        if (Object.values(invalid).some(Boolean)) {
          focusFirstInvalid(form.current);
          return;
        }
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
          {...fieldProps('name', name, setName)}
          error={
            errors.name ??
            (action.code === 'AI_409_0002'
              ? '이미 등록된 모델이에요'
              : ['AI_400_0005', 'AI_400_0006', 'AI_400_0007'].includes(action.code)
                ? '모델 식별자를 확인해 주세요'
                : undefined)
          }
        />
      )}
      <TextField
        label="우선순위"
        inputMode="numeric"
        {...fieldProps('priority', priority, setPriority)}
        description="작은 숫자가 먼저 표시돼요. 같은 우선순위는 모델 번호가 작은 순서예요."
        error={
          errors.priority ??
          (action.code === 'AI_400_0008' ? '1 이상의 정수를 입력해 주세요' : undefined)
        }
      />
      <TextField
        label="일일 요청 제한"
        inputMode="numeric"
        {...fieldProps('rpd', rpd, setRpd)}
        description="비우면 제한 없음"
        error={
          errors.rpd ?? (action.code === 'AI_400_0009' ? '일일 제한을 확인해 주세요' : undefined)
        }
      />
      <TextField
        label="일일 토큰 제한"
        inputMode="numeric"
        {...fieldProps('tpd', tpd, setTpd)}
        description="비우면 제한 없음"
        error={
          errors.tpd ?? (action.code === 'AI_400_0009' ? '일일 제한을 확인해 주세요' : undefined)
        }
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
