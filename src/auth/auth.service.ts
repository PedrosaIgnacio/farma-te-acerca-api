import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async login({ legajo, password }: LoginDto) {
    const profile = await this.prisma.profile.findUnique({ where: { legajo } });
    const invalidCredentials = () =>
      new UnauthorizedException('Usuario o contraseña incorrectos.');

    if (!profile || !profile.active) {
      throw invalidCredentials();
    }
    if (profile.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException(
        'Usuario bloqueado por intentos fallidos. Restablecé tu contraseña para continuar.',
      );
    }

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (error || !data.session) {
      const failedAttempts = profile.failedAttempts + 1;
      await this.prisma.profile.update({
        where: { id: profile.id },
        data: { failedAttempts },
      });
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new UnauthorizedException(
          'Usuario bloqueado por intentos fallidos. Restablecé tu contraseña para continuar.',
        );
      }
      throw invalidCredentials();
    }

    if (profile.failedAttempts > 0) {
      await this.prisma.profile.update({
        where: { id: profile.id },
        data: { failedAttempts: 0 },
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        legajo: profile.legajo,
        fullName: profile.fullName,
        role: profile.role,
        email: profile.email,
      },
    };
  }

  async forgotPassword({ email }: ForgotPasswordDto) {
    // Always responds ok regardless of whether the email exists, to avoid
    // leaking which addresses are registered.
    await this.supabase.anon.auth.resetPasswordForEmail(email);
    return { ok: true };
  }

  async resetPassword({ email, code, newPassword }: ResetPasswordDto) {
    const { data, error } = await this.supabase.anon.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (error || !data.user) {
      throw new BadRequestException('Código inválido o expirado.');
    }

    const { error: updateError } =
      await this.supabase.admin.auth.admin.updateUserById(data.user.id, {
        password: newPassword,
      });
    if (updateError) {
      throw new BadRequestException('No se pudo actualizar la contraseña.');
    }

    // Resetting the password is the case de uso's documented unlock path for
    // an account blocked by failed login attempts.
    await this.prisma.profile.updateMany({
      where: { email },
      data: { failedAttempts: 0 },
    });

    return { ok: true };
  }
}
