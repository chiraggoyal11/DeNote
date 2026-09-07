const DEFAULT_DOMAIN = 'bmsce.ac.in'

export function getAllowedEmailDomains() {
  const raw =
    import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ||
    import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ||
    DEFAULT_DOMAIN

  return String(raw)
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

export function formatAllowedEmailDomains() {
  return getAllowedEmailDomains().map((d) => `@${d}`).join(' or ')
}

export function isAllowedCollegeEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 0) return false
  const domain = value.slice(at + 1)
  return getAllowedEmailDomains().includes(domain)
}

export function collegeEmailHint() {
  return `Only ${formatAllowedEmailDomains()} college emails can use DeNote.`
}

export function collegeEmailRequiredMsg() {
  return `Use your college email (${formatAllowedEmailDomains()}).`
}
