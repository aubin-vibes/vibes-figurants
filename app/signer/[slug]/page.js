'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/components/SignaturePad';
import { ageFrom } from '@/lib/cessionPdf';

export default function SignerPage() {
  const { slug } = useParams();
  const [project, setProject] = useState(undefined); // undefined = loading, null = not found
  const [role, setRole] = useState('Figurant');
  const [f, setF] = useState({ first_name: '', last_name: '', dob: '', email: '', phone: '', g_name: '', g_relation: '', g_phone: '' });
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const sig = useRef(null);
  const gsig = useRef(null);

  const age = ageFrom(f.dob);
  const minor = age != null && age < 18;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('projects').select('id,name,slug,shoot_date,location').eq('slug', slug).maybeSingle();
      setProject(data || null);
    })();
  }, [slug]);

  function upd(k, v) { setF((s) => ({ ...s, [k]: v })); }

  async function submit() {
    setErr('');
    const need = ['first_name', 'last_name', 'dob', 'email', 'phone'];
    if (need.some((k) => !f[k].trim())) return setErr('Merci de remplir tous les champs obligatoires.');
    if (!/.+@.+\..+/.test(f.email)) return setErr("L'email ne semble pas valide.");
    if (!consent) return setErr("Tu dois accepter l'autorisation de droit à l'image.");
    if (sig.current.isEmpty()) return setErr('Ta signature est obligatoire.');
    let g = {};
    if (minor) {
      if (!f.g_name.trim() || !f.g_relation.trim() || !f.g_phone.trim()) return setErr('Infos du représentant légal obligatoires pour un mineur.');
      if (gsig.current.isEmpty()) return setErr('Signature du représentant légal obligatoire.');
      g = { guardian_name: f.g_name, guardian_relation: f.g_relation, guardian_phone: f.g_phone, guardian_signature: gsig.current.getData() };
    }
    setSaving(true);
    const { error } = await supabase.from('figurants').insert({
      project_id: project.id, role, first_name: f.first_name, last_name: f.last_name, dob: f.dob,
      is_minor: minor, email: f.email, phone: f.phone, signature: sig.current.getData(), present: false, ...g,
    });
    setSaving(false);
    if (error) { setErr("Erreur d'enregistrement, réessaie."); return; }
    setDone(true); window.scrollTo(0, 0);
  }

  if (project === undefined) return <div className="wrap"><p className="sub" style={{ marginTop: 40 }}>Chargement…</p></div>;
  if (project === null) return <div className="wrap"><div className="center"><h1>Projet <span>introuvable</span></h1><p className="sub">Ce lien d’inscription n’est pas valide.</p></div></div>;

  if (done) return (
    <div className="wrap"><div className="center">
      <div className="big">MERCI ✓</div>
      <p className="sub" style={{ marginTop: 10 }}><b style={{ color: 'var(--text)' }}>{f.first_name}</b>, ton autorisation pour <b style={{ color: 'var(--text)' }}>{project.name}</b> est bien enregistrée.</p>
      <p style={{ fontSize: 13, marginTop: 10 }}>À très vite sur le plateau !</p>
    </div></div>
  );

  return (
    <div className="wrap">
      <div className="topbar" style={{ paddingLeft: 0, paddingRight: 0 }}><div className="logo"><b>VIBES</b></div></div>
      <div style={{ marginTop: 16 }}><span className="projchip">● {project.name}</span></div>
      <h1>Inscription</h1>
      <div className="sub">Remplis tes informations et signe directement sur ton écran. Ça prend 1 minute.</div>

      <div className="field">
        <label className="lab">Tu participes en tant que <span className="req">*</span></label>
        <div className="seg">
          <button type="button" className={role === 'Figurant' ? 'on' : ''} onClick={() => setRole('Figurant')}>Figurant·e</button>
          <button type="button" className={role === 'Danseur' ? 'on' : ''} onClick={() => setRole('Danseur')}>Danseur·se</button>
        </div>
      </div>

      <div className="row2">
        <div className="field"><label className="lab">Prénom <span className="req">*</span></label><input value={f.first_name} onChange={(e) => upd('first_name', e.target.value)} /></div>
        <div className="field"><label className="lab">Nom <span className="req">*</span></label><input value={f.last_name} onChange={(e) => upd('last_name', e.target.value)} /></div>
      </div>
      <div className="field">
        <label className="lab">Date de naissance <span className="req">*</span></label>
        <input type="date" value={f.dob} onChange={(e) => upd('dob', e.target.value)} />
        {minor && <div style={{ color: 'var(--warn)', fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>Mineur·e ({age} ans) — accord du représentant légal requis ci-dessous.</div>}
      </div>
      <div className="row2">
        <div className="field"><label className="lab">Email <span className="req">*</span></label><input type="email" value={f.email} onChange={(e) => upd('email', e.target.value)} /></div>
        <div className="field"><label className="lab">Téléphone <span className="req">*</span></label><input type="tel" value={f.phone} onChange={(e) => upd('phone', e.target.value)} /></div>
      </div>

      <div className="consent">
        <h3>Autorisation de droit à l&apos;image</h3>
        <div className="txt">J&apos;autorise <b>VIBES SAS</b> (SIRET 919 517 755 00014) à capter, fixer, reproduire et diffuser mon image et ma voix enregistrées lors du tournage du projet ci-dessus, sur tout support : <b>réseaux sociaux, site internet, plateformes de diffusion, projections, festivals et supports de promotion</b>, pour le monde entier. Cette autorisation est consentie <b>à titre gratuit</b>. Je renonce à toute rémunération. Mes images ne seront pas utilisées dans un contexte préjudiciable. Mes données sont traitées par VIBES SAS pour la gestion du projet ; droit d&apos;accès, de rectification et d&apos;effacement (RGPD).</div>
        <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>J&apos;ai lu et j&apos;accepte l&apos;autorisation de droit à l&apos;image. <span className="req">*</span></span></label>
      </div>

      <label className="lab">Ta signature <span className="req">*</span></label>
      <SignaturePad ref={sig} />

      {minor && (
        <div className="minorblock">
          <div className="mh">⚠ FIGURANT MINEUR — ACCORD DU REPRÉSENTANT LÉGAL</div>
          <div className="ms">La personne étant mineure, son représentant légal doit aussi remplir et signer ci-dessous.</div>
          <div className="field"><label className="lab">Nom du représentant légal <span className="req">*</span></label><input value={f.g_name} onChange={(e) => upd('g_name', e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label className="lab">Qualité <span className="req">*</span></label>
              <select value={f.g_relation} onChange={(e) => upd('g_relation', e.target.value)}><option value="">—</option><option>Père</option><option>Mère</option><option>Tuteur légal</option></select></div>
            <div className="field"><label className="lab">Téléphone <span className="req">*</span></label><input type="tel" value={f.g_phone} onChange={(e) => upd('g_phone', e.target.value)} /></div>
          </div>
          <label className="lab">Signature du représentant légal <span className="req">*</span></label>
          <SignaturePad ref={gsig} placeholder="✍ Signature du parent / tuteur" />
        </div>
      )}

      <button className="submit" disabled={saving} onClick={submit}>{saving ? 'Enregistrement…' : 'Valider mon inscription'}</button>
      {err && <div className="err">{err}</div>}
    </div>
  );
}
