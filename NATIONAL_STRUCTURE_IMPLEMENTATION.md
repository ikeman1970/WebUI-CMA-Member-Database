# CMA National Organization Structure Implementation

## Overview
Updated database and application to support the complete CMA national organization structure per the CMA Handbook.

## National Positions & Structure

### Board Level (9 total)
- **CEO/Chairman** (1): Oversees National Support Center and Evangelist Team
- **Board of Directors** (7): Set vision, review/update policies
- **Board Advisors** (2): Advisory capacity

### Regional Level (6 total)
- **National Evangelists** (6): One per region
  - Region 1 – West
  - Region 2 – Rocky Mountain
  - Region 3 – North Central
  - Region 4 – South Central
  - Region 5 – Northeast
  - Region 6 – Southeast

### Support & Staff
- **Support Center Staff**: Administrative team members

## Database Schema Updates

### Account Model Additions
New role values for `Account.role`:
- `ceo` - CEO/Chairman
- `board` - Board of Directors member
- `board_advisor` - Board Advisor
- `evangelist` - National Evangelist (regional assignment)

New scope type values for `Account.scopeType`:
- `national` - National level (CEO, Board)
- `evangelist` - Regional National Evangelist
- `support_center` - Support staff

### OrgUnit Model
Existing `OrgUnit` table used for organizational hierarchy:
- Parent company tracks national office
- Regional OrgUnits can be linked to National Evangelist accounts
- State-level OrgUnits continue as before

### OfficerAssignment Model
Existing model supports national assignments:
- Regional assignments (region via parent OrgUnit)
- Chapter-level assignments (existing)

## RLS (Row Level Security) Updates

### New Helper Functions
Added to migration `20260720_rls_security.sql`:

```sql
-- Check if current account is a National Evangelist for a specific region
app.is_national_evangelist(region_id)

-- Check if current account is a Board member or CEO
app.is_board_member()

-- Check if current account is the CEO
app.is_ceo()
```

### New Policies
Added RLS policies for national-level access:

**Account Table**:
- `account_board_access` - Board members can view all accounts

**Chapter Table**:
- `chapter_board_access` - Board members can view all chapters
- `chapter_evangelist_access` - Regional Evangelists can view chapters in their region

**Person Table**:
- `person_board_access` - Board members can view all persons
- `person_evangelist_access` - Regional Evangelists can view persons in their region

## Application Code

### New Constants File
Created [web/src/lib/nationalPositions.ts](web/src/lib/nationalPositions.ts) with:

```typescript
// National positions
export const NATIONAL_POSITIONS = {
  CEO: 'CEO/Chairman',
  BOARD_MEMBER: 'Board of Directors',
  BOARD_ADVISOR: 'Board Advisor',
  NATIONAL_EVANGELIST: 'National Evangelist',
  SUPPORT_CENTER: 'Support Center Staff'
};

// Account role values
export const NATIONAL_ACCOUNT_ROLES = {
  CEO: 'ceo',
  BOARD: 'board',
  BOARD_ADVISOR: 'board_advisor',
  EVANGELIST: 'evangelist',
  SUPPORT_CENTER: 'support_center'
};

// Helper functions
export function isAdminRole(role): boolean
export function isNationalPosition(role): boolean
export function getNationalPositionDisplay(role): string
export function getRolesForScope(scope): string[]
```

### Updated Files
Updated admin role checks in:
- `web/src/lib/chapterDirectoryAccess.ts`
- `web/src/lib/reportingAccess.ts`
- `web/src/pages/admin/index.tsx`
- `web/src/pages/api/chapter-groups.ts`
- `web/src/pages/api/member-directory/config.ts`
- `web/src/pages/api/members/index.ts`
- `web/src/pages/api/regions/config.ts`
- `web/src/pages/members/[id].tsx`

All now include new national roles in permission checks:
```typescript
const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',         // Board
  'evangelist'                             // Regional
]);
```

## Account Setup for National Positions

### Creating a CEO Account
```typescript
const account = await prisma.account.create({
  data: {
    email: 'ceo@cmausa.org',
    role: 'ceo',                    // Account.role
    scopeType: 'national',          // Account.scopeType
    accountType: 'internal',
    type: 'admin',
    // ... other fields
  }
});
```

### Creating a Regional National Evangelist Account
```typescript
const regionOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: '1' }  // Region code 1-6
});

const account = await prisma.account.create({
  data: {
    email: 'evangelist-west@cmausa.org',
    role: 'evangelist',             // Account.role
    scopeType: 'evangelist',        // Account.scopeType
    accountType: 'internal',
    type: 'staff',
    orgUnitId: regionOrgUnit.id,   // Link to region OrgUnit
    // ... other fields
  }
});
```

### Creating a Board Member Account
```typescript
const account = await prisma.account.create({
  data: {
    email: 'board-member@cmausa.org',
    role: 'board',                  // Account.role
    scopeType: 'national',          // Account.scopeType
    accountType: 'internal',
    type: 'admin',
    // ... other fields
  }
});
```

## Access Control Summary

| Position | Role | ScopeType | Access |
|----------|------|-----------|--------|
| CEO/Chairman | ceo | national | All data globally |
| Board Member | board | national | All data globally |
| Board Advisor | board_advisor | national | All data globally |
| National Evangelist | evangelist | evangelist | Their region's chapters/members |
| Regional Admin | admin | region | Their region |
| State Admin | admin | state | Their state |
| Chapter Admin | president/secretary | chapter | Their chapter |
| Member | member | (inherited) | Own records + chapter directory |

## Next Steps

1. **Test RLS policies**: Verify access control works correctly at all levels
2. **Update UI**: Add national position selection in user management
3. **Create workflow**: Admin panel for assigning national positions
4. **Documentation**: Add user guides for national-level operations
5. **Audit logging**: Track national-level access and changes

## Migration Application

The RLS migration should be applied when ready:
```bash
npx supabase migration up 20260720_rls_security
# or manually in Supabase dashboard
```

Verify RLS is enabled:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'app';
SELECT policyname FROM pg_policies WHERE tablename = 'Account';
```
