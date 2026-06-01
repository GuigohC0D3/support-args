import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@support-hub/database';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  MASTER_ADMIN: 4,
  ORG_ADMIN: 3,
  SUPPORT_AGENT: 2,
  CLIENT: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException();

    if (user.isMasterAdmin) return true;

    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

    if (minRequired >= ROLE_HIERARCHY.MASTER_ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const { params } = context.switchToHttp().getRequest();
    const orgId = params.orgId;

    const membership = (user.organizations as Array<{ organizationId: string; role: UserRole; acceptedAt: Date | null }>)?.find(
      (o) => o.organizationId === orgId && o.acceptedAt !== null,
    );

    const userLevel = ROLE_HIERARCHY[membership?.role as UserRole] ?? 0;
    if (userLevel < minRequired) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
