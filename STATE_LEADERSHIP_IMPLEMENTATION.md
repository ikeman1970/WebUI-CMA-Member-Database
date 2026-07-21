# State Leadership Structure Implementation

## Overview
Updated database and application to support the complete CMA state leadership hierarchy per the CMA Handbook.

## State Leadership Positions

### Tier 1: State Leadership (Appointed by National Evangelist)
- **State Coordinator**: Primary state leader, manages vision/fund/events. Supported by Area Reps.
- **Area Representative**: Assistant to State Coordinator, direct connection to chapters
  - May specialize: Youth Movement (youth events) or Fast Lane (motorcycle ministry focus)

### Tier 2: Specialist Positions (Appointed by State Coordinator with National Evangelist Approval)
- **State Treasurer**: Manages state fund finances (must be experienced, not related to coordinator)
- **State Kids Leader**: Coordinates youth ministry activities
- **State Prayer Leader**: Coordinates prayer initiatives
- **State RFS Lead**: Leads Run for the Son fundraising efforts
- **State Webmaster**: Maintains state and chapter websites

### Tier 3: Regional Specialists (Appointed by National Evangelist)
- **Goodie Representative**: Sells CMA merchandise at regional rallies (travels to events)
- **Approved Speaker**: Conducts services at secular events (1-year appointment, annual review)

## Database Schema

### Account Model Additions
New role values for `Account.role` (state-level):
```
'state_coordinator'       - State Coordinator
'area_rep'                - Area Representative
'state_treasurer'         - State Treasurer
'state_kids_leader'       - State Kids Leader
'state_prayer_leader'     - State Prayer Leader
'state_rfs_lead'          - State RFS Lead
'state_webmaster'         - State Webmaster
'goodie_rep'              - Goodie Representative
'approved_speaker'        - Approved Speaker
```

New scope type value for `Account.scopeType`:
```
'state'                   - State-level access (State Coordinator, Area Rep, Specialist roles)
```

### OrgUnit Model
State leadership positions are linked via:
- Account.orgunitId → OrgUnit.id (points to state-level OrgUnit)
- OrgUnit.code contains state code (e.g., 'CA', 'TX')
- Parent OrgUnit points to regional structure

## RLS (Row Level Security) Updates

### New Helper Functions
Added to migration `20260720_rls_security.sql`:

```sql
-- Check if current account is a State Coordinator for a specific state
app.is_state_coordinator(state_code) RETURNS boolean

-- Check if current account is an Area Rep for a specific state
app.is_area_rep(state_code) RETURNS boolean

-- Check if current account is a state-level leader (coordinator or area rep)
app.is_state_leader(state_code) RETURNS boolean

-- Check if current account holds any state-level leadership position
app.is_state_leadership() RETURNS boolean
```

### New Policies
Added RLS policies for state-level access:

**Chapter Table**:
- `chapter_state_leader_access` - State coordinators and area reps can view their state's chapters

**Person Table**:
- `person_state_leader_access` - State leaders can view their state's members

## Application Code

### Constants File
Enhanced [web/src/lib/nationalPositions.ts](web/src/lib/nationalPositions.ts) with:

```typescript
// State positions display names
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
};

// Account role values
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
};

// Helper functions
export function isStatePosition(role): boolean
export function getStatePositionDisplay(role): string
export function getAllStateRoles(): string[]
```

### Updated Admin Role Checks
All 8 files now recognize state-level roles in permission checks:
- chapterDirectoryAccess.ts, reportingAccess.ts
- admin/index.tsx, chapter-groups.ts, member-directory/config.ts, members/index.ts, regions/config.ts, members/[id].tsx

Updated admin roles now include:
```
'state_coordinator', 'area_rep'  // State-level
```

## Account Setup Examples

### Creating a State Coordinator Account
```typescript
const stateOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: 'CA' }  // or any state code
});

const account = await prisma.account.create({
  data: {
    email: 'coordinator@ca.cmausa.org',
    role: 'state_coordinator',      // Account.role
    scopeType: 'state',             // Account.scopeType
    accountType: 'internal',
    type: 'admin',
    orgUnitId: stateOrgUnit.id,    // Link to state OrgUnit
    // ... other fields
  }
});
```

### Creating an Area Representative Account
```typescript
const stateOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: 'TX' }  // State code
});

const account = await prisma.account.create({
  data: {
    email: 'arearep@tx.cmausa.org',
    role: 'area_rep',               // Account.role
    scopeType: 'state',             // Account.scopeType
    accountType: 'internal',
    type: 'staff',
    orgUnitId: stateOrgUnit.id,    // Link to state OrgUnit
    // ... other fields
  }
});
```

### Creating a State Treasurer Account
```typescript
const stateOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: 'FL' }  // State code
});

const account = await prisma.account.create({
  data: {
    email: 'treasurer@fl.cmausa.org',
    role: 'state_treasurer',        // Account.role
    scopeType: 'state',             // Account.scopeType
    accountType: 'internal',
    type: 'staff',
    orgUnitId: stateOrgUnit.id,    // Link to state OrgUnit
    // ... other fields
  }
});
```

### Creating Specialist Position Accounts
```typescript
// State Kids Leader
const account = await prisma.account.create({
  data: {
    email: 'kids-leader@ca.cmausa.org',
    role: 'state_kids_leader',      // Any specialist role
    scopeType: 'state',
    accountType: 'internal',
    type: 'staff',
    orgUnitId: stateOrgUnit.id,
    // ... other fields
  }
});
```

## Access Control Matrix

| Position | Role | ScopeType | Access Level |
|----------|------|-----------|--------------|
| State Coordinator | state_coordinator | state | Their state + sub-chapters |
| Area Representative | area_rep | state | Their state + assigned chapters |
| Area Rep (Youth) | area_rep | state | Youth chapters in state |
| Area Rep (Fast Lane) | area_rep | state | Fast Lane chapters in state |
| State Treasurer | state_treasurer | state | Financial records (state fund) |
| State Kids Leader | state_kids_leader | state | Youth programs in state |
| State Prayer Leader | state_prayer_leader | state | Prayer initiatives in state |
| State RFS Lead | state_rfs_lead | state | Run for the Son data in state |
| State Webmaster | state_webmaster | state | Website content for state |
| Goodie Representative | goodie_rep | region | Merchandise sales across region |
| Approved Speaker | approved_speaker | region | Service assignments in region |
| National Evangelist | evangelist | evangelist | Their entire region (6 states) |
| Board Member | board | national | All data globally |
| CEO | ceo | national | All data globally |

## Organizational Hierarchy

```
National Level (Board)
├── CEO/Chairman (1)
├── Board of Directors (7)
├── Board Advisors (2)
└── Support Center Staff

Regional Level
└── National Evangelist × 6 (one per region)
    └── Region Manager/Support

State Level (per state)
├── State Coordinator (reports to National Evangelist)
│   ├── Area Representatives (n)
│   │   ├── Area Rep - Youth Movement (optional)
│   │   └── Area Rep - Fast Lane (optional)
│   └── Specialists:
│       ├── State Treasurer
│       ├── State Kids Leader
│       ├── State Prayer Leader
│       ├── State RFS Lead
│       └── State Webmaster
├── Goodie Representative (regional, travels)
└── Approved Speakers (regional, conduct services)

Chapter Level (per chapter)
├── President
├── Vice President
├── Secretary
├── Treasurer
├── Road Captain
├── RFS Lead
└── Chaplain
```

## Key Design Decisions

1. **Separate from Chapter Admin**: State roles are distinct from chapter officers. A state coordinator can approve but not directly manage chapter affairs.

2. **State Treasurer Independence**: State Treasurer cannot be from State Coordinator's household, ensuring financial oversight and accountability.

3. **Role Specialization**: Area Reps can specialize (Youth/Fast Lane) while maintaining base responsibilities, allowing focused ministry development.

4. **Goodie Rep Mobility**: Goodie Representative operates at regional level, serving multiple states (travels to rallies).

5. **RLS by State Code**: All state-level policies use state code for access control (enables future state-specific customization).

## Testing Checklist

- [ ] State Coordinator can see their state's chapters and members
- [ ] Area Rep can see assigned chapters in their state
- [ ] State Specialist roles can access their area (kids, prayer, RFS, etc.)
- [ ] State leaders cannot see other states' data
- [ ] National Evangelist can see state leaders and data in their region
- [ ] Board members can see all state data
- [ ] Chapter admins cannot elevate to state access
- [ ] State Treasurer has read/write access to state fund records

## Next Steps

1. **Apply migration to Supabase** when ready
2. **Manual RLS testing** with state-level credentials
3. **Build validation** (`npm run build`)
4. **UI implementation** for assigning state positions in user management
5. **State-specific features** (state fund tracking, event coordination, reporting)
6. **Quarterly report workflows** for state leaders

## State Fund Management

The State Fund is managed by:
- **State Coordinator**: Allocates and approves spending
- **State Treasurer**: Administers and records transactions
- **National Evangelist**: Approves major allocations and provides oversight

Income sources:
- 40% of Run for the Son proceeds (nationally) → distributed by participation
- Example: State with $10,000 RFS × 40% = $4,000 × 7.5% (state portion) = $300

Typical expenses funded by State Fund:
- Booth rentals at secular events
- Insurance and event deposits
- ToolBox materials
- CMA activity events
- Rally supplies
- Hospitality materials
- Seasonal event costs (Seasons of Refreshing, State Rally)

## Migration Application

The RLS migration should be applied when ready:
```bash
npx supabase migration up 20260720_rls_security
```

Verify state-level functions:
```sql
-- Check that state-level functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'app' 
AND routine_name LIKE 'is_state%';

-- Should return: is_state_coordinator, is_state_leadership, is_state_leader, is_area_rep
```
