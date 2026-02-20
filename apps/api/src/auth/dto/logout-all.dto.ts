import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutAllDto {
  @ApiPropertyOptional({ example: 'demo-web' })
  @IsString()
  @IsOptional()
  appId?: string;
}
