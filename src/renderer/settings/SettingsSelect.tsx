import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

type SettingsSelectMenuStyle = CSSProperties & {
  '--settings-select-width'?: string;
};

export function SettingsSelect<T extends string | number>({
  ariaLabel,
  value,
  options,
  onChange
}: SettingsSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<SettingsSelectMenuStyle>({});
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex] ?? options[0] ?? null;
  const settingsRoot = buttonRef.current?.closest('.settings-page');
  const portalThemeClassName = settingsRoot
    ? Array.from(settingsRoot.classList)
      .filter((className) => className === 'theme-dark-fantasy' || className.startsWith('fx-'))
      .join(' ')
    : '';

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updateMenuPosition = () => {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      const margin = 12;
      const gap = 8;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(rect.width, viewportWidth - margin * 2);
      const left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const preferredHeight = Math.min(280, Math.max(46, options.length * 46 + 12));
      const openAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const availableHeight = Math.max(46, (openAbove ? spaceAbove : spaceBelow) - gap);
      const maxHeight = Math.min(preferredHeight, availableHeight);
      const verticalPosition = openAbove
        ? { bottom: viewportHeight - rect.top + gap }
        : { top: Math.min(rect.bottom + gap, viewportHeight - margin - 80) };

      setMenuStyle({
        left,
        maxHeight,
        width,
        '--settings-select-width': `${width}px`,
        ...verticalPosition
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, options.length]);

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
        ref={buttonRef}
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

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className={`settings-select-layer settings-page ${portalThemeClassName}`}
            style={menuStyle}
          >
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
          </div>,
          document.body
        )}
    </div>
  );
}
