import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly webUrl: string;

  constructor(private config: ConfigService) {
    this.webUrl = config.get('WEB_URL') ?? 'http://localhost:3000';
    this.from   = config.get('SMTP_FROM') ?? 'Support Hub <noreply@supporthub.com>';

    const host = config.get('SMTP_HOST');
    const port = Number(config.get('SMTP_PORT') ?? 587);
    const user = config.get('SMTP_USER');
    const pass = config.get('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host, port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Mail service ready — ${host}:${port}`);
    } else {
      this.logger.warn('SMTP not configured — emails will be skipped');
    }
  }

  async sendTicketCreated(opts: {
    to:            string;
    name:          string;
    ticketNumber:  number;
    ticketTitle:   string;
    projectName:   string;
    trackingToken: string;
  }) {
    if (!this.transporter) return;

    const url = `${this.webUrl}/track/${opts.trackingToken}`;

    await this.send({
      to:      opts.to,
      subject: `[#${opts.ticketNumber}] Seu chamado foi aberto — ${opts.projectName}`,
      html:    this.templateTicketCreated({ ...opts, url }),
    });
  }

  async sendTicketStatusChanged(opts: {
    to:            string;
    name:          string;
    ticketNumber:  number;
    ticketTitle:   string;
    projectName:   string;
    newStatus:     string;
    trackingToken: string;
  }) {
    if (!this.transporter) return;

    const STATUS_LABELS: Record<string, string> = {
      IN_PROGRESS:    'Em andamento',
      WAITING_CLIENT: 'Aguardando sua resposta',
      RESOLVED:       'Resolvido ✅',
      CLOSED:         'Encerrado',
    };

    const label = STATUS_LABELS[opts.newStatus] ?? opts.newStatus;
    const url   = `${this.webUrl}/track/${opts.trackingToken}`;

    await this.send({
      to:      opts.to,
      subject: `[#${opts.ticketNumber}] Status atualizado: ${label}`,
      html:    this.templateStatusChanged({ ...opts, label, url }),
    });
  }

  async sendNewReply(opts: {
    to:            string;
    name:          string;
    ticketNumber:  number;
    ticketTitle:   string;
    agentName:     string;
    preview:       string;
    trackingToken: string;
  }) {
    if (!this.transporter) return;

    const url = `${this.webUrl}/track/${opts.trackingToken}`;

    await this.send({
      to:      opts.to,
      subject: `[#${opts.ticketNumber}] Nova resposta da equipe`,
      html:    this.templateNewReply({ ...opts, url }),
    });
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async send(opts: { to: string; subject: string; html: string }) {
    try {
      await this.transporter!.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${err}`);
    }
  }

  private base(title: string, content: string) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border:2px solid #e4e4e7}
  .header{background:#18181b;padding:24px 32px;border-bottom:2px solid #e4e4e7}
  .header span{color:#fff;font-weight:900;font-size:13px;letter-spacing:.15em;text-transform:uppercase;font-family:monospace}
  .body{padding:32px}
  .badge{display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:#f4f4f5;border:1px solid #e4e4e7;font-family:monospace}
  .btn{display:inline-block;margin-top:24px;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
  .footer{padding:16px 32px;border-top:2px solid #f4f4f5;font-size:11px;color:#71717a;font-family:monospace}
  h2{margin:0 0 16px;font-size:18px;font-weight:900;color:#18181b}
  p{margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6}
  .preview{background:#f4f4f5;border-left:3px solid #18181b;padding:12px 16px;margin:16px 0;font-size:13px;color:#52525b}
</style></head>
<body><div class="wrap">
  <div class="header"><span>Support Hub</span></div>
  <div class="body">${content}</div>
  <div class="footer">Você recebeu este email porque abriu um chamado. Não responda este email.</div>
</div></body></html>`;
  }

  private templateTicketCreated(o: { name: string; ticketNumber: number; ticketTitle: string; projectName: string; url: string }) {
    return this.base('Chamado aberto', `
      <h2>Olá, ${o.name}!</h2>
      <p>Seu chamado foi aberto com sucesso e nossa equipe já foi notificada.</p>
      <span class="badge">#${o.ticketNumber} — ${o.projectName}</span>
      <div class="preview">${o.ticketTitle}</div>
      <p>Você pode acompanhar o status e responder pelo link abaixo, sem precisar criar uma conta.</p>
      <a href="${o.url}" class="btn">Acompanhar chamado</a>
    `);
  }

  private templateStatusChanged(o: { name: string; ticketNumber: number; ticketTitle: string; label: string; url: string }) {
    return this.base('Status atualizado', `
      <h2>Atualização no seu chamado</h2>
      <p>Olá, ${o.name}! O status do seu chamado foi atualizado.</p>
      <span class="badge">#${o.ticketNumber}</span>
      <div class="preview">
        <strong>${o.ticketTitle}</strong><br>
        Novo status: <strong>${o.label}</strong>
      </div>
      <a href="${o.url}" class="btn">Ver chamado</a>
    `);
  }

  private templateNewReply(o: { name: string; ticketNumber: number; ticketTitle: string; agentName: string; preview: string; url: string }) {
    return this.base('Nova resposta', `
      <h2>${o.agentName} respondeu seu chamado</h2>
      <p>Olá, ${o.name}! A equipe deixou uma resposta no seu chamado <strong>#${o.ticketNumber}</strong>.</p>
      <div class="preview">${o.preview.slice(0, 200)}${o.preview.length > 200 ? '...' : ''}</div>
      <a href="${o.url}" class="btn">Ver e responder</a>
    `);
  }
}
