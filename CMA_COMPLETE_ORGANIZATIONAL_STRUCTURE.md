# CMA Complete Organizational Structure - Implementation Summary

**Date**: 2026-07-20  
**Status**: ✅ COMPLETE (Database & Application Layer Ready)  
**Next Step**: Apply migration to Supabase, then test & validate

## 🎯 What Was Accomplished

Implemented complete CMA organizational hierarchy per official CMA Handbook 2026 into database, RLS policies, and application code:

### Database Layer
- ✅ Created 8 new RLS helper functions (4 national + 4 state-level)
- ✅ Added 6 new RLS policies for national and state-level access control
- ✅ All policies follow RLS default-deny pattern with explicit grants

### Application Layer
- ✅ Extended `nationalPositions.ts` constants with 11 state positions
- ✅ Added state-level permission checking functions
- ✅ Updated 8 files with state leadership roles in admin checks
- ✅ Maintained backward compatibility with existing chapter/member access

### Documentation
- ✅ Created [STATE_LEADERSHIP_IMPLEMENTATION.md](STATE_LEADERSHIP_IMPLEMENTATION.md) - comprehensive state structure guide
- ✅ Updated [NATIONAL_STRUCTURE_IMPLEMENTATION.md](NATIONAL_STRUCTURE_IMPLEMENTATION.md) - national structure reference
- ✅ Updated repository memory with complete organizational hierarchy

---

## 📊 Complete Organizational Hierarchy

### **NATIONAL LEVEL** (Global Access)
```
CEO/Chairman (1)
├── Appointed by: Board of Directors
├── Access: Global - all data
├── Scope: national
└── Role: ceo

Board of Directors (7)
├── Appointed by: CEO + Board approval process
├── Access: Global - all data
├── Scope: national
└── Role: board

Board Advisors (2)
├── Role: board_advisor
└── Scope: national

Support Center Staff (variable)
├── Role: support_center
└── Scope: national
```

### **REGIONAL LEVEL** (Region Access - 6 regions)
```
National Evangelist - Region 1 (West) × 6
├── Appointed by: Vice President of Evangelistic Outreach + Board approval
├── Responsibility: Ministry implementation in region
├── Oversees: All chapters in 6-state region
├── Access: Regional data (6 states)
├── Scope: evangelist
├── Role: evangelist
├── Reports to: CEO & Board
└── Manages: State Coordinators in their region

Goodie Representative (per region)
├── Appointed by: National Evangelist
├── Responsibility: Sell CMA merchandise at regional rallies
├── Scope: Travels across region
├── Role: goodie_rep
└── Access: Sales/inventory at events

Approved Speakers (per region)
├── Appointed by: National Evangelist (1-year term, annual review)
├── Responsibility: Conduct services at secular events
├── Role: approved_speaker
└── Access: Event service scheduling
```

### **STATE LEVEL** (State Access - 50 states + DC)
```
STATE TIER 1 - LEADERSHIP (Appointed by National Evangelist)
├── State Coordinator (1 per state)
│   ├── Responsibility: Maintain vision, develop leaders, coordinate state ministry
│   ├── Manages: State fund, officer training, rallies, events
│   ├── Works with: Area Reps, State Treasurer, Specialists
│   ├── Reports to: National Evangelist (their region)
│   ├── Access: Their state's chapters & members
│   ├── Scope: state
│   └── Role: state_coordinator
│
└── Area Representative (1+ per state, one per ~5 chapters)
    ├── Responsibility: Assistant to State Coordinator, direct chapter connection
    ├── Specialization options:
    │   ├── Area Rep - Youth Movement: Conducts youth events, develops youth leaders
    │   └── Area Rep - Fast Lane: Grows fast lane ministry, oversees fast lane chapters
    ├── Works with: State Coordinator, chapters
    ├── Access: Their state's chapters & members
    ├── Scope: state
    └── Role: area_rep

STATE TIER 2 - SPECIALIST POSITIONS (Appointed by State Coordinator + National Evangelist approval)
├── State Treasurer
│   ├── Responsibility: Manage state fund finances
│   ├── Qualifications: Financial experience, not from Coordinator's household
│   ├── Oversight: Coordinator & National Evangelist
│   ├── Reports: Quarterly financial reports
│   ├── Scope: state
│   └── Role: state_treasurer
│
├── State Kids Leader
│   ├── Scope: state
│   └── Role: state_kids_leader
│
├── State Prayer Leader
│   ├── Scope: state
│   └── Role: state_prayer_leader
│
├── State RFS Lead (Run for the Son)
│   ├── Scope: state
│   └── Role: state_rfs_lead
│
└── State Webmaster
    ├── Scope: state
    └── Role: state_webmaster
```

### **CHAPTER LEVEL** (Chapter Access)
```
President (Elected)
├── Oversees: Chapter operations & leadership
├── Role: president
└── Access: Their chapter's data

Vice President
Secretary (Can also administer chapters)
Treasurer
Road Captain
RFS Lead
Chaplain
└── Role: member (or specific role for officers)
```

### **MEMBER LEVEL** (Own Data)
```
Regular Member
├── Access: Own records + shared chapter directory
└── Role: member
```

---

## 🔐 Access Control Summary

| Level | Position | Role | ScopeType | Access |
|-------|----------|------|-----------|--------|
| **National** | CEO/Chairman | ceo | national | All data globally |
| | Board Member | board | national | All data globally |
| | Board Advisor | board_advisor | national | All data globally |
| | Support Center | support_center | national | Assigned departments |
| **Regional** | National Evangelist | evangelist | evangelist | Region (6 states) |
| | Goodie Rep | goodie_rep | - | Regional rallies |
| | Approved Speaker | approved_speaker | - | Regional services |
| **State** | State Coordinator | state_coordinator | state | State chapters/members |
| | Area Rep | area_rep | state | State chapters/members |
| | Area Rep (Youth) | area_rep | state | Youth chapters |
| | Area Rep (Fast Lane) | area_rep | state | Fast Lane chapters |
| | State Treasurer | state_treasurer | state | State fund records |
| | State Kids Leader | state_kids_leader | state | Youth programs |
| | State Prayer Leader | state_prayer_leader | state | Prayer initiatives |
| | State RFS Lead | state_rfs_lead | state | RFS data |
| | State Webmaster | state_webmaster | state | Web content |
| **Chapter** | President | president | chapter | Their chapter |
| | Secretary | secretary | chapter | Their chapter |
| | Officers | (role) | chapter | Chapter data |
| **Member** | Regular Member | member | - | Own + shared data |

---

## 📁 Implementation Files

### Database
- **[web/supabase/migrations/20260720_rls_security.sql](web/supabase/migrations/20260720_rls_security.sql)**
  - 8 RLS helper functions (national + state)
  - 6 new RLS policies
  - 30+ total policies across 10 tables

### Application Constants
- **[web/src/lib/nationalPositions.ts](web/src/lib/nationalPositions.ts)**
  - NATIONAL_POSITIONS (5 positions)
  - NATIONAL_ACCOUNT_ROLES (5 role values)
  - STATE_POSITIONS (11 positions)
  - STATE_ACCOUNT_ROLES (9 role values)
  - ACCOUNT_SCOPE_TYPES (6 scope types)
  - REGIONS (6 regional definitions)
  - Helper functions (15 exported functions)

### Updated Permission Checks
- `web/src/lib/chapterDirectoryAccess.ts`
- `web/src/lib/reportingAccess.ts`
- `web/src/pages/admin/index.tsx`
- `web/src/pages/api/chapter-groups.ts`
- `web/src/pages/api/member-directory/config.ts`
- `web/src/pages/api/members/index.ts`
- `web/src/pages/api/regions/config.ts`
- `web/src/pages/members/[id].tsx`

### Documentation
- **[STATE_LEADERSHIP_IMPLEMENTATION.md](STATE_LEADERSHIP_IMPLEMENTATION.md)** - Comprehensive state structure guide
- **[NATIONAL_STRUCTURE_IMPLEMENTATION.md](NATIONAL_STRUCTURE_IMPLEMENTATION.md)** - National structure reference
- **[RLS_IMPLEMENTATION_COMPLETE.md](RLS_IMPLEMENTATION_COMPLETE.md)** - RLS details and testing

---

## 🗄️ Database Design

### Account Model
New roles support complete hierarchy:
- `ceo`, `board`, `board_advisor` - National
- `evangelist` - Regional
- `state_coordinator`, `area_rep`, `state_treasurer`, etc. - State
- `president`, `secretary` - Chapter
- `member` - Base membership

New scope types:
- `national` - CEO, Board (global access)
- `evangelist` - Regional Evangelists (6-state region)
- `state` - State Coordinators, Area Reps, Specialists (state-scoped)
- `chapter` - Chapter officers
- `region`, `global`, `support_center` (for special cases)

### OrgUnit Model (Existing)
Used for organizational hierarchy:
- National office at top level
- Regional OrgUnits (6 regions)
- State OrgUnits (50 states + DC)
- Chapter assignments (existing)

**State OrgUnit.code format**: Two-letter state code (CA, TX, FL, etc.)

---

## 🔑 RLS Helper Functions

### National Level
```sql
app.is_national_evangelist(region_id)    -- Region-scoped access
app.is_board_member()                     -- Board/CEO access
app.is_ceo()                               -- CEO-only access
```

### State Level
```sql
app.is_state_coordinator(state_code)     -- State coordinator access
app.is_area_rep(state_code)               -- Area rep access
app.is_state_leader(state_code)           -- Either coordinator or area rep
app.is_state_leadership()                 -- Any state-level position
```

### Existing
```sql
app.is_superuser()                        -- Root/superuser access
app.is_chapter_admin(chapter_id)          -- Chapter admin access
app.is_own_account(account_id)            -- Own account access
```

---

## 📋 Account Creation Reference

### National: CEO
```typescript
await prisma.account.create({
  data: {
    email: 'ceo@cmausa.org',
    role: 'ceo',
    scopeType: 'national',
    orgUnitId: nationalOrgUnit.id,
    // ... other fields
  }
});
```

### Regional: National Evangelist
```typescript
const regionOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: '1' }  // Region 1-6
});

await prisma.account.create({
  data: {
    email: 'evangelist-west@cmausa.org',
    role: 'evangelist',
    scopeType: 'evangelist',
    orgUnitId: regionOrgUnit.id,
    // ... other fields
  }
});
```

### State: State Coordinator
```typescript
const stateOrgUnit = await prisma.orgUnit.findUnique({
  where: { code: 'CA' }  // State code
});

await prisma.account.create({
  data: {
    email: 'coordinator@ca.cmausa.org',
    role: 'state_coordinator',
    scopeType: 'state',
    orgUnitId: stateOrgUnit.id,
    // ... other fields
  }
});
```

### State: Area Representative
```typescript
await prisma.account.create({
  data: {
    email: 'arearep@ca.cmausa.org',
    role: 'area_rep',
    scopeType: 'state',
    orgUnitId: stateOrgUnit.id,
    // ... other fields
  }
});
```

### Chapter: President (Existing Pattern)
```typescript
await prisma.account.create({
  data: {
    email: 'president@chapter.cmausa.org',
    role: 'president',
    scopeType: 'chapter',
    chapterId: chapter.id,
    // ... other fields
  }
});
```

---

## ✅ Testing Checklist

After migration applied to Supabase:

**National Level**
- [ ] CEO can query all chapters/members/accounts globally
- [ ] Board member can query all data
- [ ] National Evangelist can see only their region's data
- [ ] Non-board user cannot see all accounts

**State Level**
- [ ] State Coordinator can see their state's chapters
- [ ] State Coordinator can see their state's members
- [ ] Area Rep can see their state's data
- [ ] State Treasurer can access state fund records
- [ ] State leader cannot see other states' data

**Regional/Chapter**
- [ ] National Evangelist cannot see other regions' data
- [ ] Chapter admin can see their chapter
- [ ] Member can see own + directory records
- [ ] Unauthenticated users get empty results

**Cross-Level**
- [ ] State Coordinator cannot elevate to national access
- [ ] Chapter admin cannot access state-level data
- [ ] Proper role hierarchy enforced

---

## 🚀 Deployment Checklist

1. **[  ] Apply Migration**
   ```bash
   npx supabase migration up 20260720_rls_security
   ```

2. **[  ] Verify RLS Functions**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'app' AND routine_name LIKE '%state%';
   ```

3. **[  ] Test Authentication** (all levels)
   - CEO login
   - National Evangelist login
   - State Coordinator login
   - Area Rep login
   - Chapter admin login
   - Regular member login

4. **[  ] Validate Build**
   ```bash
   npm run build && npm run lint
   ```

5. **[  ] Manual Endpoint Testing**
   - GET /api/chapters (state coordinator)
   - GET /api/members (national evangelist)
   - GET /api/reporting (state treasurer)

6. **[  ] Run Supabase Security Linter**
   - Verify all 9 findings resolved
   - Check RLS policies on all 10 tables

7. **[  ] UI Implementation**
   - Add national position selection to user management
   - Add state position selection to user management
   - Create position assignment workflows

8. **[  ] Documentation Update**
   - User guide for national-level operations
   - User guide for state-level operations
   - Admin guide for position management

---

## 📝 Notes

- **Backward Compatibility**: Existing chapter admin and member access patterns unchanged
- **RLS Default-Deny**: All access explicitly granted (no implicit access)
- **Role Independence**: State roles separate from chapter roles (can coexist)
- **Scope Flexibility**: scopeType enables future expansion (region-only, multi-state, etc.)
- **State Code Format**: Two-letter codes (CA, TX, NY, etc.) for consistency with US standards

---

## 🔗 Related Documentation

- [CMA Handbook 2026-07](https://cmausa.org/handbook) - Source of truth for structure
- [STATE_LEADERSHIP_IMPLEMENTATION.md](STATE_LEADERSHIP_IMPLEMENTATION.md) - Detailed state implementation
- [NATIONAL_STRUCTURE_IMPLEMENTATION.md](NATIONAL_STRUCTURE_IMPLEMENTATION.md) - National implementation
- [RLS_IMPLEMENTATION_COMPLETE.md](RLS_IMPLEMENTATION_COMPLETE.md) - RLS details

---

**Status**: ✅ Implementation Complete - Ready for Supabase deployment and testing
