import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RbacModule } from '../rbac/rbac.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAccessStrategy],
  exports: [AuthService],
})
export class AuthModule {}
