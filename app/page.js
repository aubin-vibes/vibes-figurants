import Link from 'next/link';

export default function Home() {
  return (
    <div className="wrap">
      <div className="center">
        <div className="logo" style={{ fontSize: 48 }}><b>VIBES</b></div>
        <h1 style={{ marginTop: 8 }}>Autorisations<br /><span>figurants</span></h1>
        <p className="sub" style={{ marginTop: 12 }}>Espace de gestion des inscriptions et des droits à l’image.</p>
        <Link className="btn-prim" style={{ maxWidth: 240, textAlign: 'center', padding: 14 }} href="/admin">
          Accéder au tableau de bord
        </Link>
      </div>
    </div>
  );
}
