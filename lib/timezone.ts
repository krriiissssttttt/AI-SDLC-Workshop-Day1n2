const SINGAPORE_TIMEZONE = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  return new Date();
}

export function formatSingaporeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getSingaporeTimezone(): 'Asia/Singapore' {
  return SINGAPORE_TIMEZONE;
}

export function toSingaporeIsoString(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formatted = formatter.format(date).replace(' ', 'T');
  return `${formatted}+08:00`;
}
