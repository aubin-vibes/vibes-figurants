'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SignaturePad = forwardRef(function SignaturePad({ placeholder = '✍ Signe ici avec ton doigt' }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(true);

  function resize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const data = dirty.current ? canvas.toDataURL() : null;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1D1D1B';
    if (data) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = data; }
  }

  useEffect(() => {
    resize();
    const t = setTimeout(resize, 80);
    window.addEventListener('resize', resize);
    return () => { clearTimeout(t); window.removeEventListener('resize', resize); };
  }, []);

  useImperativeHandle(ref, () => ({
    resize,
    clear() {
      const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height); dirty.current = false; setEmpty(true);
    },
    isEmpty() { return !dirty.current; },
    getData() { return dirty.current ? canvasRef.current.toDataURL('image/png') : null; },
  }));

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const c = (e.touches && e.touches[0]) || e;
    return { x: c.clientX - r.left, y: c.clientY - r.top };
  }
  function down(e) { e.preventDefault(); drawing.current = true; dirty.current = true; setEmpty(false); const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function up() { drawing.current = false; }

  useEffect(() => {
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  return (
    <div>
      <div className="sigbox">
        <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} />
        {empty && <div className="ph">{placeholder}</div>}
      </div>
      <div className="sigtools">
        <small>Signature manuscrite + horodatage</small>
        <button type="button" className="btn-clear" onClick={() => { const c = canvasRef.current.getContext('2d'); c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); dirty.current = false; setEmpty(true); }}>Effacer</button>
      </div>
    </div>
  );
});

export default SignaturePad;
