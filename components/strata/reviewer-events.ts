/**
 * Opens the existing Reviewer Mode sign-in in the header (Chrome). UI-only: it carries no
 * credentials and performs no authentication itself; the header form posts to the same server
 * action as before.
 */
export const REVIEWER_UNLOCK_EVENT = 'istithbat:reviewer-unlock';
export function requestReviewerUnlock() {
  window.dispatchEvent(new CustomEvent(REVIEWER_UNLOCK_EVENT));
}
