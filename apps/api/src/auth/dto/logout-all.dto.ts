import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutAllDto {
  @ApiPropertyOptional({ example: 'demo-web' })
  @IsString()
  @IsOptional()
  appId?: string;
}
