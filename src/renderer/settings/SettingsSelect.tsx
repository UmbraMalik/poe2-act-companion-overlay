import { useState, type KeyboardEvent, type ReactNode } from 'react';

export interface SettingsSelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

interface SettingsSelectProps<T extends string | number> {
  ariaLabel: string;
  value: T;
  options: Array<SettingsSelectOption<T>>;
  onChange: (value: T) => void;
}

export function SettingsSelect<T extends string | number>({
  ariaLabel,
  value,
  options,
  onChange
}: SettingsSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex] ?? options[0] ?? null;

  const chooseValue = (nextValue: T) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const moveSelection = (direction: 1 | -1) => {
    if (options.length === 0) {
      return;
    }

    const nextIndex = (selectedIndex + direction + options.length) % options.length;
    chooseValue(options[nextIndex].value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (isOpen) {
          moveSelection(1);
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          moveSelection(-1);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen((current) => !current);
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`settings-select${isOpen ? ' is-open' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="settings-select-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="settings-select-value">{selectedOption?.label ?? '—'}</span>
        <span className="settings-select-chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="settings-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              className={`settings-select-option${option.value === value ? ' is-selected' : ''}`}
              role="option"
              aria-selected={option.value === value}
              key={String(option.value)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseValue(option.value)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
