'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { downloadOne, downloadAll, downloadEmargement } from '@/lib/cessionPdf';

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function Admin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('projets');
  const [projects, setProjects] = useState([]);
  const [figurants, setFigurants] = useState([]);
  const [filterSlug, setFilterSlug] = useState('__all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  // create form
  const [showCreate, setShowCreate] = useState(true);
  const [np, setNp] = useState({ name: '', slug: '', date: '', location: '', instructions: '' });
  const [projErr, setProjErr] = useState('');
  // édition des instructions d'un projet existant
  const [instrEdit, setInstrEdit] = useState(null); // id du projet en cours d'édition
  const [instrText, setInstrText] = useState('');
  const [instrSaving, setInstrSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null); // figurant dont le mail est en cours d'envoi
  // onglet Photo
  const [photoSlug, setPhotoSlug] = useState('__all');
  const [showPhotoAdd, setShowPhotoAdd] = useState(false);
  const [pp, setPp] = useState({ first_name: '', last_name: '', role: 'Figurant', phone: '', note: '' });
  const [ppErr, setPpErr] = useState('');
  const [ppSaving, setPpSaving] = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace('/admin/login'); return; }
      setReady(true);
      await refresh();
      sub = supabase.auth.onAuthStateChange((_e, session) => { if (!session) router.replace('/admin/login'); });
    })();
    return () => { sub && sub.data && sub.data.subscription && sub.data.subscription.unsubscribe(); };
  }, [router]);

  async function refresh() {
    const [p, f] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('figurants').select('*'),
    ]);
    setProjects(p.data || []);
    setFigurants(f.data || []);
    setShowCreate((p.data || []).length === 0);
  }

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 1600); }

  async function createProject() {
    setProjErr('');
    const name = np.name.trim();
    const slug = slugify(np.slug || np.name);
    if (!name) return setProjErr('Donne un nom au projet.');
    if (!slug) return setProjErr('Choisis un lien (slug).');
    if (projects.some((p) => p.slug === slug)) return setProjErr('Ce lien existe déjà.');
    const { error } = await supabase.from('projects').insert({ name, slug, shoot_date: np.date || null, location: np.location || null, instructions: np.instructions || null });
    if (error) return setProjErr("Erreur : " + error.message);
    setNp({ name: '', slug: '', date: '', location: '', instructions: '' });
    flash('Projet créé'); await refresh();
  }

  function openInstr(p) {
    if (instrEdit === p.id) { setInstrEdit(null); return; }
    setInstrEdit(p.id); setInstrText(p.instructions || '');
  }
  async function saveInstr(p) {
    setInstrSaving(true);
    const { error } = await supabase.from('projects').update({ instructions: instrText || null }).eq('id', p.id);
    setInstrSaving(false);
    if (error) { flash('Erreur : ' + error.message); return; }
    setProjects((arr) => arr.map((x) => (x.id === p.id ? { ...x, instructions: instrText || null } : x)));
    setInstrEdit(null); flash('Instructions enregistrées');
  }

  async function addPhotoPerson() {
    setPpErr('');
    const fn = pp.first_name.trim(), ln = pp.last_name.trim();
    if (!fn || !ln) return setPpErr('Prénom et nom obligatoires.');
    const proj = projects.find((p) => p.slug === photoSlug);
    if (!proj) return setPpErr('Choisis d’abord un projet auquel rattacher la personne.');
    setPpSaving(true);
    const { error } = await supabase.from('figurants').insert({
      project_id: proj.id, role: pp.role, first_name: fn, last_name: ln,
      phone: pp.phone || null, photo_note: pp.note || null, photo_only: true, present: false,
    });
    setPpSaving(false);
    if (error) return setPpErr('Erreur : ' + error.message);
    setPp({ first_name: '', last_name: '', role: 'Figurant', phone: '', note: '' });
    setShowPhotoAdd(false); flash('Personne ajoutée'); await refresh();
  }

  async function deleteFigurant(rec) {
    if (!window.confirm(`Supprimer définitivement ${rec.first_name} ${rec.last_name} ?\nCette action est irréversible (autorisation et signature perdues).`)) return;
    const { error } = await supabase.from('figurants').delete().eq('id', rec.id);
    if (error) { flash('Erreur : ' + error.message); return; }
    setFigurants((arr) => arr.filter((x) => x.id !== rec.id));
    if (modal && modal.id === rec.id) setModal(null);
    flash('Figurant supprimé');
  }

  async function resendMail(rec) {
    if (!rec.email) { flash("Pas d'email pour cette personne"); return; }
    setSendingId(rec.id);
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id }),
      });
      const j = await res.json().catch(() => ({}));
      flash(j.ok ? 'Mail envoyé ✓' : "Échec de l'envoi");
    } catch (_) { flash("Échec de l'envoi"); }
    setSendingId(null);
  }

  async function togglePresent(rec) {
    await supabase.from('figurants').update({ present: !rec.present }).eq('id', rec.id);
    setFigurants((arr) => arr.map((x) => (x.id === rec.id ? { ...x, present: !x.present } : x)));
  }

  async function togglePhotographed(rec) {
    await supabase.from('figurants').update({ photographed: !rec.photographed }).eq('id', rec.id);
    setFigurants((arr) => arr.map((x) => (x.id === rec.id ? { ...x, photographed: !x.photographed } : x)));
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  function copyLink(slug) {
    const link = origin + '/signer/' + slug;
    navigator.clipboard && navigator.clipboard.writeText(link).then(() => flash('Lien copié'));
  }

  const currentProject = useMemo(() => projects.find((p) => p.slug === filterSlug) || null, [projects, filterSlug]);
  // Suivi : uniquement les vraies autorisations signées (on exclut les profils ajoutés dans l'onglet Photo).
  const rows = useMemo(() => {
    let r = figurants.filter((x) => !x.photo_only && (filterSlug === '__all' || x.project_id === (currentProject && currentProject.id)));
    const q = search.toLowerCase().trim();
    if (q) r = r.filter((x) => (x.first_name + ' ' + x.last_name).toLowerCase().includes(q));
    return r.slice().sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
  }, [figurants, filterSlug, currentProject, search]);

  // Photo : profils ajoutés manuellement (photo_only) OU présents confirmés dans le Suivi.
  const photoProject = useMemo(() => projects.find((p) => p.slug === photoSlug) || null, [projects, photoSlug]);
  const photoRows = useMemo(() => {
    const r = figurants.filter((x) => (x.photo_only || x.present) && (photoSlug === '__all' || x.project_id === (photoProject && photoProject.id)));
    return r.slice().sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
  }, [figurants, photoSlug, photoProject]);

  if (!ready) return <div className="wrap"><p className="sub" style={{ marginTop: 40 }}>Chargement…</p></div>;

  const total = rows.length, present = rows.filter((r) => r.present).length, minors = rows.filter((r) => r.is_minor).length;
  const photoDone = photoRows.filter((r) => r.photographed).length, photoTodo = photoRows.length - photoDone;

  return (
    <>
      <div className="topbar">
        <div className="logo"><b>VIBES</b></div>
        <div className="tabs">
          <button className={'tab' + (tab === 'projets' ? ' active' : '')} onClick={() => setTab('projets')}>Projets</button>
          <button className={'tab' + (tab === 'suivi' ? ' active' : '')} onClick={() => setTab('suivi')}>Suivi</button>
          <button className={'tab' + (tab === 'photo' ? ' active' : '')} onClick={() => setTab('photo')}>Photo</button>
          <button className="logout" onClick={async () => { await supabase.auth.signOut(); router.replace('/admin/login'); }}>Déconnexion</button>
        </div>
      </div>

      <div className="wrap">
        {tab === 'projets' && (
          <>
            <h1>Mes <span>projets</span></h1>
            <div className="sub">Crée un projet, choisis son lien, et partage-le à tes figurants.</div>

            {!showCreate && <button className="btn-prim" style={{ marginBottom: 18 }} onClick={() => setShowCreate(true)}>+ Nouveau projet</button>}
            {showCreate && (
              <div className="createbox">
                <h3>Nouveau projet</h3>
                <div className="field"><label className="lab">Nom du projet <span className="req">*</span></label><input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value, slug: np.slug || slugify(e.target.value) })} placeholder="ex. Wanted" /></div>
                <div className="field"><label className="lab">Lien à partager <span className="req">*</span></label>
                  <input value={np.slug} onChange={(e) => setNp({ ...np, slug: slugify(e.target.value) })} placeholder="wanted" />
                  <div className="linkprev">Lien : <b>{origin}/signer/{np.slug || '…'}</b></div></div>
                <div className="row2">
                  <div className="field"><label className="lab">Date de tournage</label><input type="date" value={np.date} onChange={(e) => setNp({ ...np, date: e.target.value })} /></div>
                  <div className="field"><label className="lab">Lieu</label><input value={np.location} onChange={(e) => setNp({ ...np, location: e.target.value })} placeholder="ex. Jean Louis Le Saloon" /></div>
                </div>
                <div className="field"><label className="lab">Instructions de tournage</label>
                  <textarea value={np.instructions} onChange={(e) => setNp({ ...np, instructions: e.target.value })} placeholder="Heure d'appel, adresse précise, tenue/costume, contact sur place, parking… (envoyé automatiquement par mail aux figurants)" />
                  <div className="linkprev">Ce texte est inséré dans le mail de confirmation reçu par chaque figurant du projet.</div></div>
                <button className="btn-prim" onClick={createProject}>Créer le projet</button>
                {projects.length > 0 && <button className="backlink" onClick={() => setShowCreate(false)}>Annuler</button>}
                {projErr && <div className="err">{projErr}</div>}
              </div>
            )}

            {projects.length === 0 ? (
              <div className="empty">Aucun projet pour le moment.<br />Crée ton premier projet ci-dessus.</div>
            ) : projects.map((p) => {
              const n = figurants.filter((f) => f.project_id === p.id).length;
              const link = origin + '/signer/' + p.slug;
              return (
                <div className="pjcard" key={p.id}>
                  <div className="pjn">{p.name}</div>
                  <div className="pjmeta">{n} inscrit{n > 1 ? 's' : ''}{p.shoot_date ? ' · ' + p.shoot_date : ''}{p.location ? ' · ' + p.location : ''}</div>
                  <div className="linkrow"><input readOnly value={link} onClick={(e) => e.target.select()} /><button className="mini turq" onClick={() => copyLink(p.slug)}>Copier</button></div>
                  <div className="pjbtns">
                    <a className="mini" style={{ textAlign: 'center' }} href={'/signer/' + p.slug} target="_blank" rel="noreferrer">Aperçu formulaire</a>
                    <button className="mini" onClick={() => { setFilterSlug(p.slug); setTab('suivi'); }}>Voir le suivi</button>
                    <button className={'mini' + (p.instructions ? ' turq' : '')} onClick={() => openInstr(p)}>{instrEdit === p.id ? 'Fermer' : (p.instructions ? '✎ Instructions' : '+ Instructions')}</button>
                  </div>
                  {instrEdit === p.id && (
                    <div className="instrbox">
                      <label className="lab">Instructions de tournage (envoyées par mail aux figurants)</label>
                      <textarea value={instrText} onChange={(e) => setInstrText(e.target.value)} placeholder="Heure d'appel, adresse précise, tenue/costume, contact sur place, parking…" />
                      <button className="btn-prim" disabled={instrSaving} onClick={() => saveInstr(p)}>{instrSaving ? 'Enregistrement…' : 'Enregistrer les instructions'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === 'suivi' && (
          <>
            <div className="dhead">
              <div className="dhead-title">Suivi</div>
              <div className="projsel">
                <select value={filterSlug} onChange={(e) => setFilterSlug(e.target.value)}>
                  <option value="__all">Tous les projets</option>
                  {projects.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="stats">
              <div className="stat"><div className="n">{total}</div><div className="l">Inscrits</div></div>
              <div className="stat ok"><div className="n">{present}</div><div className="l">Présents</div></div>
              <div className="stat warn"><div className="n">{total - present}</div><div className="l">Attendus</div></div>
              <div className="stat"><div className="n">{minors}</div><div className="l">Mineurs</div></div>
            </div>
            <div className="dlrow">
              <button className="dlall" onClick={() => downloadAll(rows, currentProject)}>⬇ Toutes les autorisations (PDF)</button>
              <button className="dlall" onClick={() => downloadEmargement(rows, currentProject)}>⬇ Feuille d'émargement</button>
            </div>
            <div className="field"><input placeholder="Rechercher un nom…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

            {rows.length === 0 ? (
              <div className="empty">Aucune inscription.<br />Partage le lien du projet pour commencer.</div>
            ) : rows.map((r) => (
              <div className="pcard" key={r.id}>
                <div className="top">
                  <span className="nm">{r.first_name} {r.last_name}</span>
                  <span className={'role ' + (r.role || '').toLowerCase()}>{r.role}</span>
                  {r.is_minor && <span className="minorbadge">MINEUR</span>}
                </div>
                <div className="meta"><span>Cession <b style={{ color: 'var(--turq)' }}>✓ signée</b></span><span>{r.phone}</span></div>
                <div className="actions">
                  <button className={'pres' + (r.present ? ' here' : '')} onClick={() => togglePresent(r)}>{r.present ? '✓ Présent·e' : 'Marquer présent·e'}</button>
                  <button className="iconbtn" onClick={() => setModal(r)}>Signature</button>
                  <button className="iconbtn pdf" onClick={() => downloadOne(r, currentProject || projects.find((p) => p.id === r.project_id))}>PDF</button>
                  <button className="iconbtn mail" disabled={sendingId === r.id} onClick={() => resendMail(r)}>{sendingId === r.id ? '…' : '✉ Mail'}</button>
                  <button className="iconbtn del" onClick={() => deleteFigurant(r)} title="Supprimer">🗑</button>
                </div>
              </div>
            ))}
            <div className="note">Données privées, accessibles uniquement après connexion (toi & Ange). <b>Sécurité RLS</b> activée côté base.</div>
          </>
        )}

        {tab === 'photo' && (
          <>
            <div className="dhead">
              <div className="dhead-title">Photo</div>
              <div className="projsel">
                <select value={photoSlug} onChange={(e) => { setPhotoSlug(e.target.value); setShowPhotoAdd(false); }}>
                  <option value="__all">Tous les projets</option>
                  {projects.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="sub">Les personnes à photographier : celles ajoutées à la main, et celles marquées présentes dans le Suivi.</div>

            <div className="stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              <div className="stat warn"><div className="n">{photoTodo}</div><div className="l">À photographier</div></div>
              <div className="stat ok"><div className="n">{photoDone}</div><div className="l">Photographiées</div></div>
            </div>

            {!showPhotoAdd && <button className="btn-prim" style={{ marginBottom: 16 }} onClick={() => { setPpErr(''); setShowPhotoAdd(true); }}>+ Ajouter une personne</button>}
            {showPhotoAdd && (
              <div className="createbox">
                <h3>Ajouter une personne (sans autorisation)</h3>
                <div className="linkprev" style={{ marginBottom: 10 }}>{photoProject ? <>Rattachée au projet <b style={{ color: 'var(--turq)' }}>{photoProject.name}</b>. </> : <><b style={{ color: 'var(--warn)' }}>⚠ Sélectionne d&apos;abord un projet ci-dessus.</b> </>}Ce profil n&apos;apparaît que dans l&apos;onglet Photo.</div>
                <div className="row2">
                  <div className="field"><label className="lab">Prénom <span className="req">*</span></label><input value={pp.first_name} onChange={(e) => setPp({ ...pp, first_name: e.target.value })} /></div>
                  <div className="field"><label className="lab">Nom <span className="req">*</span></label><input value={pp.last_name} onChange={(e) => setPp({ ...pp, last_name: e.target.value })} /></div>
                </div>
                <div className="row2">
                  <div className="field"><label className="lab">Rôle</label><select value={pp.role} onChange={(e) => setPp({ ...pp, role: e.target.value })}><option>Figurant</option><option>Danseur</option><option>Autre</option></select></div>
                  <div className="field"><label className="lab">Téléphone</label><input type="tel" value={pp.phone} onChange={(e) => setPp({ ...pp, phone: e.target.value })} /></div>
                </div>
                <div className="field"><label className="lab">Signe distinctif / note (pour l&apos;identifier)</label><textarea value={pp.note} onChange={(e) => setPp({ ...pp, note: e.target.value })} placeholder="ex. chemise rouge, sur la scène du bar, rang 2…" /></div>
                <button className="btn-prim" disabled={ppSaving} onClick={addPhotoPerson}>{ppSaving ? 'Ajout…' : 'Ajouter la personne'}</button>
                <button className="backlink" onClick={() => setShowPhotoAdd(false)}>Annuler</button>
                {ppErr && <div className="err">{ppErr}</div>}
              </div>
            )}

            {photoRows.length === 0 ? (
              <div className="empty">Personne pour le moment.<br />Les inscriptions au formulaire apparaissent ici, et tu peux ajouter des profils à la main.</div>
            ) : photoRows.map((r) => (
              <div className="pcard" key={r.id}>
                <div className="top">
                  <span className="nm">{r.first_name} {r.last_name}</span>
                  <span className={'role ' + (r.role || '').toLowerCase()}>{r.role}</span>
                  {r.photo_only ? <span className="noauthbadge">SANS AUTORISATION</span> : <span className="authbadge">AUTORISATION ✓</span>}
                </div>
                {(r.phone || r.photo_note) && <div className="meta">{r.phone && <span>{r.phone}</span>}{r.photo_note && <span>{r.photo_note}</span>}</div>}
                <div className="actions">
                  <button className={'pres' + (r.photographed ? ' here' : '')} onClick={() => togglePhotographed(r)}>{r.photographed ? '✓ Photographié·e' : 'Marquer photographié·e'}</button>
                  {r.photo_only && <button className="iconbtn del" onClick={() => deleteFigurant(r)} title="Supprimer">🗑 Supprimer</button>}
                </div>
              </div>
            ))}
            <div className="note">L&apos;ajout manuel sans autorisation est réservé à cet onglet. Ces profils n&apos;apparaissent pas dans le Suivi ni dans les exports d&apos;autorisations.</div>
          </>
        )}
      </div>

      {modal && (
        <div className="modal" onClick={(e) => { if (e.target.classList.contains('modal')) setModal(null); }}>
          <div className="box">
            <h3>{modal.first_name} {modal.last_name}</h3>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{modal.role} · né·e le {modal.dob}</div>
            <div className="siglabel">Signature figurant·e</div>
            <div className="sigimg"><img src={modal.signature} alt="signature" /></div>
            {modal.guardian_signature && (<>
              <div className="siglabel">Représentant légal — {modal.guardian_name} ({modal.guardian_relation})</div>
              <div className="sigimg"><img src={modal.guardian_signature} alt="signature représentant" /></div>
            </>)}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Inscrit le {new Date(modal.created_at).toLocaleString('fr-FR')}</div>
            <button className="close" onClick={() => setModal(null)}>Fermer</button>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--turq)', color: '#0A0A09', fontWeight: 700, padding: '11px 20px', borderRadius: 99, fontSize: 14, zIndex: 200 }}>{toast}</div>}
    </>
  );
}
