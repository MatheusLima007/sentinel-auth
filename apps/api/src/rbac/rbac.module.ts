import { Module } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from './rbac.service';

@Module({
  providers: [PermissionsGuard, RbacService],
  exports: [PermissionsGuard, RbacService],
})
export class RbacModule {}
