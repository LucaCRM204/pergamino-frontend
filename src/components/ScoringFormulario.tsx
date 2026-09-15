/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import {
  Calendar,
  Upload,
  FileText,
  Send,
  X,
  AlertCircle,

} from "lucide-react";
import { api } from "../api";

interface ScoringFormularioProps {
  lead: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScoringFormulario({
  lead,
  onClose,
  onSuccess,
}: ScoringFormularioProps) {
  const [fechaVenta, setFechaVenta] = useState("");
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentos(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("leadId", lead.id.toString());
      formData.append("fechaVenta", fechaVenta);
      formData.append("notas", notas);
      documentos.forEach((doc) => {
        formData.append("documentos", doc);
      });

      await api.post("/scoring", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al enviar a scoring");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            Enviar a Scoring
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Cliente:</strong> {lead.nombre}
            </p>
            <p className="text-sm text-blue-800">
              <strong>Modelo:</strong> {lead.modelo}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Fecha de Venta
            </label>
            <input
              type="date"
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Upload size={16} className="inline mr-1" />
              Documentación (PDF/Imágenes)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full border rounded-lg px-3 py-2"
            />
            {documentos.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {documentos.length} archivo(s) seleccionado(s)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={16} className="inline mr-1" />
              Notas para Scoring
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
              placeholder="Observaciones adicionales..."
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !fechaVenta}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                "Enviando..."
              ) : (
                <>
                  <Send size={16} />
                  Enviar a Scoring
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
