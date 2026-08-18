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
import { AuthenticatedUser } from './types';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async login({ legajo, password }: LoginDto) {
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { legajo },
      include: { rol: true },
    });
    const invalidCredentials = () =>
      new UnauthorizedException('Usuario o contraseña incorrectos.');

    if (!colaborador || !colaborador.activo) {
      throw invalidCredentials();
    }
    if (colaborador.intentosFallidos >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException(
        'Usuario bloqueado por intentos fallidos. Restablecé tu contraseña para continuar.',
      );
    }

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: colaborador.email,
      password,
    });

    if (error || !data.session) {
      const intentosFallidos = colaborador.intentosFallidos + 1;
      await this.prisma.colaborador.update({
        where: { id: colaborador.id },
        data: { intentosFallidos },
      });
      if (intentosFallidos >= MAX_FAILED_ATTEMPTS) {
        throw new UnauthorizedException(
          'Usuario bloqueado por intentos fallidos. Restablecé tu contraseña para continuar.',
        );
      }
      throw invalidCredentials();
    }

    if (colaborador.intentosFallidos > 0) {
      await this.prisma.colaborador.update({
        where: { id: colaborador.id },
        data: { intentosFallidos: 0 },
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        legajo: colaborador.legajo,
        fullName: colaborador.nombre,
        role: colaborador.rol.nombre,
        email: colaborador.email,
      },
    };
  }

  // Current branch isn't part of `AuthenticatedUser` (the guard populates
  // that on every request; this query only runs for `GET /auth/me`, which
  // is the one place the frontend needs it — to pre-fill and lock
  // NewRequestPage's "sucursal actual" select, since a collaborator can't
  // request a relocation from a branch they don't belong to).
  async me(user: AuthenticatedUser) {
    const asignacion = await this.prisma.colabSucursal.findFirst({
      where: { colabId: user.id, activo: true },
      include: { sucursal: true },
    });

    return {
      ...user,
      currentBranchId: asignacion?.sucursal.id ?? null,
      currentBranch: asignacion?.sucursal.nombre ?? null,
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
    await this.prisma.colaborador.updateMany({
      where: { email },
      data: { intentosFallidos: 0 },
    });

    return { ok: true };
  }
}
