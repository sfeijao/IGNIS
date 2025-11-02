import React from 'react'

type IconName =
  | 'dashboard'
  | 'plugins'
  | 'settings'
  | 'tickets'
  | 'shield'
  | 'tag'
  | 'info'
  | 'refresh'
  | 'clock'
  | 'logs'
  | 'live'
  | 'members'
  | 'roles'
  | 'webhooks'
  | 'verification'
  | 'metrics'
  | 'commands'
  | 'automod'
  | 'appeals'
  | 'performance'
  | 'diagnostics'

export function Icon({ name, className = 'h-5 w-5', stroke = 'currentColor' }: { name: IconName; className?: string; stroke?: string }) {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} stroke={stroke}>
          <rect x="3" y="10" width="4" height="10" rx="1.5" strokeWidth="1.6" />
          <rect x="10" y="4" width="4" height="16" rx="1.5" strokeWidth="1.6" />
          <rect x="17" y="13" width="4" height="7" rx="1.5" strokeWidth="1.6" />
        </svg>
      )
    case 'plugins':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3h3a2 2 0 0 1 2 2v1h1a2 2 0 1 1 0 4h-1v2a2 2 0 0 1-2 2H9v1a2 2 0 1 1-4 0v-1H4a2 2 0 1 1 0-4h1V8a5 5 0 0 1 4-5Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" strokeWidth="1.6"/>
          <path d="M3 12h2.2M18.8 12H21M6.2 6.2l1.6 1.1M16.2 16.7l1.6 1.1M6.2 17.8l1.6-1.1M16.2 7.3l1.6-1.1" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'tickets':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 8a2 2 0 0 1 2-2h10l4 4v6a2 2 0 0 1-2 2H8l-4-4V8Z" strokeWidth="1.6"/>
          <path d="M15 6v12" strokeWidth="1.6" strokeDasharray="2 2"/>
        </svg>
      )
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3 5 6v6a9 9 0 0 0 7 8 9 9 0 0 0 7-8V6l-7-3Z" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M9.5 12.5 11 14l3.5-3.5" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'tag':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M3 12V6a2 2 0 0 1 2-2h6l10 10-6 6L3 12Z" strokeWidth="1.6" strokeLinejoin="round"/>
          <circle cx="8" cy="8" r="1.2" fill={stroke} />
        </svg>
      )
    case 'info':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" strokeWidth="1.6"/>
          <path d="M12 10v6" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="12" cy="7" r="1.2" fill={stroke} />
        </svg>
      )
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 4v5h-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" strokeWidth="1.6"/>
          <path d="M12 7v6l4 2" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'logs':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.6"/>
          <path d="M7 8h10M7 12h10M7 16h6" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'live':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" fill={stroke} />
          <circle cx="12" cy="12" r="6" strokeWidth="1.6" opacity="0.6"/>
          <circle cx="12" cy="12" r="9" strokeWidth="1.6" opacity="0.3"/>
        </svg>
      )
    case 'members':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="8" r="3" strokeWidth="1.6"/>
          <path d="M4 19a5 5 0 0 1 10 0" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="17" cy="10" r="2" strokeWidth="1.6"/>
          <path d="M16 19a4 4 0 0 1 4-4" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'roles':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M5 5h9v9H5z" strokeWidth="1.6"/>
          <path d="M10 10h9v9h-9z" strokeWidth="1.6"/>
        </svg>
      )
    case 'webhooks':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M9 6a3 3 0 1 0 3 3" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M12 9a3 3 0 1 0 3 3" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M15 12a3 3 0 1 0 3 3" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'verification':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3l7 4v6a9 9 0 0 1-7 8 9 9 0 0 1-7-8V7l7-4z" strokeWidth="1.6"/>
          <path d="M9.5 12.5L11 14l3.5-3.5" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'metrics':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 20V4" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M20 20H4" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M7 14l3-3 3 2 4-5" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'commands':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M8 9l-4 3 4 3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 17h8" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'automod':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="16" height="12" rx="2" strokeWidth="1.6"/>
          <path d="M8 20h8" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'appeals':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6h16v12H4z" strokeWidth="1.6"/>
          <path d="M8 10h8M8 14h5" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'performance':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" strokeWidth="1.6"/>
          <path d="M12 12l5-3" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )
    case 'diagnostics':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke={stroke} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12h4l2-4 4 8h6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="6" cy="18" r="1.5" fill={stroke} />
          <circle cx="18" cy="18" r="1.5" fill={stroke} />
        </svg>
      )
  }
}

export type { IconName }
