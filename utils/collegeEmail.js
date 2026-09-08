/**
 * Restrict DeNote to college email domains (e.g. bmsce.ac.in).
 * Configure with ALLOWED_EMAIL_DOMAIN or ALLOWED_EMAIL_DOMAINS
 * (comma-separated). Default: bmsce.ac.in
 */

function getAllowedEmailDomains() {
    const raw =
        process.env.ALLOWED_EMAIL_DOMAINS ||
        process.env.ALLOWED_EMAIL_DOMAIN ||
        'bmsce.ac.in';

    return String(raw)
        .split(',')
        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);
}

function emailDomain(email) {
    if (!email || typeof email !== 'string') return '';
    const at = email.lastIndexOf('@');
    if (at < 0) return '';
    return email.slice(at + 1).trim().toLowerCase();
}

function isAllowedCollegeEmail(email) {
    const domain = emailDomain(email);
    if (!domain) return false;
    const allowed = getAllowedEmailDomains();
    return allowed.includes(domain);
}

function formatAllowedDomains() {
    return getAllowedEmailDomains().map((d) => `@${d}`).join(' or ');
}

function collegeEmailRequiredMsg() {
    return `Use your college email (${formatAllowedDomains()}). Only that domain can register or sign in.`;
}

function collegeEmailDeniedMsg() {
    return `Access is limited to ${formatAllowedDomains()} accounts.`;
}

module.exports = {
    getAllowedEmailDomains,
    emailDomain,
    isAllowedCollegeEmail,
    formatAllowedDomains,
    collegeEmailRequiredMsg,
    collegeEmailDeniedMsg
};
