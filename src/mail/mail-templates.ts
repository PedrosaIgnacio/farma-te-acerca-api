import { EstadoCodigo } from '../common/status.util';

interface SolicitudStatusEmailParams {
  colaboradorNombre: string;
  codigo: EstadoCodigo;
  estadoNombre: string;
  sucursalActual: string;
  sucursalDeseada: string;
  motivo: string;
}

// One intro line per EstadoCodigo, keyed by the stable business key (never
// `nombre`) for the same reason ALLOWED_TRANSITIONS is — renaming an estado's
// display label must never break which copy this picks.
const INTRO_BY_CODIGO: Record<EstadoCodigo, string> = {
  ACTIVA: 'Tu solicitud de cambio de sucursal fue registrada.',
  EN_CURSO: 'Tu solicitud de cambio de sucursal está siendo gestionada.',
  APROBADO:
    '¡Buenas noticias! Tu solicitud de cambio de sucursal fue aprobada.',
  NO_APROBADO: 'Tu solicitud de cambio de sucursal no fue aprobada.',
  FINALIZADA: 'Tu cambio de sucursal se completó.',
  CANCELADA: 'Tu solicitud de cambio de sucursal fue cancelada.',
};

// Mirrors STATUS_STYLES in the frontend (src/data/constants.ts) — same
// Tailwind 100/200/700 shade triplet per estado, hardcoded here as hex since
// the email can't reach into the app's Tailwind config. Keep these two maps
// in sync if a new EstadoCodigo is ever added.
const BADGE_COLORS_BY_CODIGO: Record<
  EstadoCodigo,
  { bg: string; border: string; text: string }
> = {
  ACTIVA: { bg: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
  APROBADO: { bg: '#ede9fe', border: '#ddd6fe', text: '#6d28d9' },
  EN_CURSO: { bg: '#fef3c7', border: '#fde68a', text: '#b45309' },
  FINALIZADA: { bg: '#d1fae5', border: '#a7f3d0', text: '#047857' },
  NO_APROBADO: { bg: '#fee2e2', border: '#fecaca', text: '#b91c1c' },
  CANCELADA: { bg: '#f5f5f4', border: '#e7e5e4', text: '#57534e' },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSolicitudStatusEmail(params: SolicitudStatusEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const {
    colaboradorNombre,
    codigo,
    estadoNombre,
    sucursalActual,
    sucursalDeseada,
    motivo,
  } = params;

  const subject = `Actualización de tu solicitud de cambio de sucursal: ${estadoNombre}`;
  const intro = INTRO_BY_CODIGO[codigo];

  const text = [
    `Hola ${colaboradorNombre},`,
    '',
    intro,
    '',
    `Sucursal actual: ${sucursalActual}`,
    `Sucursal deseada: ${sucursalDeseada}`,
    `Nuevo estado: ${estadoNombre}`,
    `Motivo: ${motivo}`,
    '',
    'Este es un mensaje automático de FarmaTeAcerca, no responder a este correo.',
  ].join('\n');

  const { bg, border, text: badgeText } = BADGE_COLORS_BY_CODIGO[codigo];
  const nombre = escapeHtml(colaboradorNombre);
  const estado = escapeHtml(estadoNombre);
  const actual = escapeHtml(sucursalActual);
  const deseada = escapeHtml(sucursalDeseada);
  const motivoSafe = escapeHtml(motivo);

  const html = `
<div style="background-color:#f4f5f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background-color:#1F7A4D;padding:24px 32px;text-align:center;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">FarmaTeAcerca</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${intro}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;">
          Hola ${nombre}, te avisamos que tu solicitud de cambio de sucursal cambió de estado.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <span style="display:inline-block;background-color:${bg};border:1px solid ${border};border-radius:8px;padding:12px 24px;font-size:18px;font-weight:700;color:${badgeText};">
            ${estado}
          </span>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#6b7280;">Sucursal actual</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;">${actual}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;">Sucursal deseada</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;">${deseada}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;">Motivo</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;">${motivoSafe}</td>
          </tr>
        </table>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">
          Podés ver el detalle completo de tu solicitud ingresando a FarmaTeAcerca.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Este es un mensaje automático de FarmaTeAcerca. No respondas a este correo.
        </p>
      </td>
    </tr>
  </table>
</div>
`.trim();

  return { subject, text, html };
}
