import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canManagePermissions, getEditableRoles, PERMISSION_DESCRIPTIONS } from '@/lib/rolePermissions';

type ErrorResponse = { message: string };

/**
 * API for managing role permissions with hierarchical access control.
 * 
 * Permission grows from bottom to top:
 * - Chapter Presidents: Can adjust chapter-level role permissions
 * - State Coordinators: Can adjust state-level and chapter-level permissions in their state
 * - National Evangelists: Can adjust evangelist and support center team permissions
 * - CEO/Board: Can adjust all permissions nationally
 * - Root/Superuser: Full access
 * 
 * Endpoints:
 * GET /api/permissions - List all role permissions visible to user's level
 * GET /api/permissions?role=roleName - Get specific role permissions (if accessible)
 * POST /api/permissions - Create or update role permissions
 * PUT /api/permissions - Update role permissions
 * DELETE /api/permissions?role=roleName - Reset role to defaults
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Check if user can manage permissions at any level
  if (!canManagePermissions(account.role)) {
    return res.status(403).json({ message: 'Your role does not have permission to manage roles' });
  }

  try {
    if (req.method === 'GET') {
      const { role } = req.query;
      const editableRoles = getEditableRoles(account.role);

      if (role) {
        // Get specific role permissions - must be in user's editable list
        if (!editableRoles.includes(role as string)) {
          return res.status(403).json({ 
            message: `You do not have permission to view permissions for role: ${role}` 
          });
        }

        const rolePerms = await prisma.rolePermission.findUnique({
          where: { role: role as string }
        });

        return res.status(200).json(rolePerms || null);
      } else {
        // Get all role permissions visible to this user's level
        const allRolePerms = await prisma.rolePermission.findMany({
          where: {
            role: {
              in: editableRoles
            }
          },
          orderBy: { role: 'asc' }
        });

        return res.status(200).json(allRolePerms);
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { role, permissions, description } = req.body;

      if (!role || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ message: 'role and permissions array required' });
      }

      // Verify all permissions are valid
      const invalidPermissions = permissions.filter((p: any) => !(p in PERMISSION_DESCRIPTIONS));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({ 
          message: `Invalid permissions: ${invalidPermissions.join(', ')}` 
        });
      }

      // Verify user can edit this role at their level
      const editableRoles = getEditableRoles(account.role);
      if (!editableRoles.includes(role)) {
        return res.status(403).json({ 
          message: `Your role cannot modify permissions for: ${role}. You can only modify: ${editableRoles.join(', ')}` 
        });
      }

      const updated = await prisma.rolePermission.upsert({
        where: { role },
        create: {
          role,
          permissions,
          description,
          updatedBy: account.id
        },
        update: {
          permissions,
          description,
          updatedBy: account.id
        }
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const { role } = req.query;

      if (!role) {
        return res.status(400).json({ message: 'role parameter required' });
      }

      // Verify user can edit this role
      const editableRoles = getEditableRoles(account.role);
      if (!editableRoles.includes(role as string)) {
        return res.status(403).json({ 
          message: `Your role cannot modify permissions for: ${role}. You can only modify: ${editableRoles.join(', ')}` 
        });
      }

      // Delete the role permission (will reset to defaults when queried)
      await prisma.rolePermission.delete({
        where: { role: role as string }
      });

      return res.status(200).json({ message: `Permissions for role ${role} have been reset to defaults` });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Permissions API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
