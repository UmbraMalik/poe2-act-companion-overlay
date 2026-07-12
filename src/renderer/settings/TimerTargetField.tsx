interface TimerTargetFieldProps {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

export function TimerTargetField({
  label,
  hint,
  placeholder,
  value,
  invalid,
  onChange
}: TimerTargetFieldProps) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
      <small>{hint}</small>
    </label>
  );
}
