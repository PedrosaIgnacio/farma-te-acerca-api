import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    // Delegates verification to Supabase itself (works regardless of whether
    // the token came from password login or the Azure/365 SSO provider, and
    // regardless of which key algorithm the project uses to sign tokens).
    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user?.email) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    // Looked up by email, not by matching ids, so both password-provisioned
    // and SSO-first Supabase users resolve to the same Profile row.
    const profile = await this.prisma.profile.findUnique({
      where: { email: data.user.email },
    });
    if (!profile || !profile.active) {
      throw new UnauthorizedException(
        'No hay un colaborador activo asociado a esta cuenta.',
      );
    }

    request.user = {
      id: profile.id,
      legajo: profile.legajo,
      fullName: profile.fullName,
      role: profile.role,
      email: profile.email,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
