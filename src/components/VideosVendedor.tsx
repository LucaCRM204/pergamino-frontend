import { useState, useEffect, useCallback } from 'react';

/**
 * VideosVendedor
 * Administra los 3 videos de una sesión de WhatsApp. El video se sube directo
 * a Cloudinary desde el navegador (preset unsigned) y al bot solo le llega la URL.
 * El bot manda el video correspondiente al modelo que consulta el lead.
 */

const CLOUD_NAME = 'daxkzdokg';
const UPLOAD_PRESET = 'goldplan_videos_unsigned';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
const MAX_BYTES = 16 * 1024 * 1024; // límite de WhatsApp

interface Slot {
  slot: number;
  cargado: boolean;
  modelo?: string;
  modeloNombre?: string;
  marca?: string | null;
  url?: string;
  caption?: string | null;
  bytes?: number | null;
  mb?: number | null;
  duracionSeg?: number | null;
  activo?: boolean;
  updatedAt?: string;
}

interface MarcaModelos {
  marca: string;
  nombre: string;
  planes: string;
  modelos: { clave: string; nombre: string }[];
}

interface Props {
  botApiUrl: string;
  sessionId: number;
  connected: boolean;
  pw: string;
}

interface Draft {
  modelo: string;
  caption: string;
  file: File | null;
}

const SLOTS = [1, 2, 3];

export default function VideosVendedor({ botApiUrl, sessionId, connected, pw }: Props) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [marcas, setMarcas] = useState<MarcaModelos[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const hdrs = useCallback(
    () => ({ 'Content-Type': 'application/json', 'x-admin-password': pw }),
    [pw]
  );

  const aviso = (tipo: 'ok' | 'error', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  const load = useCallback(async () => {
    try {
      const [resSlots, resModelos] = await Promise.all([
        fetch(`${botApiUrl}/api/wa-videos/${sessionId}`, { headers: hdrs() }),
        fetch(`${botApiUrl}/api/wa-videos/modelos`, { headers: hdrs() }),
      ]);
      if (resSlots.ok) {
        const data = await resSlots.json();
        setSlots(data.slots || []);
      }
      if (resModelos.ok) {
        const data = await resModelos.json();
        setMarcas(data.marcas || []);
      }
      setLoaded(true);
    } catch {
      aviso('error', 'No se pudo leer los videos');
      setLoaded(true);
    }
  }, [botApiUrl, sessionId, hdrs]);

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  const getDraft = (slot: number): Draft => {
    const actual = slots.find(s => s.slot === slot);
    return (
      drafts[slot] || {
        modelo: actual?.modelo || '',
        caption: actual?.caption || '',
        file: null,
      }
    );
  };

  const setDraft = (slot: number, patch: Partial<Draft>) => {
    setDrafts(p => ({ ...p, [slot]: { ...getDraft(slot), ...patch } }));
  };

  const elegirArchivo = (slot: number, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      aviso(
        'error',
        `El video pesa ${(file.size / 1048576).toFixed(1)}MB y WhatsApp acepta hasta 16MB. Comprimilo antes de subirlo.`
      );
      return;
    }
    setDraft(slot, { file });
  };

  // Sube a Cloudinary con barra de progreso (fetch no reporta progreso).
  const subirACloudinary = (slot: number, file: File) =>
    new Promise<{ url: string; bytes: number; duracion: number | null }>((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', UPLOAD_URL);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          setProgress(p => ({ ...p, [slot]: Math.round((e.loaded / e.total) * 100) }));
        }
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('Cloudinary rechazó el archivo'));
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            bytes: data.bytes,
            duracion: data.duration ? Math.round(data.duration) : null,
          });
        } catch {
          reject(new Error('Respuesta inválida de Cloudinary'));
        }
      };
      xhr.onerror = () => reject(new Error('Error de red subiendo el video'));
      xhr.send(form);
    });

  const guardar = async (slot: number) => {
    const draft = getDraft(slot);
    const actual = slots.find(s => s.slot === slot);

    if (!draft.modelo) {
      aviso('error', 'Elegí el modelo que dispara este video');
      return;
    }
    if (!draft.file && !actual?.url) {
      aviso('error', 'Elegí el archivo de video');
      return;
    }

    setBusy(p => ({ ...p, [slot]: true }));
    setProgress(p => ({ ...p, [slot]: 0 }));

    try {
      let url = actual?.url as string | undefined;
      let bytes = actual?.bytes ?? null;
      let duracionSeg = actual?.duracionSeg ?? null;

      if (draft.file) {
        const subido = await subirACloudinary(slot, draft.file);
        url = subido.url;
        bytes = subido.bytes;
        duracionSeg = subido.duracion;
      }

      const res = await fetch(`${botApiUrl}/api/wa-videos/${sessionId}/${slot}`, {
        method: 'PUT',
        headers: hdrs(),
        body: JSON.stringify({
          password: pw,
          modelo: draft.modelo,
          url,
          caption: draft.caption,
          bytes,
          duracionSeg,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        aviso('error', data.error || 'No se pudo guardar');
        return;
      }

      aviso('ok', `Video del ${data.modeloNombre} guardado`);
      setDrafts(p => {
        const n = { ...p };
        delete n[slot];
        return n;
      });
      await load();
    } catch (err) {
      aviso('error', err instanceof Error ? err.message : 'Error subiendo el video');
    } finally {
      setBusy(p => ({ ...p, [slot]: false }));
      setProgress(p => {
        const n = { ...p };
        delete n[slot];
        return n;
      });
    }
  };

  const borrar = async (slot: number) => {
    if (!confirm('¿Borrar el video de este slot?')) return;
    setBusy(p => ({ ...p, [slot]: true }));
    try {
      await fetch(`${botApiUrl}/api/wa-videos/${sessionId}/${slot}`, {
        method: 'DELETE',
        headers: hdrs(),
      });
      setDrafts(p => {
        const n = { ...p };
        delete n[slot];
        return n;
      });
      await load();
      aviso('ok', 'Video borrado');
    } catch {
      aviso('error', 'No se pudo borrar');
    } finally {
      setBusy(p => ({ ...p, [slot]: false }));
    }
  };

  const probar = async (slot: number) => {
    const phone = prompt('¿A qué número mando la prueba? (con código de país, ej: 5491112345678)');
    if (!phone) return;
    setBusy(p => ({ ...p, [slot]: true }));
    try {
      const res = await fetch(`${botApiUrl}/api/wa-videos/${sessionId}/${slot}/test`, {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({ password: pw, phone }),
      });
      const data = await res.json();
      if (res.ok) aviso('ok', 'Video enviado, revisá el WhatsApp');
      else aviso('error', data.error || 'No se pudo enviar');
    } catch {
      aviso('error', 'Error en el envío de prueba');
    } finally {
      setBusy(p => ({ ...p, [slot]: false }));
    }
  };

  const cargados = slots.filter(s => s.cargado).length;

  return (
    <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-800"
      >
        <span>🎬 Videos por modelo</span>
        {loaded && (
          <span className="text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
            {cargados}/3 cargados
          </span>
        )}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            El bot manda el video cuando el lead consulta por ese modelo. Máximo 16MB y codec H.264
            (los videos de iPhone suelen venir en HEVC y hay que convertirlos).
          </p>

          {msg && (
            <div
              className={`text-xs px-3 py-2 rounded-lg ${
                msg.tipo === 'ok'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {msg.tipo === 'ok' ? '✅ ' : '⚠️ '}
              {msg.texto}
            </div>
          )}

          {!loaded && (
            <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              Cargando...
            </div>
          )}

          {loaded &&
            SLOTS.map(slot => {
              const actual = slots.find(s => s.slot === slot);
              const draft = getDraft(slot);
              const cargando = !!busy[slot];
              const pct = progress[slot];
              const hayCambios = !!drafts[slot];

              return (
                <div key={slot} className="bg-white rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Video {slot}</span>
                    {actual?.cargado ? (
                      <span className="text-xs text-green-600">
                        🟢 {actual.marca} {actual.modeloNombre}
                        {actual.mb ? ` · ${actual.mb}MB` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Vacío</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={draft.modelo}
                      onChange={e => setDraft(slot, { modelo: e.target.value })}
                      disabled={cargando}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white flex-1 min-w-[160px] max-w-xs"
                    >
                      <option value="">— Modelo que dispara —</option>
                      {marcas.map(m => (
                        <optgroup key={m.marca} label={m.nombre}>
                          {m.modelos.map(mo => (
                            <option key={mo.clave} value={mo.clave}>
                              {mo.nombre}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <label className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 whitespace-nowrap">
                      {draft.file ? `📎 ${draft.file.name.slice(0, 18)}` : '📁 Elegir video'}
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime"
                        className="hidden"
                        disabled={cargando}
                        onChange={e => elegirArchivo(slot, e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={draft.caption}
                    onChange={e => setDraft(slot, { caption: e.target.value })}
                    disabled={cargando}
                    maxLength={255}
                    placeholder="Texto que acompaña el video (opcional)"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  />

                  {pct != null && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => guardar(slot)}
                      disabled={cargando || (!hayCambios && !!actual?.cargado)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {cargando ? (pct != null ? `Subiendo ${pct}%` : 'Guardando...') : 'Guardar'}
                    </button>

                    {actual?.cargado && (
                      <>
                        <a
                          href={actual.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"
                        >
                          Ver
                        </a>
                        <button
                          onClick={() => probar(slot)}
                          disabled={cargando || !connected}
                          title={connected ? '' : 'La sesión tiene que estar conectada'}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Probar envío
                        </button>
                        <button
                          onClick={() => borrar(slot)}
                          disabled={cargando}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 disabled:opacity-40"
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
