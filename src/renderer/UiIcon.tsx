import { Fragment, type ReactNode } from 'react';

export type UiIconName =
  | 'arrow-right'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'circle'
  | 'close'
  | 'diamond'
  | 'lock'
  | 'menu'
  | 'moon'
  | 'more'
  | 'panel'
  | 'pause'
  | 'play'
  | 'settings'
  | 'sun'
  | 'unlock';

interface UiIconProps {
  name: UiIconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}

function getIconShape(name: UiIconName): ReactNode {
  switch (name) {
    case 'arrow-right':
      return <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>;
    case 'check':
      return <path d="m5 12.5 4.1 4.1L19 6.8" />;
    case 'chevron-down':
      return <path d="m6.5 9.5 5.5 5 5.5-5" />;
    case 'chevron-up':
      return <path d="m6.5 14.5 5.5-5 5.5 5" />;
    case 'circle':
      return <circle cx="12" cy="12" r="6.5" />;
    case 'close':
      return <><path d="M6.5 6.5 17.5 17.5" /><path d="m17.5 6.5-11 11" /></>;
    case 'diamond':
      return <><path d="m12 3 9 9-9 9-9-9 9-9Z" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></>;
    case 'lock':
      return <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" /><path d="M12 14.2v2.6" /></>;
    case 'unlock':
      return <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 6.6-1.6" /><path d="M12 14.2v2.6" /></>;
    case 'menu':
      return <><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="3" cy="7" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="17" r=".7" fill="currentColor" stroke="none" /></>;
    case 'moon':
      return <path d="M20.7 14.3A8.7 8.7 0 0 1 9.7 3.3 8.8 8.8 0 1 0 20.7 14.3Z" />;
    case 'more':
      return <><circle cx="5" cy="12" r="1.35" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.35" fill="currentColor" stroke="none" /></>;
    case 'panel':
      return <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8.5 4v16" /><path d="m12 9 2.5 3-2.5 3" /></>;
    case 'pause':
      return <><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" /></>;
    case 'play':
      return <path d="m8 5.4 11 6.6-11 6.6V5.4Z" fill="currentColor" stroke="none" />;
    case 'settings':
      return (
        <Fragment>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.1A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.66 3.8l.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1v-.1h4v.1A1.7 1.7 0 0 0 15 4.2a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1Z" />
        </Fragment>
      );
    case 'sun':
      return <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5" /></>;
    default:
      return null;
  }
}

export function UiIcon({ name, size = '1em', strokeWidth = 1.8, className = '' }: UiIconProps) {
  return (
    <svg
      className={`ui-icon ui-icon-${name}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {getIconShape(name)}
    </svg>
  );
}
