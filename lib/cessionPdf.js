import { jsPDF } from 'jspdf';

export function ageFrom(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

// Dessine une cession complète sur la page courante du document jsPDF
export function layoutCession(doc, rec, project) {
  const M = 48, W = 595, RW = W - 2 * M;
  let y = 56;
  const age = ageFrom(rec.dob);
  const proj = project || {};

  doc.setTextColor(29, 29, 27);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('VIBES', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 105);
  doc.text('Production video specialisee danse — Lyon', M + 52, y);
  y += 8;
  doc.setDrawColor(0, 184, 154); doc.setLineWidth(1.4); doc.line(M, y, W - M, y); y += 20;

  doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text("AUTORISATION DE DROIT A L'IMAGE — FIGURANT", M, y); y += 20;

  doc.setFontSize(9);
  const pblock = [
    ['Beneficiaire', 'VIBES SAS — SIRET 919 517 755 00014 — Lyon'],
    ['Projet', proj.name || ''],
  ];
  if (proj.shoot_date) pblock.push(['Date de tournage', String(proj.shoot_date)]);
  if (proj.location) pblock.push(['Lieu', proj.location]);
  pblock.push(['Role', rec.role || '']);
  pblock.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(k + ' :', M, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(v), M + 100, y); y += 15;
  });

  y += 6; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Identite', M, y); y += 15;
  doc.setFontSize(9);
  [
    ['Nom / Prenom', (rec.last_name || '').toUpperCase() + ' ' + (rec.first_name || '')],
    ['Ne(e) le', (rec.dob || '') + (age != null ? '  (' + age + ' ans)' : '')],
    ['Email', rec.email || ''],
    ['Telephone', rec.phone || ''],
  ].forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(k + ' :', M, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(v), M + 100, y); y += 14;
  });

  y += 8; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text("Objet de l'autorisation", M, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const consent = "J'autorise VIBES SAS a capter, fixer, reproduire et diffuser mon image et ma voix enregistrees lors du tournage du projet ci-dessus, sur tout support (reseaux sociaux, site internet, plateformes de diffusion, projections, festivals, supports de promotion), pour le monde entier. Cette autorisation est consentie a titre gratuit ; je renonce a toute remuneration. Mes images ne seront pas utilisees dans un contexte prejudiciable ou portant atteinte a ma dignite. Mes donnees (identite, coordonnees, image) sont traitees par VIBES SAS pour la gestion du projet ; je dispose d'un droit d'acces, de rectification et d'effacement (RGPD).";
  const lines = doc.splitTextToSize(consent, RW);
  doc.text(lines, M, y); y += lines.length * 12 + 8;

  doc.setFont('helvetica', 'bold'); doc.text('"Lu et approuve, bon pour accord"', M, y); y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text('Signe electroniquement le ' + new Date(rec.created_at).toLocaleString('fr-FR'), M, y); y += 16;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Signature du figurant :', M, y); y += 4;
  if (rec.signature) { try { doc.addImage(rec.signature, 'PNG', M, y, 180, 64); } catch (e) {} }
  doc.setDrawColor(200); doc.setLineWidth(0.5); doc.rect(M, y, 180, 64); y += 64 + 16;

  if (rec.guardian_signature || rec.guardian_name) {
    doc.setDrawColor(255, 138, 61); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 14;
    doc.setTextColor(200, 90, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('ACCORD DU REPRESENTANT LEGAL (figurant mineur)', M, y); y += 14;
    doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'normal');
    doc.text('Representant : ' + (rec.guardian_name || '') + '  (' + (rec.guardian_relation || '') + ')  ·  Tel : ' + (rec.guardian_phone || ''), M, y); y += 14;
    doc.setFont('helvetica', 'bold'); doc.text('Signature du representant legal :', M, y); y += 4;
    if (rec.guardian_signature) { try { doc.addImage(rec.guardian_signature, 'PNG', M, y, 180, 64); } catch (e) {} }
    doc.setDrawColor(200); doc.rect(M, y, 180, 64); y += 64 + 10;
  }

  doc.setTextColor(140); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
  doc.text('Document genere automatiquement par VIBES. Modele indicatif — pour une exploitation commerciale, faire valider par un conseil juridique.', M, 815, { maxWidth: RW });
}

export function downloadOne(rec, project) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  layoutCession(doc, rec, project);
  doc.save('Cession_' + (rec.last_name || '') + '_' + (rec.first_name || '') + '.pdf');
}

// Génère la cession en mémoire (ArrayBuffer) — utilisé côté serveur pour la pièce jointe email.
export function cessionArrayBuffer(rec, project) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  layoutCession(doc, rec, project);
  return doc.output('arraybuffer');
}

// Feuille d'émargement : tableau paysage listant tous les figurants + leurs infos,
// avec une colonne signature vierge pour l'émargement papier le jour du tournage.
export function downloadEmargement(records, project) {
  if (!records || !records.length) return;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const PW = 842, PH = 595, M = 32, ROWH = 22;
  const proj = project || {};

  const cols = [
    { k: '#', w: 26 },
    { k: 'Nom Prenom', w: 150 },
    { k: 'Role', w: 60 },
    { k: 'Ne(e) le', w: 84 },
    { k: 'Telephone', w: 86 },
    { k: 'Email', w: 168 },
    { k: 'Pres.', w: 40 },
    { k: 'Signature', w: 0 },
  ];
  const used = cols.reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = (PW - 2 * M) - used;
  const xs = []; let xacc = M; cols.forEach((c) => { xs.push(xacc); xacc += c.w; });
  const edges = [...xs, PW - M];

  const rows = records.slice().sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));

  function fit(txt, maxw) {
    txt = String(txt || '');
    if (doc.getTextWidth(txt) <= maxw) return txt;
    while (txt.length > 1 && doc.getTextWidth(txt + '…') > maxw) txt = txt.slice(0, -1);
    return txt + '…';
  }
  function pageHeader() {
    let y = 40;
    doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('VIBES', M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 105);
    doc.text("Feuille d'emargement", M + 50, y);
    y += 6; doc.setDrawColor(0, 184, 154); doc.setLineWidth(1.4); doc.line(M, y, PW - M, y); y += 18;
    doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text("FEUILLE D'EMARGEMENT", M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 86);
    const meta = [proj.name, proj.shoot_date, proj.location].filter(Boolean).join('  -  ');
    if (meta) doc.text(meta, M, y + 14);
    doc.text(rows.length + ' inscrit(s)', PW - M, y + 14, { align: 'right' });
    return y + 28;
  }
  function tableHead(y) {
    doc.setFillColor(29, 29, 27); doc.rect(M, y, PW - 2 * M, ROWH, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    cols.forEach((c, i) => doc.text(c.k, xs[i] + 5, y + 14));
    doc.setDrawColor(210); doc.setLineWidth(0.5);
    edges.forEach((xx) => doc.line(xx, y, xx, y + ROWH));
    return y + ROWH;
  }

  let y = pageHeader();
  y = tableHead(y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  rows.forEach((r, idx) => {
    if (y + ROWH > PH - 28) { doc.addPage(); y = pageHeader(); y = tableHead(y); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
    if (idx % 2 === 1) { doc.setFillColor(245, 245, 242); doc.rect(M, y, PW - 2 * M, ROWH, 'F'); }
    const cells = [
      String(idx + 1),
      ((r.last_name || '').toUpperCase() + ' ' + (r.first_name || '')),
      r.role || '',
      (r.dob || '') + (r.is_minor ? ' (mineur)' : ''),
      r.phone || '',
      r.email || '',
      r.present ? 'OUI' : '',
      '',
    ];
    doc.setTextColor(29, 29, 27);
    cells.forEach((txt, i) => {
      if (i === 6 && r.present) doc.setTextColor(0, 150, 120);
      doc.text(fit(txt, cols[i].w - 8), xs[i] + 5, y + 14);
      if (i === 6) doc.setTextColor(29, 29, 27);
    });
    doc.setDrawColor(210); doc.setLineWidth(0.5);
    edges.forEach((xx) => doc.line(xx, y, xx, y + ROWH));
    doc.line(M, y + ROWH, PW - M, y + ROWH);
    y += ROWH;
  });

  doc.setTextColor(140); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
  doc.text('Document genere par VIBES — donnees personnelles, usage interne uniquement.', M, PH - 16);
  doc.save('Emargement_' + ((proj.name || 'projet').replace(/\s+/g, '_')) + '.pdf');
}

export function downloadAll(records, project) {
  if (!records || !records.length) return;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  records.forEach((r, i) => { if (i > 0) doc.addPage(); layoutCession(doc, r, project); });
  doc.save('Autorisations_' + ((project && project.name) || 'projet').replace(/\s+/g, '_') + '.pdf');
}
