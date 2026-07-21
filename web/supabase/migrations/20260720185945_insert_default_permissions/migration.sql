-- Insert default role permissions
INSERT INTO app."role_permission" (id, role, permissions, description) VALUES
('root-perms', 'root', ARRAY['*'], 'Root superuser has all permissions'),
('ceo-perms', 'ceo', ARRAY['members:view', 'members:create', 'members:update', 'members:delete', 'chapters:view', 'chapters:update', 'chapters:delete', 'officers:approve', 'officers:remove', 'finances:view', 'donations:manage', 'events:create', 'events:update', 'events:delete', 'reports:view', 'permissions:manage'], 'CEO permissions'),
('board-perms', 'board', ARRAY['members:view', 'members:create', 'members:update', 'chapters:view', 'chapters:update', 'officers:approve', 'officers:remove', 'finances:view', 'reports:view', 'permissions:manage'], 'Board member permissions'),
('board_advisor-perms', 'board_advisor', ARRAY['members:view', 'members:create', 'members:update', 'chapters:view', 'officers:approve', 'finances:view', 'reports:view'], 'Board advisor permissions'),
('evangelist-perms', 'evangelist', ARRAY['members:view', 'chapters:view', 'reports:view'], 'National Evangelist permissions'),
('state_coordinator-perms', 'state_coordinator', ARRAY['members:view', 'members:create', 'members:update', 'chapters:view', 'chapters:update', 'officers:approve', 'officers:remove', 'reports:view', 'permissions:manage'], 'State Coordinator permissions'),
('area_rep-perms', 'area_rep', ARRAY['members:view', 'members:create', 'members:update', 'chapters:view', 'officers:approve', 'reports:view', 'permissions:manage'], 'Area Rep permissions'),
('president-perms', 'president', ARRAY['members:view', 'members:create', 'members:update', 'officers:approve', 'officers:remove', 'events:create', 'events:update', 'events:delete', 'reports:view', 'permissions:manage'], 'Chapter President permissions'),
('secretary-perms', 'secretary', ARRAY['members:view', 'members:create', 'members:update', 'officers:view', 'events:create', 'events:update', 'events:delete', 'reports:view'], 'Chapter Secretary permissions'),
('treasurer-perms', 'treasurer', ARRAY['members:view', 'finances:view', 'donations:manage', 'reports:view'], 'Chapter Treasurer permissions'),
('chaplain-perms', 'chaplain', ARRAY['members:view', 'events:view', 'reports:view'], 'Chapter Chaplain permissions'),
('road_captain-perms', 'road_captain', ARRAY['members:view', 'events:create', 'events:update', 'events:delete', 'reports:view'], 'Road Captain permissions'),
('rfs_lead-perms', 'rfs_lead', ARRAY['members:view', 'donations:view', 'reports:view'], 'RFS Lead permissions'),
('member-perms', 'member', ARRAY['members:view', 'events:view'], 'Member permissions'),
('support_center_events-perms', 'support_center_events', ARRAY['events:create', 'events:update', 'events:delete', 'reports:view'], 'Support Center Events permissions'),
('support_center_executive-perms', 'support_center_executive', ARRAY['members:view', 'chapters:view', 'reports:view'], 'Support Center Executive permissions'),
('support_center_facilities-perms', 'support_center_facilities', ARRAY['events:view', 'reports:view'], 'Support Center Facilities permissions'),
('support_center_finance-perms', 'support_center_finance', ARRAY['finances:view', 'donations:manage', 'reports:view'], 'Support Center Finance permissions'),
('support_center_goodies-perms', 'support_center_goodies', ARRAY['donations:manage', 'reports:view'], 'Support Center Goodies permissions'),
('support_center_graphics-perms', 'support_center_graphics', ARRAY['events:view', 'reports:view'], 'Support Center Graphics permissions')
ON CONFLICT (role) DO NOTHING;
