'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setErr(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) { setErr('Identifiants incorrects.'); return; }
    router.push('/admin');
  }

  return (
    <div className="wrap">
      <div className="center">
        <div className="logo" style={{ fontSize: 44 }}><b>VIBES</b></div>
        <h1 style={{ marginTop: 6 }}>Connexion</h1>
        <div style={{ width: '100%', maxWidth: 360, marginTop: 16, textAlign: 'left' }}>
          <div className="field"><label className="lab">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label className="lab">Mot de passe</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn()} /></div>
          <button className="btn-prim" disabled={loading} onClick={signIn}>{loading ? '…' : 'Se connecter'}</button>
          {err && <div className="err">{err}</div>}
        </div>
      </div>
    </div>
  );
}
