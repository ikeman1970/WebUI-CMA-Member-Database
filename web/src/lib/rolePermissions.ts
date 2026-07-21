/**
 * Role-Based Permission Management
 * 
 * Defines and manages permissions for different organizational roles.
 * Only superusers and board members can modify these permissions.
 * 
 * Permission categories:
 * - Data Access: View/edit members, chapters, finances
 * - Administrative: Approve officers, manage roles, configure settings
 * - Financial: Track donations, manage budgets, access financial reports
 * - Spiritual: Lead prayer, manage chaplain duties
 * - Operational: Manage events, coordinate rides, schedule meetings
 */

export type PermissionAction = 
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'configure';

export type PermissionResource =
  | 'members'
  | 'chapters'
  | 'officers'
  | 'finances'
  | 'donations'
  | 'events'
  | 'meetings'
  | 'roles'
  | 'permissions'
  | 'eligibility_config'
  | 'training'
  | 'prayer_requests'
  | 'reports'
  | 'settings';

export type Permission = `${PermissionResource}:${PermissionAction}`;

/**
 * Default role-to-permission mappings
 * These define base permissions for each organizational role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // National Leadership
  root: [
    // All permissions
    'members:view',
    'members:create',
    'members:update',
    'members:delete',
    'chapters:view',
    'chapters:create',
    'chapters:update',
    'chapters:delete',
    'officers:view',
    'officers:create',
    'officers:update',
    'officers:delete',
    'officers:approve',
    'finances:view',
    'finances:create',
    'finances:update',
    'finances:delete',
    'donations:view',
    'donations:create',
    'donations:update',
    'events:view',
    'events:create',
    'events:update',
    'events:delete',
    'meetings:view',
    'meetings:create',
    'meetings:update',
    'meetings:delete',
    'roles:view',
    'roles:configure',
    'permissions:view',
    'permissions:configure',
    'eligibility_config:view',
    'eligibility_config:configure',
    'training:view',
    'training:update',
    'prayer_requests:view',
    'reports:view',
    'reports:create',
    'settings:view',
    'settings:configure'
  ],

  ceo: [
    // CEO has most permissions except delete system data
    'members:view',
    'members:create',
    'members:update',
    'chapters:view',
    'chapters:create',
    'chapters:update',
    'officers:view',
    'officers:approve',
    'finances:view',
    'donations:view',
    'events:view',
    'meetings:view',
    'roles:view',
    'permissions:view',
    'eligibility_config:view',
    'eligibility_config:configure',
    'training:view',
    'prayer_requests:view',
    'reports:view',
    'settings:view'
  ],

  board: [
    // Board members have oversight permissions
    'members:view',
    'chapters:view',
    'officers:view',
    'officers:approve',
    'finances:view',
    'donations:view',
    'events:view',
    'meetings:view',
    'roles:view',
    'eligibility_config:view',
    'training:view',
    'prayer_requests:view',
    'reports:view'
  ],

  board_advisor: [
    'members:view',
    'chapters:view',
    'officers:view',
    'finances:view',
    'donations:view',
    'events:view',
    'meetings:view',
    'reports:view'
  ],

  evangelist: [
    // National Evangelist - regional oversight
    'members:view',
    'chapters:view',
    'officers:view',
    'events:view',
    'meetings:view',
    'eligibility_config:view',
    'reports:view'
  ],

  // State Leadership
  state_coordinator: [
    'members:view',
    'chapters:view',
    'chapters:update',
    'officers:view',
    'officers:approve',
    'finances:view',
    'donations:view',
    'events:view',
    'meetings:view',
    'eligibility_config:view',
    'eligibility_config:configure',
    'reports:view'
  ],

  area_rep: [
    'members:view',
    'chapters:view',
    'officers:view',
    'events:view',
    'meetings:view',
    'reports:view'
  ],

  state_treasurer: [
    'members:view',
    'finances:view',
    'finances:update',
    'donations:view',
    'donations:create',
    'reports:view',
    'reports:create'
  ],

  state_kids_leader: [
    'members:view',
    'events:view',
    'events:create',
    'events:update',
    'meetings:view',
    'prayer_requests:view'
  ],

  state_prayer_leader: [
    'members:view',
    'prayer_requests:view',
    'prayer_requests:create',
    'meetings:view',
    'meetings:create'
  ],

  state_rfs_lead: [
    'members:view',
    'donations:view',
    'donations:create',
    'donations:update',
    'reports:view',
    'reports:create'
  ],

  state_webmaster: [
    'members:view',
    'chapters:view',
    'officers:view',
    'events:view',
    'reports:view'
  ],

  // Chapter Leadership
  president: [
    'members:view',
    'chapters:view',
    'officers:view',
    'officers:approve',
    'finances:view',
    'donations:view',
    'events:view',
    'events:create',
    'events:update',
    'meetings:view',
    'meetings:create',
    'meetings:update',
    'eligibility_config:view',
    'reports:view'
  ],

  secretary: [
    'members:view',
    'officers:view',
    'events:view',
    'meetings:view',
    'meetings:create',
    'meetings:update',
    'eligibility_config:view',
    'reports:view'
  ],

  treasurer: [
    'members:view',
    'finances:view',
    'finances:update',
    'donations:view',
    'donations:create',
    'reports:view'
  ],

  chaplain: [
    'members:view',
    'prayer_requests:view',
    'prayer_requests:create',
    'meetings:view',
    'meetings:create'
  ],

  road_captain: [
    'members:view',
    'events:view',
    'events:create',
    'events:update'
  ],

  rfs_lead: [
    'donations:view',
    'donations:create',
    'reports:view'
  ],

  // Member (default)
  member: [
    'members:view', // Own record only (enforced by RLS)
    'prayer_requests:view',
    'events:view'
  ]
};

/**
 * Permission descriptions for UI display
 */
export const PERMISSION_DESCRIPTIONS: Partial<Record<Permission, string>> = {
  // Member permissions
  'members:view': 'View member records',
  'members:create': 'Create new member records',
  'members:update': 'Edit member records',
  'members:delete': 'Delete member records',

  // Chapter permissions
  'chapters:view': 'View chapter information',
  'chapters:create': 'Create new chapters',
  'chapters:update': 'Edit chapter information',
  'chapters:delete': 'Delete chapters',

  // Officer permissions
  'officers:view': 'View officer assignments',
  'officers:create': 'Assign officers',
  'officers:update': 'Edit officer assignments',
  'officers:delete': 'Remove officer assignments',
  'officers:approve': 'Approve officer elections/appointments',

  // Finance permissions
  'finances:view': 'View financial records and reports',
  'finances:create': 'Create financial entries',
  'finances:update': 'Edit financial records',
  'finances:delete': 'Delete financial records',

  // Donation permissions
  'donations:view': 'View donation records',
  'donations:create': 'Record donations',
  'donations:update': 'Edit donation records',
  'donations:delete': 'Delete donation records',

  // Event permissions
  'events:view': 'View events',
  'events:create': 'Create new events',
  'events:update': 'Edit events',
  'events:delete': 'Delete events',

  // Meeting permissions
  'meetings:view': 'View meetings',
  'meetings:create': 'Schedule meetings',
  'meetings:update': 'Edit meetings',
  'meetings:delete': 'Cancel meetings',

  // Role permissions
  'roles:view': 'View role definitions',
  'roles:configure': 'Modify role definitions',

  // Permission management
  'permissions:view': 'View permission configurations',
  'permissions:configure': 'Modify permission configurations',

  // Eligibility config
  'eligibility_config:view': 'View eligibility settings',
  'eligibility_config:configure': 'Modify eligibility settings',

  // Training permissions
  'training:view': 'View training records',
  'training:update': 'Record training completion',

  // Prayer permissions
  'prayer_requests:view': 'View prayer requests',
  'prayer_requests:create': 'Submit prayer requests',

  // Report permissions
  'reports:view': 'View reports',
  'reports:create': 'Generate reports',

  // Settings permissions
  'settings:view': 'View application settings',
  'settings:configure': 'Modify application settings'
};

/**
 * Permission groups for easier management
 */
export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  MEMBER_MANAGEMENT: [
    'members:view',
    'members:create',
    'members:update',
    'members:delete'
  ],
  CHAPTER_MANAGEMENT: [
    'chapters:view',
    'chapters:create',
    'chapters:update',
    'chapters:delete'
  ],
  OFFICER_MANAGEMENT: [
    'officers:view',
    'officers:create',
    'officers:update',
    'officers:delete',
    'officers:approve'
  ],
  FINANCIAL_MANAGEMENT: [
    'finances:view',
    'finances:create',
    'finances:update',
    'finances:delete',
    'donations:view',
    'donations:create',
    'donations:update'
  ],
  EVENT_MANAGEMENT: [
    'events:view',
    'events:create',
    'events:update',
    'events:delete',
    'meetings:view',
    'meetings:create',
    'meetings:update',
    'meetings:delete'
  ],
  SYSTEM_ADMINISTRATION: [
    'roles:configure',
    'permissions:configure',
    'settings:configure'
  ],
  REPORTING: [
    'reports:view',
    'reports:create'
  ]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  const permissions = DEFAULT_ROLE_PERMISSIONS[normalizedRole] ?? [];
  return permissions.includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string | null | undefined): Permission[] {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return DEFAULT_ROLE_PERMISSIONS[normalizedRole] ?? [];
}

/**
 * Check if a role has any of the given permissions
 */
export function hasAnyPermission(role: string | null | undefined, permissions: Permission[]): boolean {
  return permissions.some(perm => hasPermission(role, perm));
}

/**
 * Check if a role has all of the given permissions
 */
export function hasAllPermissions(role: string | null | undefined, permissions: Permission[]): boolean {
  return permissions.every(perm => hasPermission(role, perm));
}

/**
 * Get permission description for UI
 */
export function getPermissionDescription(permission: Permission): string {
  return PERMISSION_DESCRIPTIONS[permission] ?? 'Unknown permission';
}

/**
 * Get permissions in a group
 */
export function getPermissionGroup(groupName: string): Permission[] {
  return PERMISSION_GROUPS[groupName] ?? [];
}

/**
 * Check if user can manage permissions (superuser or board only)
 */
/**
 * Check if a user can manage permissions at any level.
 * Permissions grow hierarchically:
 * - Chapter President: manages chapter-level roles
 * - State Coordinator: manages state-level roles + chapters in their state
 * - National Evangelist: manages regional permissions
 * - CEO/Board: manages all permissions nationally
 * - Root/Superuser: full access
 */
export function canManagePermissions(role: string | null | undefined): boolean {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  // Highest authority at each level can manage permissions
  return [
    'root',
    'superuser',
    'ceo',
    'board',
    'board_advisor',
    'evangelist',
    'state_coordinator',
    'area_rep',
    'president' // Chapter presidents can manage their chapter's permissions
  ].includes(normalizedRole);
}

/**
 * Get list of roles that current user can edit, based on hierarchical authority.
 * Permission grows from bottom (chapter) → middle (state) → top (national).
 * 
 * Rules:
 * - Root/Superuser: Can edit ALL roles
 * - CEO/Board: Can edit all roles except root/superuser
 * - National Evangelist: Can edit evangelist roles and support center teams
 * - State Coordinator: Can edit state-level roles and chapter roles in their state
 * - Area Rep: Can edit chapter roles in their state (limited)
 * - Chapter President: Can edit only chapter-level roles
 */
export function getEditableRoles(currentRole: string | null | undefined): string[] {
  const normalizedRole = String(currentRole ?? '').trim().toLowerCase();

  // Root and superuser can modify anything
  if (['root', 'superuser'].includes(normalizedRole)) {
    return Object.keys(DEFAULT_ROLE_PERMISSIONS).filter(
      role => !['root', 'superuser'].includes(role)
    );
  }

  // CEO and board can modify everything except root/superuser
  if (['ceo', 'board', 'board_advisor'].includes(normalizedRole)) {
    return Object.keys(DEFAULT_ROLE_PERMISSIONS).filter(
      role => !['root', 'superuser'].includes(role)
    );
  }

  // National Evangelist can modify evangelist roles and support center teams
  if (normalizedRole === 'evangelist') {
    return ['evangelist', 'support_center_events', 'support_center_executive', 
            'support_center_facilities', 'support_center_finance', 'support_center_goodies', 
            'support_center_graphics'];
  }

  // State Coordinator can modify state-level and chapter-level roles in their state
  if (normalizedRole === 'state_coordinator') {
    return [
      'state_coordinator',
      'area_rep',
      'state_treasurer',
      'state_kids_leader',
      'state_prayer_leader',
      'state_rfs_lead',
      'state_webmaster',
      'president',
      'secretary',
      'treasurer',
      'chaplain',
      'road_captain',
      'rfs_lead'
    ];
  }

  // Area Rep can modify chapter roles in their area
  if (normalizedRole === 'area_rep') {
    return [
      'president',
      'secretary',
      'treasurer',
      'chaplain',
      'road_captain',
      'rfs_lead'
    ];
  }

  // Chapter President can only modify chapter-level roles
  if (normalizedRole === 'president') {
    return [
      'president',
      'secretary',
      'treasurer',
      'chaplain',
      'road_captain',
      'rfs_lead',
      'member'
    ];
  }

  // All others cannot modify permissions
  return [];
}
