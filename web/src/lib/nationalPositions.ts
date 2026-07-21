/**
 * CMA National Organization Structure & Positions
 * 
 * Based on CMA Handbook - defines all national, state, and regional roles and positions
 */

// ============================================================================
// NATIONAL LEVEL POSITIONS
// ============================================================================

/**
 * National board and leadership positions
 */
export const NATIONAL_POSITIONS = {
  CEO: 'CEO/Chairman',
  BOARD_MEMBER: 'Board of Directors',
  BOARD_ADVISOR: 'Board Advisor',
  NATIONAL_EVANGELIST: 'National Evangelist',
  SUPPORT_CENTER: 'Support Center Staff'
} as const;

/**
 * CMA Chain of Command / Communication Hierarchy
 * 
 * From CMA Handbook:
 * "CMA has developed a chain of command and communication to aid members in receiving
 *  the information they need on a timely basis and provide chapters and members with
 *  support as needed. It is the responsibility of each leader to make sure that the
 *  next leader in the chain receives the communicated information."
 * 
 * Communication should flow through this hierarchy; members are encouraged to refer
 * to this chain when seeking answers to questions or escalating issues.
 */
export const CHAIN_OF_COMMAND = [
  {
    level: 1,
    position: 'CMA Board of Directors',
    role: 'board',
    description: 'Strategic governance and oversight'
  },
  {
    level: 2,
    position: 'Chairman of the Board',
    role: 'ceo',
    description: 'Board leadership and CEO/Chairman'
  },
  {
    level: 3,
    position: 'Vice President of Evangelistic Outreach',
    role: 'evangelist',
    description: 'National evangelist oversight and regional coordination'
  },
  {
    level: 4,
    position: 'National Evangelist',
    role: 'evangelist',
    description: 'Regional leadership and state coordination',
    regionScope: '1-6'
  },
  {
    level: 5,
    position: 'State Coordinator',
    role: 'state_coordinator',
    description: 'State-level leadership and coordination',
    stateScope: 'Single state'
  },
  {
    level: 6,
    position: 'Area Representative',
    role: 'area_rep',
    description: 'Area-level leadership supporting chapters',
    stateScope: 'Portion of state'
  },
  {
    level: 7,
    position: 'Chapter President',
    role: 'president',
    description: 'Chapter leadership and member support',
    chapterScope: 'Single chapter'
  },
  {
    level: 8,
    position: 'Chapter Member',
    role: 'member',
    description: 'CMA member'
  }
] as const;

/**
 * Get the chain of command hierarchy for escalation/communication
 */
export function getChainOfCommand() {
  return CHAIN_OF_COMMAND;
}

/**
 * Get the next level up in the chain of command
 */
export function getNextLevelInChain(currentLevel: number): (typeof CHAIN_OF_COMMAND)[number] | null {
  return CHAIN_OF_COMMAND.find(item => item.level === currentLevel + 1) || null;
}

/**
 * Get the chain of command entry for a role
 */
export function getChainOfCommandByRole(role: string | null | undefined): (typeof CHAIN_OF_COMMAND)[number] | null {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return CHAIN_OF_COMMAND.find(item => item.role.toLowerCase() === normalizedRole) || null;
}

/**
 * Get escalation path from current role to board
 */
export function getEscalationPath(currentRole: string | null | undefined): string[] {
  const entry = getChainOfCommandByRole(currentRole);
  if (!entry) return [];
  
  const path: string[] = [];
  for (let i = entry.level; i <= CHAIN_OF_COMMAND.length; i++) {
    const item = CHAIN_OF_COMMAND.find(x => x.level === i);
    if (item) {
      path.push(item.position);
    }
  }
  return path;
}

/**
 * Account role values for national-level users
 */
export const NATIONAL_ACCOUNT_ROLES = {
  CEO: 'ceo',
  BOARD: 'board',
  BOARD_ADVISOR: 'board_advisor',
  EVANGELIST: 'evangelist',
  SUPPORT_CENTER: 'support_center',
  SUPPORT_CENTER_EVENTS: 'support_center_events',
  SUPPORT_CENTER_EXECUTIVE: 'support_center_executive',
  SUPPORT_CENTER_FACILITIES: 'support_center_facilities',
  SUPPORT_CENTER_FINANCE: 'support_center_finance',
  SUPPORT_CENTER_GOODIES: 'support_center_goodies',
  SUPPORT_CENTER_GRAPHICS: 'support_center_graphics'
} as const;

/**
 * Support Center Team Specializations (32 members)
 * Each team supports specific functions of CMA National
 */
export const SUPPORT_CENTER_TEAMS = {
  EVENTS_MEMBERSHIP: {
    id: 'support_center_events',
    name: 'Events/Membership Team',
    description: 'Processes membership applications and chapter charters, updates member records, organizes and supports CMA National events, supports website maintenance and development, provides welcoming presence at CMA facilities, answers phone calls',
    memberCount: 'Approx 5-6'
  },
  EXECUTIVE_SUPPORT: {
    id: 'support_center_executive',
    name: 'Executive Support Team',
    description: 'Supports CMA National and CMA International family, maintains CMA core documents (Handbook), analyzes key ministry statistics, organizes travel, supports CMA Board, CEO and Evangelists, develops CMA International training and conferences',
    memberCount: 'Approx 4-5'
  },
  FACILITIES_MAINTENANCE: {
    id: 'support_center_facilities',
    name: 'Facilities/Maintenance Team',
    description: 'Supports proper running of all CMA facilities, builds and coordinates new projects, maintains facility grounds',
    memberCount: 'Approx 3-4'
  },
  FINANCE: {
    id: 'support_center_finance',
    name: 'Finance Team',
    description: 'Processes mail, donations, and incoming bills, maintains financial reporting of the ministry, ensures financial compliance and accountability with ECFA requirements, supports Human Resources needs',
    memberCount: 'Approx 4-5'
  },
  GOODIES: {
    id: 'support_center_goodies',
    name: 'Goodies Team',
    description: 'Designs, purchases, and ships all CMA branded tools and products, maintains CMA National warehouse, provides support to all Goodie Rep warehouses',
    memberCount: 'Approx 5-6'
  },
  GRAPHICS_MEDIA: {
    id: 'support_center_graphics',
    name: 'Graphics/Media/Production Team',
    description: 'Supports CMA National events, maintains online and social media presence, produces monthly HeartBeat magazine, creates all digital content for advertising and training, designs all CMA products',
    memberCount: 'Approx 4-5'
  }
} as const;

// ============================================================================
// STATE LEVEL POSITIONS
// ============================================================================

/**
 * State-level leadership positions
 */
export const STATE_POSITIONS = {
  STATE_COORDINATOR: 'State Coordinator',
  AREA_REP: 'Area Representative',
  AREA_REP_YOUTH: 'Area Rep - Youth Movement',
  AREA_REP_FAST_LANE: 'Area Rep - Fast Lane',
  STATE_TREASURER: 'State Treasurer',
  STATE_KIDS_LEADER: 'State Kids Leader',
  STATE_PRAYER_LEADER: 'State Prayer Leader',
  STATE_RFS_LEAD: 'State RFS Lead',
  STATE_WEBMASTER: 'State Webmaster',
  GOODIE_REPRESENTATIVE: 'Goodie Representative',
  APPROVED_SPEAKER: 'Approved Speaker'
} as const;

/**
 * Account role values for state-level users
 */
export const STATE_ACCOUNT_ROLES = {
  STATE_COORDINATOR: 'state_coordinator',
  AREA_REP: 'area_rep',
  STATE_TREASURER: 'state_treasurer',
  STATE_KIDS_LEADER: 'state_kids_leader',
  STATE_PRAYER_LEADER: 'state_prayer_leader',
  STATE_RFS_LEAD: 'state_rfs_lead',
  STATE_WEBMASTER: 'state_webmaster',
  GOODIE_REPRESENTATIVE: 'goodie_rep',
  APPROVED_SPEAKER: 'approved_speaker'
} as const;

/**
 * Account scope type values - defines the level of access/responsibility
 */
export const ACCOUNT_SCOPE_TYPES = {
  NATIONAL: 'national',      // CEO, Board members - global access
  EVANGELIST: 'evangelist',  // Regional National Evangelist - region access
  STATE: 'state',            // State admin and coordinators - state access
  REGION: 'region',          // Region admin
  CHAPTER: 'chapter',        // Chapter admin
  GLOBAL: 'global',          // Global/national scope
  SUPPORT_CENTER: 'support_center' // Support staff (varies by assignment)
} as const;

/**
 * State-Appointed Positions
 * 
 * These positions are appointed by the State Coordinator with National Evangelist approval.
 * They are "yellow badge" positions and do not appear on the CMA website.
 * They are appointed (not elected) and require State Coordinator + National Evangelist approval.
 */
export const STATE_APPOINTED_POSITIONS = {
  STATE_KIDS_LEADER: {
    role: 'state_kids_leader',
    title: 'State Kids Leader',
    description: 'Leads CMA Kids ministry initiatives and support across the state',
    appointedBy: ['state_coordinator', 'evangelist'],
    badgeColor: 'yellow',
    visibleOnWebsite: false,
    responsibilities: [
      'Develop and oversee Kids programs and activities',
      'Support chapter Kids leaders',
      'Organize state-level Kids events and training',
      'Communicate with chapters about Kids ministry opportunities',
      'Report to State Coordinator on Kids ministry progress'
    ]
  },
  STATE_PRAYER_LEADER: {
    role: 'state_prayer_leader',
    title: 'State Prayer Leader',
    description: 'Leads prayer ministry and intercession initiatives across the state',
    appointedBy: ['state_coordinator', 'evangelist'],
    badgeColor: 'yellow',
    visibleOnWebsite: false,
    responsibilities: [
      'Establish and coordinate prayer networks across the state',
      'Support chapter Chaplains and prayer leaders',
      'Organize prayer events and prayer line coordination',
      'Communicate prayer requests and updates to members',
      'Report to State Coordinator on prayer ministry initiatives'
    ]
  },
  STATE_RFS_LEAD: {
    role: 'state_rfs_lead',
    title: 'State RFS Lead',
    description: 'Leads Run for the Son (RFS) fundraising initiatives and coordination across the state',
    appointedBy: ['state_coordinator', 'evangelist'],
    badgeColor: 'yellow',
    visibleOnWebsite: false,
    responsibilities: [
      'Coordinate state-wide Run for the Son planning and execution',
      'Support chapter RFS leads',
      'Track RFS donations and report to National',
      'Communicate RFS goals, progress, and impact',
      'Coordinate with Finance team on donations',
      'Report to State Coordinator on RFS results'
    ]
  },
  STATE_TREASURER: {
    role: 'state_treasurer',
    title: 'State Treasurer',
    description: 'Manages financial reporting and compliance for the state organization',
    appointedBy: ['state_coordinator', 'evangelist'],
    badgeColor: 'yellow',
    visibleOnWebsite: false,
    responsibilities: [
      'Maintain accurate financial records for state',
      'Report state finances to National (ECFA compliance)',
      'Support chapter treasurers with financial best practices',
      'Track donations and contributions by chapter',
      'Ensure financial accountability and transparency',
      'Report to State Coordinator and National Finance team'
    ],
    financialResponsibility: true
  },
  STATE_WEBMASTER: {
    role: 'state_webmaster',
    title: 'State Webmaster',
    description: 'Manages state website and online presence',
    appointedBy: ['state_coordinator', 'evangelist'],
    badgeColor: 'yellow',
    visibleOnWebsite: false,
    responsibilities: [
      'Maintain state website content and functionality',
      'Support chapter websites and online presence',
      'Coordinate with Graphics/Media team on digital content',
      'Manage state online communications and social media',
      'Ensure website reflects current chapter and state information',
      'Report to State Coordinator on web initiatives'
    ]
  }
} as const;

// ============================================================================
// REGIONAL EVANGELISTS (6 Total)
// ============================================================================

/**
 * National Evangelists by Region
 * 
 * Region 1 – West Region: Alaska, California, Idaho, Nevada, Oregon, Washington
 * Region 2 – Rocky Mountain Region: Arizona, Colorado, Hawaii, Montana, New Mexico, Utah, Wyoming
 * Region 3 – North Central Region: Illinois, Indiana, Iowa, Michigan, Minnesota, Nebraska, North Dakota, South Dakota, Wisconsin
 * Region 4 – South Central Region: Arkansas, Kansas, Louisiana, Mississippi, Missouri, Oklahoma, Texas
 * Region 5 – Northeast Region: Connecticut, Delaware, Kentucky, Maine, Maryland, Massachusetts, New Hampshire, New Jersey, New York, Ohio, Pennsylvania, Rhode Island, Vermont, Virginia, West Virginia
 * Region 6 – Southeast Region: Alabama, Florida, Georgia, North Carolina, South Carolina, Tennessee
 */
export const REGIONS = {
  1: { name: 'West', position: 'National Evangelist – West Region' },
  2: { name: 'Rocky Mountain', position: 'National Evangelist – Rocky Mountain Region' },
  3: { name: 'North Central', position: 'National Evangelist – North Central Region' },
  4: { name: 'South Central', position: 'National Evangelist – South Central Region' },
  5: { name: 'Northeast', position: 'National Evangelist – Northeast Region' },
  6: { name: 'Southeast', position: 'National Evangelist – Southeast Region' }
} as const;

// ============================================================================
// CHAPTER OFFICER ROLES
// ============================================================================

/**
 * Chapter-level officer positions
 */
export const CHAPTER_OFFICER_ROLES = {
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice-President',
  SECRETARY: 'Secretary',
  TREASURER: 'Treasurer',
  ROAD_CAPTAIN: 'Road Captain',
  RFS_LEAD: 'RFS Lead',
  CHAPLAIN: 'Chaplain'
} as const;

/**
 * Detailed chapter officer role descriptions
 */
export const CHAPTER_OFFICER_DESCRIPTIONS = {
  [CHAPTER_OFFICER_ROLES.PRESIDENT]: {
    title: 'Chapter President',
    description: 'Maintains vision, servant-leader, works with officers and members to build effective witness',
    keyResponsibilities: [
      'Promotes and attends CMA state/national events',
      'Gets involved with local motorcycling organizations',
      'Communicates with members and state leadership',
      'Chairs monthly officer meetings',
      'Keeps chapter informed about ministry activities',
      'Coordinates between chapter and state leadership',
      'Primary interface with local community'
    ],
    adminCapability: true,
    chainOfCommand: 'Area Rep → State Coordinator → National Evangelist → VP Evangelistic Outreach'
  },
  [CHAPTER_OFFICER_ROLES.VICE_PRESIDENT]: {
    title: 'Chapter Vice President',
    description: 'Assistant to President, fills in for other officers, supports chapter needs',
    keyResponsibilities: [
      'Communicates with Chapter President',
      'Assists other officers and fills in as needed',
      'Attends chapter and officer meetings',
      'Welcomes visitors and members',
      'Familiar with CMA guidelines and procedures',
      'Promotes ministry and encourages members'
    ],
    adminCapability: false,
    chainOfCommand: 'Chapter President → Area Rep → State Coordinator → National Evangelist'
  },
  [CHAPTER_OFFICER_ROLES.SECRETARY]: {
    title: 'Chapter Secretary',
    description: 'Note taker and record keeper, maintains accurate chapter records and documentation',
    keyResponsibilities: [
      'Records accurate minutes of chapter meetings',
      'Maintains member attendance records',
      'Fills out quarterly reports electronically',
      'Submits New Chapter Officers form after elections',
      'Keeps records organized and accessible',
      'Stores minutes electronically and in binder',
      'Reports attendance eligibility for voting/nomination'
    ],
    adminCapability: true,
    quarterlyReportsDue: 'April 10, July 10, October 10, January 10',
    chainOfCommand: 'Chapter President → Area Rep → State Coordinator → National Evangelist'
  },
  [CHAPTER_OFFICER_ROLES.TREASURER]: {
    title: 'Chapter Treasurer',
    description: 'Collects and maintains donations/finances for the chapter',
    keyResponsibilities: [
      'Meets with officers to determine donation amounts',
      'Collects donations (keeping chapter/RFS/CMA National separate)',
      'Maintains accurate financial records',
      'Gets approval from President for all expenditures',
      'Reports monthly expenditures at chapter meetings',
      'Counts all donations with another officer',
      'Presents bank statements for review at officer meetings',
      'Deposits donations and maintains separate accounts'
    ],
    adminCapability: false,
    financialResponsibilities: true,
    chainOfCommand: 'Chapter President → Area Rep → State Coordinator → National Evangelist'
  },
  [CHAPTER_OFFICER_ROLES.ROAD_CAPTAIN]: {
    title: 'Chapter Road Captain',
    description: 'Determines routes and leads rides for chapter activities and functions',
    keyResponsibilities: [
      'Plans rides in advance (6 months tentatively)',
      'Announces ride information (dates, times, distances, costs)',
      'Checks route and road conditions before rides',
      'Practices and promotes safe riding habits',
      'Writes monthly newsletter article on rides/safety',
      'Considers group ride instruction classes',
      'Appoints rear-rider for communication on large rides',
      'Seeks new ideas and routes'
    ],
    adminCapability: false,
    chainOfCommand: 'Chapter President → Area Rep → State Coordinator → National Evangelist'
  },
  [CHAPTER_OFFICER_ROLES.CHAPLAIN]: {
    title: 'Chapter Chaplain',
    description: 'Delivers devotions and spiritual encouragement to the chapter',
    keyResponsibilities: [
      'Leads chapter as prayer warrior and intercessor',
      'Assembles prayer teams for divine appointments',
      'Delivers short nondenominational devotions (under 10 minutes)',
      'Establishes and leads Bible study groups',
      'Takes prayer requests during meetings',
      'Visits sick members; encourages and prays',
      'Writes uplifting monthly newsletter articles',
      'Accompanies President on member visits'
    ],
    adminCapability: false,
    spiritualFocus: true,
    chainOfCommand: 'Chapter President → Area Rep → State Coordinator → National Evangelist'
  },
  [CHAPTER_OFFICER_ROLES.RFS_LEAD]: {
    title: 'Chapter RFS Lead',
    description: 'Leads Run for the Son fundraising and coordination',
    keyResponsibilities: [
      'Coordinates chapter participation in Run for the Son',
      'Manages RFS donations and records',
      'Communicates RFS goals and progress to chapter',
      'Coordinates with state RFS Lead'
    ],
    adminCapability: false,
    fundraisingResponsibilities: true,
    chainOfCommand: 'Chapter President → State RFS Lead → National'
  }
} as const;

/**
 * Chapter-level roles that grant admin capabilities
 */
export const CHAPTER_ADMIN_ROLES = new Set(['President', 'Secretary']);

// ============================================================================
// ROLE HIERARCHY & PERMISSIONS
// ============================================================================

/**
 * Checks if a role grants administrative capabilities
 */
export function isAdminRole(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  const adminRoles = new Set([
    // National roles
    NATIONAL_ACCOUNT_ROLES.CEO.toLowerCase(),
    NATIONAL_ACCOUNT_ROLES.BOARD.toLowerCase(),
    NATIONAL_ACCOUNT_ROLES.EVANGELIST.toLowerCase(),
    // State roles
    STATE_ACCOUNT_ROLES.STATE_COORDINATOR.toLowerCase(),
    STATE_ACCOUNT_ROLES.AREA_REP.toLowerCase(),
    // Chapter roles
    'admin',
    'root',
    'superuser',
    'president',
    'secretary'
  ]);
  return adminRoles.has(normalizedRole);
}

/**
 * Checks if a role is a national-level position
 */
export function isNationalPosition(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return Object.values(NATIONAL_ACCOUNT_ROLES)
    .map(r => r.toLowerCase())
    .includes(normalizedRole);
}

/**
 * Checks if a role is a state-level position
 */
export function isStatePosition(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return Object.values(STATE_ACCOUNT_ROLES)
    .map(r => r.toLowerCase())
    .includes(normalizedRole);
}

/**
 * Get the display name for a national position
 */
export function getNationalPositionDisplay(role: string | null | undefined): string | null {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  
  switch (normalizedRole) {
    case NATIONAL_ACCOUNT_ROLES.CEO:
      return NATIONAL_POSITIONS.CEO;
    case NATIONAL_ACCOUNT_ROLES.BOARD:
      return NATIONAL_POSITIONS.BOARD_MEMBER;
    case NATIONAL_ACCOUNT_ROLES.BOARD_ADVISOR:
      return NATIONAL_POSITIONS.BOARD_ADVISOR;
    case NATIONAL_ACCOUNT_ROLES.EVANGELIST:
      return NATIONAL_POSITIONS.NATIONAL_EVANGELIST;
    case NATIONAL_ACCOUNT_ROLES.SUPPORT_CENTER:
      return NATIONAL_POSITIONS.SUPPORT_CENTER;
    default:
      return null;
  }
}

/**
 * Get the display name for a state position
 */
export function getStatePositionDisplay(role: string | null | undefined): string | null {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  
  switch (normalizedRole) {
    case STATE_ACCOUNT_ROLES.STATE_COORDINATOR:
      return STATE_POSITIONS.STATE_COORDINATOR;
    case STATE_ACCOUNT_ROLES.AREA_REP:
      return STATE_POSITIONS.AREA_REP;
    case STATE_ACCOUNT_ROLES.STATE_TREASURER:
      return STATE_POSITIONS.STATE_TREASURER;
    case STATE_ACCOUNT_ROLES.STATE_KIDS_LEADER:
      return STATE_POSITIONS.STATE_KIDS_LEADER;
    case STATE_ACCOUNT_ROLES.STATE_PRAYER_LEADER:
      return STATE_POSITIONS.STATE_PRAYER_LEADER;
    case STATE_ACCOUNT_ROLES.STATE_RFS_LEAD:
      return STATE_POSITIONS.STATE_RFS_LEAD;
    case STATE_ACCOUNT_ROLES.STATE_WEBMASTER:
      return STATE_POSITIONS.STATE_WEBMASTER;
    case STATE_ACCOUNT_ROLES.GOODIE_REPRESENTATIVE:
      return STATE_POSITIONS.GOODIE_REPRESENTATIVE;
    case STATE_ACCOUNT_ROLES.APPROVED_SPEAKER:
      return STATE_POSITIONS.APPROVED_SPEAKER;
    default:
      return null;
  }
}

/**
 * Get chapter officer roles sorted by hierarchy
 */
export function getChapterOfficerRoles(): string[] {
  return [
    CHAPTER_OFFICER_ROLES.PRESIDENT,
    CHAPTER_OFFICER_ROLES.VICE_PRESIDENT,
    CHAPTER_OFFICER_ROLES.SECRETARY,
    CHAPTER_OFFICER_ROLES.TREASURER,
    CHAPTER_OFFICER_ROLES.ROAD_CAPTAIN,
    CHAPTER_OFFICER_ROLES.RFS_LEAD,
    CHAPTER_OFFICER_ROLES.CHAPLAIN
  ];
}

/**
 * Get all available roles for a given scope
 */
export function getRolesForScope(scope: string): string[] {
  const normalizedScope = String(scope ?? '').trim().toLowerCase();
  
  switch (normalizedScope) {
    case ACCOUNT_SCOPE_TYPES.NATIONAL:
      return [
        NATIONAL_POSITIONS.CEO,
        NATIONAL_POSITIONS.BOARD_MEMBER,
        NATIONAL_POSITIONS.BOARD_ADVISOR,
        NATIONAL_POSITIONS.NATIONAL_EVANGELIST,
        NATIONAL_POSITIONS.SUPPORT_CENTER
      ];
    case ACCOUNT_SCOPE_TYPES.EVANGELIST:
      return [NATIONAL_POSITIONS.NATIONAL_EVANGELIST];
    case ACCOUNT_SCOPE_TYPES.STATE:
      return [
        STATE_POSITIONS.STATE_COORDINATOR,
        STATE_POSITIONS.AREA_REP,
        STATE_POSITIONS.AREA_REP_YOUTH,
        STATE_POSITIONS.AREA_REP_FAST_LANE,
        STATE_POSITIONS.STATE_TREASURER,
        STATE_POSITIONS.STATE_KIDS_LEADER,
        STATE_POSITIONS.STATE_PRAYER_LEADER,
        STATE_POSITIONS.STATE_RFS_LEAD,
        STATE_POSITIONS.STATE_WEBMASTER,
        STATE_POSITIONS.GOODIE_REPRESENTATIVE,
        STATE_POSITIONS.APPROVED_SPEAKER
      ];
    case ACCOUNT_SCOPE_TYPES.CHAPTER:
      return getChapterOfficerRoles();
    default:
      return [];
  }
}

/**
 * Get all state-level roles
 */
export function getAllStateRoles(): string[] {
  return Object.values(STATE_POSITIONS);
}

/**
 * Get all national-level roles
 */
export function getAllNationalRoles(): string[] {
  return Object.values(NATIONAL_POSITIONS);
}

/**
 * Get chapter officer details
 */
export function getChapterOfficerDetails(role: string | null | undefined): (typeof CHAPTER_OFFICER_DESCRIPTIONS)[typeof CHAPTER_OFFICER_ROLES[keyof typeof CHAPTER_OFFICER_ROLES]] | null {
  const normalizedRole = String(role ?? '').trim();
  for (const [key, value] of Object.entries(CHAPTER_OFFICER_ROLES)) {
    if (value === normalizedRole) {
      return CHAPTER_OFFICER_DESCRIPTIONS[value as keyof typeof CHAPTER_OFFICER_DESCRIPTIONS] || null;
    }
  }
  return null;
}

/**
 * Check if a chapter officer role has administrative capabilities
 */
export function isChapterAdminRole(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim();
  return CHAPTER_ADMIN_ROLES.has(normalizedRole);
}

/**
 * Get key responsibilities for a chapter officer role
 */
export function getOfficerResponsibilities(role: string | null | undefined): string[] {
  const details = getChapterOfficerDetails(role);
  return [...(details?.keyResponsibilities ?? [])];
}

/**
 * Check if a chapter officer has financial responsibilities
 */
export function hasFinancialResponsibilities(role: string | null | undefined): boolean {
  const details = getChapterOfficerDetails(role);
  return (details as any)?.financialResponsibilities ?? false;
}

/**
 * Check if a chapter officer has spiritual focus
 */
export function hasSpiritualFocus(role: string | null | undefined): boolean {
  const details = getChapterOfficerDetails(role);
  return (details as any)?.spiritualFocus ?? false;
}

/**
 * Check if a chapter officer has fundraising responsibilities
 */
export function hasFundraisingResponsibilities(role: string | null | undefined): boolean {
  const details = getChapterOfficerDetails(role);
  return (details as any)?.fundraisingResponsibilities ?? false;
}

// ============================================================================
// SUPPORT CENTER TEAM HELPERS
// ============================================================================

/**
 * Check if a role is a support center team member
 */
export function isSupportCenterRole(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return Object.values(NATIONAL_ACCOUNT_ROLES)
    .filter(r => r.includes('support_center'))
    .map(r => r.toLowerCase())
    .includes(normalizedRole);
}

/**
 * Get support center team info by role
 */
export function getSupportCenterTeamInfo(role: string | null | undefined): (typeof SUPPORT_CENTER_TEAMS)[keyof typeof SUPPORT_CENTER_TEAMS] | null {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  
  for (const team of Object.values(SUPPORT_CENTER_TEAMS)) {
    if (team.id.toLowerCase() === normalizedRole) {
      return team;
    }
  }
  
  return null;
}

/**
 * Get all support center teams
 */
export function getAllSupportCenterTeams() {
  return Object.values(SUPPORT_CENTER_TEAMS);
}

/**
 * Get support center team by name
 */
export function getSupportCenterTeamByName(teamName: string): (typeof SUPPORT_CENTER_TEAMS)[keyof typeof SUPPORT_CENTER_TEAMS] | null {
  for (const team of Object.values(SUPPORT_CENTER_TEAMS)) {
    if (team.name.toLowerCase() === teamName.toLowerCase()) {
      return team;
    }
  }
  return null;
}

// ============================================================================
// STATE APPOINTED POSITIONS HELPERS
// ============================================================================

/**
 * Check if a role is a state-appointed position
 */
export function isStateAppointedPosition(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return Object.values(STATE_APPOINTED_POSITIONS).some(
    pos => pos.role.toLowerCase() === normalizedRole
  );
}

/**
 * Get state-appointed position details by role
 */
export function getStateAppointedPositionInfo(role: string | null | undefined): (typeof STATE_APPOINTED_POSITIONS)[keyof typeof STATE_APPOINTED_POSITIONS] | null {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  
  for (const position of Object.values(STATE_APPOINTED_POSITIONS)) {
    if (position.role.toLowerCase() === normalizedRole) {
      return position;
    }
  }
  
  return null;
}

/**
 * Get all state-appointed positions
 */
export function getAllStateAppointedPositions() {
  return Object.values(STATE_APPOINTED_POSITIONS);
}

/**
 * Check if a role requires appointment (not elected)
 */
export function requiresAppointment(role: string | null | undefined): boolean {
  return isStateAppointedPosition(role);
}

/**
 * Get appointment requirements for a state position
 */
export function getAppointmentRequirements(role: string | null | undefined): string[] {
  const position = getStateAppointedPositionInfo(role);
  return [...(position?.appointedBy ?? [])];
}

/**
 * Check if a position is hidden from website
 */
export function isHiddenFromWebsite(role: string | null | undefined): boolean {
  const position = getStateAppointedPositionInfo(role);
  if (position) {
    return !position.visibleOnWebsite;
  }
  return false;
}

/**
 * Get responsibilities for a state-appointed position
 */
export function getStateAppointedResponsibilities(role: string | null | undefined): string[] {
  const position = getStateAppointedPositionInfo(role);
  return [...(position?.responsibilities ?? [])];
}

/**
 * Check if state position has financial responsibility
 */
export function hasStateFinancialResponsibility(role: string | null | undefined): boolean {
  const position = getStateAppointedPositionInfo(role);
  return (position as any)?.financialResponsibility ?? false;
}
