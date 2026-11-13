import { useId, type InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
  error?: string;
};

export function TextField({ label, description, error, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpIds = [description && `${inputId}-description`, error && `${inputId}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={helpIds || undefined}
      />
      {description && <p id={`${inputId}-description`}>{description}</p>}
      {error && (
        <p id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
