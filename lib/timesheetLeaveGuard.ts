/** Shared leave-guard for timesheet weekly entry (hours + notes autosave). */

type GuardFn = () => boolean;

let guardFn: GuardFn | null = null;
let allowNextLeave = false;

export function setTimesheetLeaveGuard(fn: GuardFn | null) {
  guardFn = fn;
  if (!fn) allowNextLeave = false;
}

/** Call before intentional navigation (e.g. after successful submit). */
export function allowTimesheetLeaveOnce() {
  allowNextLeave = true;
}

function isBlocked(): boolean {
  if (allowNextLeave) return false;
  return guardFn ? !!guardFn() : false;
}

export function shouldBlockTimesheetLeave(): boolean {
  if (allowNextLeave) {
    allowNextLeave = false;
    return false;
  }
  return guardFn ? !!guardFn() : false;
}

export const TIMESHEET_LEAVE_MESSAGE =
  "You have unsaved timesheet changes (hours, notes, or a save in progress). Leave this page anyway?";

/** Returns true if navigation may proceed. */
export function confirmTimesheetLeave(): boolean {
  if (!isBlocked()) return true;
  const ok = window.confirm(TIMESHEET_LEAVE_MESSAGE);
  if (ok) allowNextLeave = true;
  return ok;
}
