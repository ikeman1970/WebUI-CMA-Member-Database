/**
 * Member Eligibility Helpers
 * 
 * Calculates member eligibility for voting, nominations, and officer positions
 * based on configurable chapter rules and CMA Handbook standards.
 */

export type EligibilityWarning = 
  | 'age_ineligible'
  | 'membership_too_recent'
  | 'insufficient_attendance'
  | 'patch_status_issue'
  | 'member_training_incomplete';

export type MemberEligibilityStatus = {
  isEligibleToVote: boolean;
  isEligibleToNominate: boolean;
  isEligibleForOffice: boolean;
  warnings: EligibilityWarning[];
  details: {
    meetsAgeRequirement: boolean;
    meetsMembershipDuration: boolean;
    meetsAttendanceRequirement: boolean;
    meetsPatchRequirement: boolean;
    patchType?: string | null;
    attendanceCount?: number;
    membershipDurationMonths?: number;
  };
};

/**
 * Donation cycle helpers - for RFS (June 1 - May 30) and others
 */
export const DONATION_CYCLES = {
  RFS: {
    cycleName: 'RFS',
    cycleType: 'annual',
    startMonth: 6,
    startDay: 1,
    endMonth: 5,
    endDay: 31,
    description: 'Run for the Son annual cycle'
  },
  GENERAL: {
    cycleName: 'General',
    cycleType: 'annual',
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    description: 'Calendar year'
  }
} as const;

/**
 * Get the current donation cycle for a given date
 */
export function getCurrentDonationCycle(
  date: Date,
  cycle: typeof DONATION_CYCLES[keyof typeof DONATION_CYCLES]
): { startDate: Date; endDate: Date } {
  const year = date.getFullYear();
  let startDate = new Date(year, cycle.startMonth - 1, cycle.startDay);
  let endDate = new Date(year, cycle.endMonth - 1, cycle.endDay);

  // If we're before the start date this year, it means we're in last year's cycle
  if (date < startDate) {
    startDate = new Date(year - 1, cycle.startMonth - 1, cycle.startDay);
    endDate = new Date(year - 1, cycle.endMonth - 1, cycle.endDay);
  }

  return { startDate, endDate };
}

/**
 * Get active eligibility config for a chapter
 * (In practice, this would be fetched from DB)
 */
export type EligibilityConfig = {
  trackMeetingAttendance: boolean;
  trackBackPatchStatus: boolean;
  trackDonations: boolean;
  meetingsRequiredPerPeriod: number;
  meetingTrackingPeriodMonths: number;
  backPatchRequiredMonths: number;
  minimumAgeForVoting: number;
  minimumChapterMembershipMonths: number;
};

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  trackMeetingAttendance: true,
  trackBackPatchStatus: true,
  trackDonations: false,
  meetingsRequiredPerPeriod: 3,
  meetingTrackingPeriodMonths: 6,
  backPatchRequiredMonths: 6,
  minimumAgeForVoting: 18,
  minimumChapterMembershipMonths: 6
};

/**
 * Types for eligibility data
 */
export type MemberEligibilityData = {
  personId: string;
  chapterId: string;
  birthDate?: Date | null;
  joinedChapterDate?: Date | null;
  currentBackPatch?: string | null; // 'CMA', 'Christian_other', 'secular', 'none'
  backPatchStartDate?: Date | null;
  recentAttendanceCount?: number; // In last 6 months
  trainingCompletionDate?: Date | null;
  nationalMembershipStatus?: {
    isActive: boolean;
    expiryDate?: Date | null;
  };
  pastorChurch?: string | null; // If set, can only hold Chaplain role
};

/**
 * Calculate member eligibility status
 */
export function calculateMemberEligibility(
  memberData: MemberEligibilityData,
  config: EligibilityConfig,
  currentDate: Date = new Date()
): MemberEligibilityStatus {
  const warnings: EligibilityWarning[] = [];
  const details: MemberEligibilityStatus['details'] = {
    meetsAgeRequirement: false,
    meetsMembershipDuration: false,
    meetsAttendanceRequirement: false,
    meetsPatchRequirement: false
  };

  // 1. Check age requirement
  let meetsAge = true;
  if (memberData.birthDate) {
    const age = getAgeAtDate(memberData.birthDate, currentDate);
    details.meetsAgeRequirement = age >= config.minimumAgeForVoting;
    meetsAge = details.meetsAgeRequirement;
    if (!meetsAge) {
      warnings.push('age_ineligible');
    }
  }

  // 2. Check membership duration
  let meetsMembership = true;
  if (memberData.joinedChapterDate) {
    const monthsSinceSince = getMonthsBetween(memberData.joinedChapterDate, currentDate);
    details.membershipDurationMonths = monthsSinceSince;
    details.meetsMembershipDuration = monthsSinceSince >= config.minimumChapterMembershipMonths;
    meetsMembership = details.meetsMembershipDuration;
    if (!meetsMembership) {
      warnings.push('membership_too_recent');
    }
  }

  // 3. Check attendance requirement
  let meetsAttendance = true;
  if (config.trackMeetingAttendance && memberData.recentAttendanceCount !== undefined) {
    details.attendanceCount = memberData.recentAttendanceCount;
    details.meetsAttendanceRequirement = memberData.recentAttendanceCount >= config.meetingsRequiredPerPeriod;
    meetsAttendance = details.meetsAttendanceRequirement;
    if (!meetsAttendance) {
      warnings.push('insufficient_attendance');
    }
  }

  // 4. Check back patch requirement
  let meetsPatch = true;
  if (config.trackBackPatchStatus) {
    details.patchType = memberData.currentBackPatch;
    if (memberData.currentBackPatch === 'CMA' && memberData.backPatchStartDate) {
      const monthsWithCMA = getMonthsBetween(memberData.backPatchStartDate, currentDate);
      details.meetsPatchRequirement = monthsWithCMA >= config.backPatchRequiredMonths;
    } else if (memberData.currentBackPatch !== 'CMA') {
      details.meetsPatchRequirement = false;
    }
    meetsPatch = details.meetsPatchRequirement;
    if (!meetsPatch) {
      warnings.push('patch_status_issue');
    }
  }

  // 5. Check member training (only if Nationals hasn't granted membership)
  if (!memberData.nationalMembershipStatus?.isActive && !memberData.trainingCompletionDate) {
    warnings.push('member_training_incomplete');
  }

  // Determine overall eligibility
  const isEligibleToVote = meetsAge && meetsMembership && meetsAttendance && meetsPatch;
  const isEligibleToNominate = isEligibleToVote; // Same requirements for nominations
  const isEligibleForOffice = isEligibleToVote && !memberData.pastorChurch; // Pastors only Chaplain

  return {
    isEligibleToVote,
    isEligibleToNominate,
    isEligibleForOffice,
    warnings,
    details
  };
}

/**
 * Get warning message for UI display
 */
export function getWarningMessage(warning: EligibilityWarning, config: EligibilityConfig): string {
  const messages: Record<EligibilityWarning, string> = {
    age_ineligible: `Must be at least ${config.minimumAgeForVoting} years old`,
    membership_too_recent: `Must have been a chapter member for at least ${config.minimumChapterMembershipMonths} months`,
    insufficient_attendance: `Must have attended at least ${config.meetingsRequiredPerPeriod} meetings in the last ${config.meetingTrackingPeriodMonths} months`,
    patch_status_issue: `Must have worn CMA patch exclusively for at least ${config.backPatchRequiredMonths} months`,
    member_training_incomplete: 'Must complete member training'
  };
  return messages[warning];
}

/**
 * Calculate age at a given date
 */
function getAgeAtDate(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Calculate months between two dates
 */
function getMonthsBetween(startDate: Date, endDate: Date): number {
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
  );
}

/**
 * Get meeting window dates based on current period
 * For nominations: April-September
 * For voting: May-October
 */
export function getMeetingWindowDates(
  forNominations: boolean = false,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const year = referenceDate.getFullYear();

  if (forNominations) {
    // April 1 - September 30
    const startMonth = 4;
    const endMonth = 9;
    // Adjust year based on current position
    const adjustedYear = currentMonth >= startMonth ? year : year - 1;
    return {
      start: new Date(adjustedYear, startMonth - 1, 1),
      end: new Date(adjustedYear, endMonth, 0) // Last day of September
    };
  } else {
    // May 1 - October 31 (for voting)
    const startMonth = 5;
    const endMonth = 10;
    // Adjust year based on current position
    const adjustedYear = currentMonth >= startMonth ? year : year - 1;
    return {
      start: new Date(adjustedYear, startMonth - 1, 1),
      end: new Date(adjustedYear, endMonth, 0) // Last day of October
    };
  }
}

/**
 * Format eligibility for display
 */
export function formatEligibilityStatus(
  status: MemberEligibilityStatus,
  config: EligibilityConfig
): {
  summary: string;
  canVote: boolean;
  canNominate: boolean;
  canHoldOffice: boolean;
  issues: string[];
} {
  const issues = status.warnings.map(w => getWarningMessage(w, config));

  let summary = '';
  if (status.isEligibleForOffice) {
    summary = '✓ Eligible for voting, nominations, and office';
  } else if (status.isEligibleToVote) {
    summary = '⚠ Eligible for voting and nominations only';
  } else {
    summary = '✗ Not currently eligible for voting';
  }

  return {
    summary,
    canVote: status.isEligibleToVote,
    canNominate: status.isEligibleToNominate,
    canHoldOffice: status.isEligibleForOffice,
    issues
  };
}
