import { useId, type InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
  error?: string;
};

export function TextField({ label, description, error, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const help = error ?? description;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={help ? `${inputId}-help` : undefined}
      />
      {help && (
        <p id={`${inputId}-help`} role={error ? 'alert' : undefined}>
          {help}
        </p>
      )}
    </div>
  );
}
