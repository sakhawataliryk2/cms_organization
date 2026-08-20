export type SickTimeRate = {
  state_code: string;
  state_name: string;
  hours_worked: number | null;
};

/**
 * Hours a person must work in a state to earn 1 hour of sick time.
 * Matches on two-letter code first, then full state name.
 */
export function lookupHoursToEarnSickTime(
  rates: SickTimeRate[] | null | undefined,
  stateValue: string | null | undefined,
): number | null {
  if (!rates?.length || stateValue == null) return null;
  const trimmed = String(stateValue).trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  const byCode = rates.find(
    (r) => String(r.state_code || "").toUpperCase() === upper,
  );
  if (byCode && byCode.hours_worked != null && Number(byCode.hours_worked) > 0) {
    return Number(byCode.hours_worked);
  }

  const byName = rates.find(
    (r) => String(r.state_name || "").toLowerCase() === lower,
  );
  if (byName && byName.hours_worked != null && Number(byName.hours_worked) > 0) {
    return Number(byName.hours_worked);
  }

  if (byCode?.hours_worked != null) return Number(byCode.hours_worked);
  if (byName?.hours_worked != null) return Number(byName.hours_worked);
  return null;
}

/** Accrued sick hours = hours worked ÷ state hours-to-earn. */
export function calculateSickTimeHours(
  hoursWorked: number | string | null | undefined,
  hoursToEarn: number | string | null | undefined,
): number | null {
  const worked = Number(hoursWorked);
  const earn = Number(hoursToEarn);
  if (!Number.isFinite(worked) || worked < 0) return null;
  if (!Number.isFinite(earn) || earn <= 0) return null;
  return Math.round((worked / earn) * 100) / 100;
}

export function formatSickTimeHours(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(Number(value));
}
