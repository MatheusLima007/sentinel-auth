import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export class LoginDto {
  @ApiProperty({ example: 'demo@local.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Demo@12345' })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message: 'A senha deve conter letra minúscula, maiúscula, número e caractere especial',
  })
  password!: string;

  @ApiProperty({ example: 'demo-web' })
  @IsString()
  @IsNotEmpty()
  appId!: string;
}
