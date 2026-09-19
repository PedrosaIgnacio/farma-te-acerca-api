import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EstadoCodigo } from '../common/status.util';
import { buildSolicitudStatusEmail } from './mail-templates';

interface SendSolicitudStatusChangedParams {
  to: string;
  colaboradorNombre: string;
  codigo: EstadoCodigo;
  estadoNombre: string;
  sucursalActual: string;
  sucursalDeseada: string;
  motivo: string;
}

// Side-effect notifications only — never allowed to throw, since a failed
// send (bad SMTP creds, network hiccup) must not break the PATCH request
// that triggered it. Every public method swallows its own errors and logs.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST');
    const port = configService.get<string>('SMTP_PORT');
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.from = configService.get<string>('SMTP_FROM') ?? user ?? '';

    if (!host || !user || !pass) {
      this.transporter = null;
      this.logger.warn(
        'SMTP not configured — solicitud status-change emails are disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port ?? 587),
      secure: false,
      auth: { user, pass },
    });
  }

  async sendSolicitudStatusChanged(
    params: SendSolicitudStatusChangedParams,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(
        `Skipping status-change email to ${params.to} (SMTP not configured).`,
      );
      return;
    }

    try {
      const { subject, text, html } = buildSolicitudStatusEmail(params);
      await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send status-change email to ${params.to}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
