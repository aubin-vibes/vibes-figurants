import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { cessionArrayBuffer } from '@/lib/cessionPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Construit le corps HTML du mail de confirmation.
function buildHtml({ rec, project }) {
  const turq = '#00B89A';
  const prenom = esc(rec.first_name);
  const dateLine = project.shoot_date ? `<tr><td style="padding:4px 0;color:#888">Date de tournage</td><td style="padding:4px 0;text-align:right;font-weight:600">${esc(project.shoot_date)}</td></tr>` : '';
  const lieuLine = project.location ? `<tr><td style="padding:4px 0;color:#888">Lieu</td><td style="padding:4px 0;text-align:right;font-weight:600">${esc(project.location)}</td></tr>` : '';
  const instr = project.instructions
    ? `<div style="margin-top:22px"><div style="font-size:13px;font-weight:700;color:${turq};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Instructions de tournage</div><div style="font-size:14px;line-height:1.6;color:#333;white-space:pre-wrap">${esc(project.instructions)}</div></div>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif;color:#1D1D1B">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#1D1D1B;border-radius:14px 14px 0 0;padding:22px 24px">
      <div style="font-size:26px;letter-spacing:2px;color:${turq};font-weight:800">VIBES</div>
      <div style="font-size:12px;color:#9a9a95;margin-top:2px">Production vidéo · Lyon</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:24px;border:1px solid #e5e5e0;border-top:none">
      <div style="display:inline-block;background:rgba(0,184,154,.12);color:${turq};border-radius:99px;padding:6px 14px;font-size:13px;font-weight:700">✓ Participation validée</div>
      <h1 style="font-size:21px;margin:16px 0 6px">Merci ${prenom} !</h1>
      <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 18px">
        Ton autorisation de droit à l'image pour le tournage <b>${esc(project.name)}</b> est bien enregistrée,
        et ta participation en tant que <b>${esc(rec.role)}</b> est confirmée.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #eee;border-bottom:1px solid #eee">
        <tr><td style="padding:8px 0 4px;color:#888">Projet</td><td style="padding:8px 0 4px;text-align:right;font-weight:600">${esc(project.name)}</td></tr>
        ${dateLine}
        ${lieuLine}
      </table>
      ${instr}
      <p style="font-size:13px;line-height:1.6;color:#555;margin:22px 0 0">
        Tu trouveras en pièce jointe ton autorisation signée, à conserver.
        Pour toute question, réponds simplement à ce mail.
      </p>
      <p style="font-size:14px;color:#333;margin:18px 0 0">À très vite sur le plateau,<br><b>L'équipe VIBES</b></p>
    </div>
    <div style="text-align:center;color:#aaa;font-size:11px;margin-top:14px">VIBES SAS · SIRET 919 517 755 00014 · Lyon</div>
  </div></body></html>`;
}

function buildText({ rec, project }) {
  const lines = [
    `Merci ${rec.first_name} !`,
    '',
    `Ton autorisation de droit à l'image pour le tournage "${project.name}" est bien enregistrée, et ta participation en tant que ${rec.role} est confirmée.`,
    '',
    `Projet : ${project.name}`,
  ];
  if (project.shoot_date) lines.push(`Date de tournage : ${project.shoot_date}`);
  if (project.location) lines.push(`Lieu : ${project.location}`);
  if (project.instructions) { lines.push('', 'INSTRUCTIONS DE TOURNAGE', project.instructions); }
  lines.push('', 'Ton autorisation signée est en pièce jointe.', '', 'À très vite sur le plateau,', "L'équipe VIBES");
  return lines.join('\n');
}

export async function POST(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ ok: false, error: 'id manquant' }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gUser = process.env.GMAIL_USER;
    const gPass = process.env.GMAIL_APP_PASSWORD;

    // Si l'email n'est pas encore configuré, on ne bloque pas l'inscription : on ignore proprement.
    if (!serviceKey || !gUser || !gPass) {
      return Response.json({ ok: false, skipped: 'email non configuré (variables manquantes)' });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: rec, error: e1 } = await admin.from('figurants').select('*').eq('id', id).single();
    if (e1 || !rec) return Response.json({ ok: false, error: 'figurant introuvable' }, { status: 404 });
    if (!rec.email) return Response.json({ ok: true, skipped: 'pas d email' });

    const { data: project } = await admin.from('projects').select('*').eq('id', rec.project_id).single();
    const proj = project || { name: '' };

    const pdf = Buffer.from(cessionArrayBuffer(rec, proj));

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: gUser, pass: gPass },
    });

    await transporter.sendMail({
      from: `VIBES <${gUser}>`,
      to: rec.email,
      subject: `Ta participation au tournage ${proj.name} est validée ✓`,
      text: buildText({ rec, project: proj }),
      html: buildHtml({ rec, project: proj }),
      attachments: [{
        filename: `Cession_${(rec.last_name || '').replace(/\s+/g, '_')}_${(rec.first_name || '').replace(/\s+/g, '_')}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      }],
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
