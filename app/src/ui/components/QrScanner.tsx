import { useEffect, useRef, useState } from 'react';

/** Rear-camera QR scanner. Calls onToken once per distinct scan; falls back to a message if the camera is unavailable. */
export function QrScanner({ onToken, onClose }: { onToken: (token: string) => void; onClose: () => void }) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ t: string; at: number } | null>(null);

  useEffect(() => {
    let stop: (() => Promise<void>) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(id.current);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            const now = Date.now();
            if (last.current && last.current.t === text && now - last.current.at < 3000) return;
            last.current = { t: text, at: now };
            onToken(text.trim());
          },
          () => undefined,
        );
        stop = async () => { try { await scanner.stop(); scanner.clear(); } catch { /* already stopped */ } };
        if (cancelled) await stop();
      } catch {
        setError('Camera unavailable — type the code');
      }
    })();
    return () => { cancelled = true; void stop?.(); };
  }, [onToken]);

  return (
    <div className="panel overflow-hidden">
      {error ? <p role="alert" className="p-4 font-bold text-warn">{error}</p> : <div id={id.current} className="w-full" />}
      <button className="w-full border-t border-line py-2.5 font-bold" onClick={onClose}>Stop scanning</button>
    </div>
  );
}
