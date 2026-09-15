/**
 * ============================================
 * COMPONENTS/SCORINGMODULE.TSX
 * ============================================
 * Módulo completo de Scoring/Ventas
 * Incluye: Tabla, Filtros, Modales, Mensajería
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Check,
  X,
  Clock,
  AlertCircle,
  DollarSign,
  Eye,
  User,
  Bell,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  CreditCard,
  Building2,
  Play,
  MessageCircle,
  Send,
  ChevronDown,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../api';

// ============================================
// TIPOS
// ============================================

type EstadoScoring = 
  | 'pendiente_supervisor'
  | 'ingresada'
  | 'asignada'
  | 'en_proceso'
  | 'observada'
  | 'rechazada'
  | 'pendiente_pago'
  | 'seña'
  | 'finalizada'
  | 'cargada_concesionario';

interface MensajeScoring {
  id: number;
  venta_id: number;
  remitente_id: number;
  destinatario_id: number | null;
  mensaje: string;
  tipo: 'observacion' | 'respuesta_supervisor' | 'respuesta_vendedor' | 'resuelto' | 'sistema' | 'correccion';
  leido: boolean;
  leido_at: string | null;
  created_at: string;
  remitente_nombre?: string;
  remitente_rol?: string;
}

interface VentaScoring {
  id: number;
  lead_id: number;
  vendedor_id: number;
  supervisor_id: number | null;
  scoring_user_id: number | null;
  cobranza_user_id: number | null;
  estado: EstadoScoring;
  fecha_venta: string;
  pdf_url: string | null;
  notas_vendedor: string | null;
  tipo_venta: 'adjudicado' | 'convencional' | 'plan' | null;
  pv: string | null;
  medio_pago: 'efectivo' | 'tarjeta_credito' | 'visa_web' | 'transferencia' | null;
  notas_scoring: string | null;
  motivo_rechazo: string | null;
  monto_total: number | null;
  monto_seña: number | null;
  notas_cobranza: string | null;
  created_at: string;
  observada_at?: string | null;
  resuelta_at?: string | null;
  cliente_nombre?: string;
  cliente_telefono?: string;
  vehiculo_modelo?: string;
  vehiculo_marca?: string;
  vendedor_nombre?: string;
  supervisor_nombre?: string;
  scoring_nombre?: string;
  notas?: Array<{
    id: number;
    mensaje: string;
    tipo: string;
    usuario_nombre: string;
    created_at: string;
  }>;
  mensajes_no_leidos?: number;
}

interface AlertaScoring {
  id: number;
  venta_id: number;
  tipo: string;
  mensaje: string;
  lead_nombre?: string;
  created_at: string;
}

interface LeadType {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  marca?: string;
  estado: string;
  vendedor: number | null;
}

// ============================================
// CONFIGURACIÓN DE ESTADOS
// ============================================

const estadosConfig: Record<EstadoScoring, { label: string; color: string; icon: typeof Clock }> = {
  pendiente_supervisor: { label: 'Pendiente Supervisor', color: 'bg-yellow-500', icon: Clock },
  ingresada: { label: 'Ingresada', color: 'bg-blue-500', icon: FileText },
  asignada: { label: 'Asignada', color: 'bg-purple-500', icon: User },
  en_proceso: { label: 'En Proceso', color: 'bg-orange-500', icon: RefreshCw },
  observada: { label: 'Observada', color: 'bg-amber-500', icon: AlertCircle },
  rechazada: { label: 'Rechazada', color: 'bg-red-500', icon: XCircle },
  pendiente_pago: { label: 'Pendiente de Pago', color: 'bg-cyan-500', icon: DollarSign },
  seña: { label: 'Señada', color: 'bg-teal-500', icon: CreditCard },
  finalizada: { label: 'Finalizada', color: 'bg-green-500', icon: CheckCircle },
  cargada_concesionario: { label: 'Cargada en Concesionario', color: 'bg-emerald-600', icon: Building2 },
};

const mediosPago: Record<string, { label: string; icon: string }> = {
  efectivo: { label: 'Efectivo', icon: '💵' },
  tarjeta_credito: { label: 'Tarjeta de Crédito', icon: '💳' },
  visa_web: { label: 'Visa Web', icon: '🌐' },
  transferencia: { label: 'Transferencia', icon: '🏦' },
};

// ============================================
// PROPS DEL COMPONENTE
// ============================================

interface ScoringModuleProps {
  currentUser: {
    id: number;
    name: string;
    role: string;
    reportsTo?: number | null;
  };
  leads: LeadType[];
  users?: Array<{ id: number; name: string; role: string; reportsTo?: number | null }>;
  onScoringCreado?: () => void;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ScoringModule({ 
  currentUser, 
  leads,
  users,
  onScoringCreado,
}: ScoringModuleProps) {
  // Estados
  const [ventas, setVentas] = useState<VentaScoring[]>([]);
  const [alertas, setAlertas] = useState<AlertaScoring[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenta, setSelectedVenta] = useState<VentaScoring | null>(null);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchText, setSearchText] = useState('');
  
  // Modales
  const [showNuevaVenta, setShowNuevaVenta] = useState(false);
  const [showAutorizar, setShowAutorizar] = useState(false);
  const [showRechazarSupervisor, setShowRechazarSupervisor] = useState(false);
  const [showProcesar, setShowProcesar] = useState(false);
  const [showDetalles, setShowDetalles] = useState(false);
  const [showMensajes, setShowMensajes] = useState(false);
  const [showConfirmarEliminar, setShowConfirmarEliminar] = useState(false);
  const [showResubirPdf, setShowResubirPdf] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  // Estados para mensajes
  const [mensajesVenta, setMensajesVenta] = useState<MensajeScoring[]>([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  // Ref para evitar cargas múltiples
  const hasCargado = useRef(false);

  // ============================================
  // PERMISOS SEGÚN ROL
  // ============================================
  
  const canCreateVenta = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'].includes(currentUser.role);
  const canAutorizar = ['owner', 'director', 'gerente', 'supervisor'].includes(currentUser.role);
  const canTomarVenta = ['owner', 'director', 'jefe_scoring', 'scoring'].includes(currentUser.role);
  const canProcesarScoring = ['owner', 'director', 'jefe_scoring', 'scoring'].includes(currentUser.role);
  const canProcesarCobranza = ['owner', 'director', 'jefe_scoring', 'cobranza'].includes(currentUser.role);
  const canDeleteVenta = ['owner', 'jefe_scoring'].includes(currentUser.role);
  const canResubirPdf = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'].includes(currentUser.role);

  // ============================================
  // CARGAR DATOS
  // ============================================
  
  const cargarVentas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroMes) params.append('mes', filtroMes);
      
      const response = await api.get(`/scoring?${params.toString()}`);
      setVentas(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error cargando ventas:', error);
      setVentas([]);
    }
  }, [filtroEstado, filtroMes]);

  const cargarAlertas = useCallback(async () => {
    try {
      const response = await api.get('/scoring/alertas/mis-alertas');
      setAlertas(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error cargando alertas:', error);
    }
  }, []);

  const cargarMensajesNoLeidos = useCallback(async () => {
    try {
      const response = await api.get('/scoring/mensajes/no-leidos');
      setMensajesNoLeidos(response.data.count || 0);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  }, []);

  useEffect(() => {
    if (!hasCargado.current) {
      hasCargado.current = true;
      setLoading(true);
      Promise.all([cargarVentas(), cargarAlertas(), cargarMensajesNoLeidos()])
        .finally(() => setLoading(false));
    }
  }, [cargarVentas, cargarAlertas, cargarMensajesNoLeidos]);

  useEffect(() => {
    cargarVentas();
  }, [filtroEstado, filtroMes, cargarVentas]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCrearVenta = async (data: { lead_id: number; fecha_venta: string; notas_vendedor?: string; tipo_venta?: string; pdf?: File }) => {
    try {
      const formData = new FormData();
      formData.append('lead_id', data.lead_id.toString());
      formData.append('fecha_venta', data.fecha_venta);
      if (data.notas_vendedor) formData.append('notas_vendedor', data.notas_vendedor);
      if (data.tipo_venta) formData.append('tipo_venta', data.tipo_venta);
      if (data.pdf) formData.append('pdf', data.pdf);

      await api.post('/scoring', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowNuevaVenta(false);
      cargarVentas();
      onScoringCreado?.();
      alert('✅ Venta creada exitosamente');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear venta');
    }
  };

  const handleAutorizar = async (ventaId: number, pv: string, medioPago: string) => {
    try {
      await api.post(`/scoring/${ventaId}/autorizar`, { pv, medio_pago: medioPago });
      setShowAutorizar(false);
      setSelectedVenta(null);
      cargarVentas();
      alert('✅ Venta autorizada');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al autorizar');
    }
  };

  const handleRechazarSupervisor = async (ventaId: number, motivo: string) => {
    try {
      await api.post(`/scoring/${ventaId}/rechazar-supervisor`, { motivo });
      setShowRechazarSupervisor(false);
      setSelectedVenta(null);
      cargarVentas();
      alert('✅ Venta rechazada');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al rechazar');
    }
  };

  const handleTomarVenta = async (ventaId: number) => {
    try {
      await api.post(`/scoring/${ventaId}/tomar`);
      cargarVentas();
      alert('✅ Venta tomada');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al tomar venta');
    }
  };

  const handleCambiarEstado = async (ventaId: number, nuevoEstado: string, notas?: string, motivoRechazo?: string) => {
    try {
      await api.put(`/scoring/${ventaId}/estado`, {
        nuevo_estado: nuevoEstado,
        notas,
        motivo_rechazo: motivoRechazo,
      });
      setShowProcesar(false);
      setSelectedVenta(null);
      cargarVentas();
      alert('✅ Estado actualizado');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const handleEnviarMensaje = async (ventaId: number, mensaje: string, tipo: string) => {
    try {
      await api.post(`/scoring/${ventaId}/mensajes`, { mensaje, tipo });
      cargarMensajesVenta(ventaId);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al enviar mensaje');
    }
  };

  const handleResubirPdf = async (ventaId: number, pdf: File) => {
    try {
      const formData = new FormData();
      formData.append('pdf', pdf);

      await api.post(`/scoring/${ventaId}/resubir-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      cargarVentas();
      alert('✅ Documentación actualizada correctamente');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al resubir documentación');
    }
  };

  const cargarMensajesVenta = async (ventaId: number) => {
    setLoadingMensajes(true);
    try {
      const response = await api.get(`/scoring/${ventaId}/mensajes`);
      setMensajesVenta(response.data || []);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setLoadingMensajes(false);
    }
  };

  const handleEliminarVenta = async (ventaId: number) => {
    setEliminando(true);
    try {
      await api.delete(`/scoring/${ventaId}`);
      setShowConfirmarEliminar(false);
      setSelectedVenta(null);
      cargarVentas();
      alert('✅ Venta eliminada correctamente');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar venta');
    } finally {
      setEliminando(false);
    }
  };

  // ============================================
  // FILTRADO
  // ============================================

  const ventasFiltradas = ventas.filter(v => {
    // Filtro por mes (YYYY-MM)
    if (filtroMes) {
      const fechaVenta = v.fecha_venta ? v.fecha_venta.substring(0, 7) : '';
      if (fechaVenta !== filtroMes) {
        return false;
      }
    }
    
    // Filtro por búsqueda de texto
    if (searchText) {
      const search = searchText.toLowerCase();
      if (
        !v.cliente_nombre?.toLowerCase().includes(search) &&
        !v.cliente_telefono?.includes(search) &&
        !v.vehiculo_modelo?.toLowerCase().includes(search) &&
        !v.vendedor_nombre?.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    return true;
  });

  // ============================================
  // CONTADORES POR ESTADO (usa ventas filtradas por mes)
  // ============================================

  const contadorEstados = ventasFiltradas.reduce((acc, v) => {
    acc[v.estado] = (acc[v.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Cargando scoring...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 rounded-xl p-3">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Módulo de Scoring</h1>
              <p className="text-white/80">Gestión de ventas y cobranzas</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Badge de alertas */}
            {alertas.length > 0 && (
              <button 
                onClick={() => {/* mostrar alertas */}}
                className="relative bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {alertas.length}
                </span>
              </button>
            )}

            {/* Badge de mensajes */}
            {mensajesNoLeidos > 0 && (
              <div className="bg-white/20 rounded-lg px-3 py-2 flex items-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{mensajesNoLeidos} mensajes</span>
              </div>
            )}

            {/* Botón actualizar */}
            <button 
              onClick={() => { cargarVentas(); cargarAlertas(); }}
              className="bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Botón nueva venta */}
            {canCreateVenta && (
              <button
                onClick={() => setShowNuevaVenta(true)}
                className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Nueva Venta</span>
              </button>
            )}
          </div>
        </div>

        {/* CONTADORES POR ESTADO */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {Object.entries(estadosConfig).map(([estado, config]) => {
            const count = contadorEstados[estado] || 0;
            const isSelected = filtroEstado === estado;
            return (
              <button
                key={estado}
                onClick={() => setFiltroEstado(isSelected ? '' : estado)}
                className={`rounded-lg p-2 text-center transition-all ${
                  isSelected 
                    ? 'bg-white text-indigo-600 shadow-lg scale-105' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs truncate">{config.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por cliente, teléfono, modelo..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Filtro por mes */}
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />

          {/* Filtro por estado */}
          <div className="relative">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="appearance-none bg-gray-100 border border-gray-300 rounded-lg pl-4 pr-10 py-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(estadosConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>

          {/* Limpiar filtros */}
          {(filtroEstado || searchText || filtroMes) && (
            <button
              onClick={() => { setFiltroEstado(''); setSearchText(''); setFiltroMes(new Date().toISOString().slice(0, 7)); }}
              className="text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* TABLA DE VENTAS */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vehículo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendedor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">PV</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay ventas {filtroEstado ? `en estado "${estadosConfig[filtroEstado as EstadoScoring]?.label}"` : ''}</p>
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map((venta) => {
                  const estadoConfig = estadosConfig[venta.estado];
                  const IconoEstado = estadoConfig.icon;
                  
                  return (
                    <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">#{venta.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{venta.cliente_nombre || 'Sin nombre'}</p>
                          <p className="text-sm text-gray-500">{venta.cliente_telefono}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{venta.vehiculo_modelo || '-'}</p>
                          
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{venta.vendedor_nombre}</p>
                          {venta.supervisor_nombre && (
                            <p className="text-xs text-gray-500">Sup: {venta.supervisor_nombre}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-white text-xs font-medium ${estadoConfig.color}`}>
                          <IconoEstado className="w-3 h-3" />
                          <span>{estadoConfig.label}</span>
                        </span>
                        {venta.mensajes_no_leidos && venta.mensajes_no_leidos > 0 && (
                          <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 inline-flex items-center justify-center">
                            {venta.mensajes_no_leidos}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {new Date(venta.fecha_venta).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {venta.pv ? (
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{venta.pv}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {venta.tipo_venta ? (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            venta.tipo_venta === 'convencional' ? 'bg-blue-100 text-blue-700' :
                            venta.tipo_venta === 'adjudicado' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {venta.tipo_venta.charAt(0).toUpperCase() + venta.tipo_venta.slice(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Ver detalles */}
                          <button
                            onClick={() => { setSelectedVenta(venta); setShowDetalles(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Ver PDF */}
                          {venta.pdf_url && (
                            <a
                              href={venta.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Ver PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}

                          {/* Mensajes */}
                          <button
                            onClick={() => { setSelectedVenta(venta); cargarMensajesVenta(venta.id); setShowMensajes(true); }}
                            className={`p-2 rounded-lg transition-colors relative ${
                              venta.mensajes_no_leidos && venta.mensajes_no_leidos > 0
                                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={venta.mensajes_no_leidos ? `${venta.mensajes_no_leidos} mensajes sin leer` : 'Mensajes'}
                          >
                            <MessageCircle className="w-4 h-4" />
                            {venta.mensajes_no_leidos && venta.mensajes_no_leidos > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                {venta.mensajes_no_leidos > 9 ? '9+' : venta.mensajes_no_leidos}
                              </span>
                            )}
                          </button>

                          {/* Autorizar (Supervisor) */}
                          {canAutorizar && venta.estado === 'pendiente_supervisor' && (
                            <>
                              <button
                                onClick={() => { setSelectedVenta(venta); setShowAutorizar(true); }}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Autorizar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedVenta(venta); setShowRechazarSupervisor(true); }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Rechazar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Tomar venta (Scoring) */}
                          {canTomarVenta && venta.estado === 'ingresada' && (
                            <button
                              onClick={() => handleTomarVenta(venta.id)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Tomar venta"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {/* Procesar (Scoring/Cobranza) */}
                          {((canProcesarScoring && ['asignada', 'en_proceso', 'observada'].includes(venta.estado)) ||
                            (canProcesarCobranza && ['pendiente_pago', 'seña', 'finalizada', 'cargada_concesionario'].includes(venta.estado))) && (
                            <button
                              onClick={() => { setSelectedVenta(venta); setShowProcesar(true); }}
                              className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Procesar"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Resubir PDF (Vendedor/Supervisor cuando está observada o rechazada) */}
                          {canResubirPdf && ['observada', 'rechazada', 'pendiente_supervisor'].includes(venta.estado) && 
                           (venta.vendedor_id === currentUser.id || venta.supervisor_id === currentUser.id || ['owner', 'director', 'gerente'].includes(currentUser.role)) && (
                            <button
                              onClick={() => { setSelectedVenta(venta); setShowResubirPdf(true); }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Resubir documentación"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}

                          {/* Eliminar venta (Solo Owner y Jefe Scoring) */}
                          {canDeleteVenta && (
                            <button
                              onClick={() => { setSelectedVenta(venta); setShowConfirmarEliminar(true); }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar venta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación simple */}
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Mostrando {ventasFiltradas.length} ventas del mes seleccionado
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* MODALES */}
      {/* ============================================ */}

      {/* MODAL: NUEVA VENTA */}
      {showNuevaVenta && (
        <ModalNuevaVenta
          leads={leads.filter(l => {
            // Filtrar por estado
            if (l.estado !== 'vendido' && l.estado !== 'negociacion') return false;
            
            // Filtrar por propiedad según rol
            if (currentUser.role === 'vendedor') {
              // Vendedor solo ve sus propios leads
              return l.vendedor === currentUser.id;
            }
            if (currentUser.role === 'supervisor' || currentUser.role === 'gerente') {
              // Supervisor/Gerente solo ve leads de su equipo
              // El lead debe pertenecer a un vendedor que le reporta
              return l.vendedor === currentUser.id || 
                     users?.some((u: { id: number; reportsTo?: number | null }) => u.id === l.vendedor && u.reportsTo === currentUser.id);
            }
            // Owner, director ven todos
            return true;
          })}
          ventasExistentes={ventas}
          onSubmit={handleCrearVenta}
          onClose={() => setShowNuevaVenta(false)}
        />
      )}

      {/* MODAL: AUTORIZAR */}
      {showAutorizar && selectedVenta && (
        <ModalAutorizar
          venta={selectedVenta}
          onAutorizar={(pv, medioPago) => handleAutorizar(selectedVenta.id, pv, medioPago)}
          onClose={() => { setShowAutorizar(false); setSelectedVenta(null); }}
        />
      )}

      {/* MODAL: RECHAZAR SUPERVISOR */}
      {showRechazarSupervisor && selectedVenta && (
        <ModalRechazar
          venta={selectedVenta}
          onRechazar={(motivo) => handleRechazarSupervisor(selectedVenta.id, motivo)}
          onClose={() => { setShowRechazarSupervisor(false); setSelectedVenta(null); }}
        />
      )}

      {/* MODAL: PROCESAR */}
      {showProcesar && selectedVenta && (
        <ModalProcesar
          venta={selectedVenta}
          onCambiarEstado={handleCambiarEstado}
          onClose={() => { setShowProcesar(false); setSelectedVenta(null); }}
        />
      )}

      {/* MODAL: DETALLES */}
      {showDetalles && selectedVenta && (
        <ModalDetalles
          venta={selectedVenta}
          onClose={() => { setShowDetalles(false); setSelectedVenta(null); }}
        />
      )}

      {/* MODAL: MENSAJES */}
      {showMensajes && selectedVenta && (
        <ModalMensajes
          venta={selectedVenta}
          mensajes={mensajesVenta}
          loading={loadingMensajes}
          currentUserId={currentUser.id}
          currentUserRole={currentUser.role}
          onEnviar={(msg, tipo) => handleEnviarMensaje(selectedVenta.id, msg, tipo)}
          onCambiarEstado={handleCambiarEstado}
          onClose={() => { setShowMensajes(false); setSelectedVenta(null); setMensajesVenta([]); cargarVentas(); }}
        />
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN */}
      {showConfirmarEliminar && selectedVenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Eliminar Venta</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que querés eliminar la venta <strong>#{selectedVenta.id}</strong> de <strong>{selectedVenta.cliente_nombre}</strong>?
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-700">
                <strong>⚠️ Atención:</strong> Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a esta venta, incluyendo mensajes y notas.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowConfirmarEliminar(false); setSelectedVenta(null); }}
                disabled={eliminando}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEliminarVenta(selectedVenta.id)}
                disabled={eliminando}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                {eliminando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESUBIR PDF */}
      {showResubirPdf && selectedVenta && (
        <ModalResubirPdf
          venta={selectedVenta}
          onResubir={(pdf) => handleResubirPdf(selectedVenta.id, pdf)}
          onClose={() => { setShowResubirPdf(false); setSelectedVenta(null); }}
        />
      )}
    </div>
  );
}

// ============================================
// COMPONENTES DE MODALES
// ============================================

// MODAL: RESUBIR PDF
function ModalResubirPdf({
  venta,
  onResubir,
  onClose
}: {
  venta: VentaScoring;
  onResubir: (pdf: File) => void;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!pdf) {
      alert('Seleccioná un archivo');
      return;
    }
    setUploading(true);
    try {
      await onResubir(pdf);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  const estadoLabel: Record<string, { label: string; color: string; message: string }> = {
    observada: { 
      label: 'Observada', 
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      message: 'Scoring observó esta venta. Subí la documentación corregida para que puedan revisarla nuevamente.'
    },
    rechazada: { 
      label: 'Rechazada', 
      color: 'bg-red-100 text-red-800 border-red-300',
      message: 'Esta venta fue rechazada. Subí nueva documentación para volver a enviarla a revisión.'
    },
    pendiente_supervisor: { 
      label: 'Pendiente Supervisor', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      message: 'Podés actualizar la documentación antes de que el supervisor la autorice.'
    },
  };

  const estadoInfo = estadoLabel[venta.estado] || { label: venta.estado, color: 'bg-gray-100', message: '' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold">Resubir Documentación</h3>
          </div>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {/* Info de la venta */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600">
            <strong>Venta:</strong> #{venta.id}<br />
            <strong>Cliente:</strong> {venta.cliente_nombre}<br />
            <strong>Vehículo:</strong> {venta.vehiculo_modelo}
          </p>
          <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium inline-block border ${estadoInfo.color}`}>
            {estadoInfo.label}
          </div>
        </div>

        {/* Mensaje según estado */}
        <div className={`p-3 rounded-lg mb-4 border ${estadoInfo.color}`}>
          <p className="text-sm">{estadoInfo.message}</p>
        </div>

        {/* PDF actual */}
        {venta.pdf_url && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Documento actual:</p>
            <a 
              href={venta.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm flex items-center space-x-1"
            >
              <FileText className="w-4 h-4" />
              <span>Ver documento actual</span>
            </a>
          </div>
        )}

        {/* Subir nuevo PDF */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nuevo documento (PDF/Imagen) *
          </label>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setPdf(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {pdf && (
            <p className="text-sm text-green-600 mt-2 flex items-center space-x-1">
              <CheckCircle className="w-4 h-4" />
              <span>{pdf.name}</span>
            </p>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleSubmit}
            disabled={!pdf || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center space-x-2"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Subiendo...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Subir Documentación</span>
              </>
            )}
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: NUEVA VENTA
function ModalNuevaVenta({
  leads,
  ventasExistentes,
  onSubmit,
  onClose
}: {
  leads: LeadType[];
  ventasExistentes: VentaScoring[];
  onSubmit: (data: { lead_id: number; fecha_venta: string; notas_vendedor?: string; tipo_venta?: string; pdf?: File }) => void;
  onClose: () => void;
}) {
  const [leadId, setLeadId] = useState<number | ''>('');
  const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [tipoVenta, setTipoVenta] = useState<string>('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [searchLead, setSearchLead] = useState('');

  // Calcular fechas min/max para el mes actual
  const now = new Date();
  const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // IDs de leads que ya tienen venta en scoring (para evitar duplicados)
  const leadsConVenta = new Set(ventasExistentes.map(v => v.lead_id));

  const leadsFiltrados = leads.filter(l => {
    // Excluir leads que ya tienen venta en scoring
    if (leadsConVenta.has(l.id)) return false;
    
    const search = searchLead.toLowerCase();
    return l.nombre.toLowerCase().includes(search) || 
           l.telefono.includes(search) || 
           l.modelo.toLowerCase().includes(search);
  });

  const handleSubmit = () => {
    if (!leadId) {
      alert('Seleccioná un lead');
      return;
    }
    if (!tipoVenta) {
      alert('Seleccioná el tipo de venta');
      return;
    }
    onSubmit({
      lead_id: leadId as number,
      fecha_venta: fechaVenta,
      notas_vendedor: notas || undefined,
      tipo_venta: tipoVenta,
      pdf: pdf || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Nueva Venta para Scoring</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="space-y-4">
          {/* Buscar Lead */}
          <div>
            <label className="block text-sm font-medium mb-1">Buscar Lead</label>
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o modelo..."
              value={searchLead}
              onChange={(e) => setSearchLead(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Seleccionar Lead */}
          <div>
            <label className="block text-sm font-medium mb-1">Seleccionar Lead *</label>
            {leadsFiltrados.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                No hay leads disponibles para cargar. Los leads que ya tienen una venta en scoring no se muestran.
              </div>
            ) : (
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Seleccionar --</option>
                {leadsFiltrados.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.nombre} - {lead.telefono} - {lead.modelo}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha de Venta */}
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Venta * (solo mes actual)</label>
            <input
              type="date"
              value={fechaVenta}
              min={primerDiaMes}
              max={ultimoDiaMes}
              onChange={(e) => setFechaVenta(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Solo podés cargar ventas del mes actual</p>
          </div>

          {/* Tipo de Venta */}
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Venta *</label>
            <select
              value={tipoVenta}
              onChange={(e) => setTipoVenta(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Seleccionar --</option>
              <option value="convencional">Convencional</option>
              <option value="adjudicado">Adjudicado</option>
              <option value="plan">Plan</option>
            </select>
          </div>

          {/* PDF */}
          <div>
            <label className="block text-sm font-medium mb-1">Documento (PDF/Imagen)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setPdf(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {pdf && <p className="text-sm text-green-600 mt-1">✓ {pdf.name}</p>}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Crear Venta
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: AUTORIZAR
function ModalAutorizar({
  venta,
  onAutorizar,
  onClose
}: {
  venta: VentaScoring;
  onAutorizar: (pv: string, medioPago: string) => void;
  onClose: () => void;
}) {
  const [pv, setPv] = useState('');
  const [medioPago, setMedioPago] = useState('');

  const handleAutorizar = () => {
    if (!pv.trim() || !medioPago) {
      alert('PV y medio de pago son obligatorios');
      return;
    }
    onAutorizar(pv, medioPago);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Autorizar Venta</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="font-medium text-green-800">¿Autorizar esta venta?</p>
          <div className="mt-2 text-sm text-green-700">
            <p><strong>Cliente:</strong> {venta.cliente_nombre}</p>
            <p><strong>Vehículo:</strong> {venta.vehiculo_modelo}</p>
            <p><strong>Vendedor:</strong> {venta.vendedor_nombre}</p>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PV *
            </label>
            <input
              type="text"
              value={pv}
              onChange={(e) => setPv(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Ej: 12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medio de Pago *
            </label>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seleccionar...</option>
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta_credito">💳 Tarjeta de Crédito</option>
              <option value="visa_web">🌐 Visa Web</option>
              <option value="transferencia">🏦 Transferencia</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Al autorizar, la venta pasará a Scoring para su procesamiento.
        </p>

        <div className="flex space-x-3">
          <button
            onClick={handleAutorizar}
            disabled={!pv.trim() || !medioPago}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Autorizar</span>
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: RECHAZAR
function ModalRechazar({
  venta,
  onRechazar,
  onClose
}: {
  venta: VentaScoring;
  onRechazar: (motivo: string) => void;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-red-600">Rechazar Venta</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">
            <strong>Cliente:</strong> {venta.cliente_nombre}<br />
            <strong>Vehículo:</strong> {venta.vehiculo_modelo}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-red-700 mb-1">
            Motivo del rechazo *
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 border border-red-300 rounded-lg h-24 resize-none"
            placeholder="Explicar el motivo..."
          />
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-800">
            ⚠️ Al rechazar, el lead pasará a estado "Rechazado por Supervisor" y no se podrá crear otra venta hasta que el owner lo reactive.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => {
              if (!motivo.trim()) {
                alert('El motivo es obligatorio');
                return;
              }
              onRechazar(motivo);
            }}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Rechazar</span>
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: PROCESAR
function ModalProcesar({
  venta,
  onCambiarEstado,
  onClose
}: {
  venta: VentaScoring;
  onCambiarEstado: (ventaId: number, estado: string, notas?: string, motivo?: string) => void;
  onClose: () => void;
}) {
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [notas, setNotas] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const estadoActual = venta.estado;

  const getOpcionesEstado = () => {
    // Estados de Scoring (procesamiento)
    if (['asignada', 'en_proceso', 'observada'].includes(estadoActual)) {
      return [
        { value: 'en_proceso', label: 'En Proceso', color: 'bg-orange-500' },
        { value: 'pendiente_pago', label: 'Pendiente de Pago', color: 'bg-cyan-500' },
        { value: 'observada', label: 'Observar', color: 'bg-amber-500' },
        { value: 'rechazada', label: 'Rechazar', color: 'bg-red-500' },
      ];
    }
    
    // Estados de Cobranza - puede moverse libremente entre seña, finalizada y cargada
    if (['pendiente_pago', 'seña', 'finalizada', 'cargada_concesionario'].includes(estadoActual)) {
      return [
        { value: 'seña', label: 'Señada', color: 'bg-teal-500' },
        { value: 'finalizada', label: 'Finalizada', color: 'bg-green-500' },
        { value: 'cargada_concesionario', label: 'Cargada en Concesionario', color: 'bg-emerald-600' },
      ].filter(opt => opt.value !== estadoActual); // Excluir estado actual
    }

    return [];
  };

  const opcionesEstado = getOpcionesEstado();
  const necesitaMotivo = ['observada', 'rechazada'].includes(nuevoEstado);

  if (opcionesEstado.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-lg text-center">
          <p className="text-gray-600">No hay acciones disponibles para esta venta.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Procesar Venta #{venta.id}</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Cliente:</span> {venta.cliente_nombre}</div>
            <div><span className="font-medium">PV:</span> {venta.pv || 'N/A'}</div>
            <div><span className="font-medium">Vehículo:</span> {venta.vehiculo_modelo}</div>
            <div><span className="font-medium">Medio Pago:</span> {venta.medio_pago ? mediosPago[venta.medio_pago]?.label : 'N/A'}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Cambiar Estado a:</label>
            <div className="space-y-2">
              {opcionesEstado.map(opcion => (
                <label 
                  key={opcion.value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    nuevoEstado === opcion.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="estado"
                    value={opcion.value}
                    checked={nuevoEstado === opcion.value}
                    onChange={(e) => setNuevoEstado(e.target.value)}
                    className="mr-3"
                  />
                  <span className={`px-2 py-1 rounded text-white text-xs mr-2 ${opcion.color}`}>
                    {opcion.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {necesitaMotivo && (
            <div>
              <label className="block text-sm font-medium mb-1 text-red-600">
                Motivo del {nuevoEstado === 'rechazada' ? 'rechazo' : 'observación'} *
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-lg h-20 resize-none"
                placeholder="Explicar motivo..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notas adicionales</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
              placeholder="Observaciones..."
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={() => onCambiarEstado(venta.id, nuevoEstado, notas, motivoRechazo)}
            disabled={!nuevoEstado || (necesitaMotivo && !motivoRechazo)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            Guardar Cambios
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: DETALLES
function ModalDetalles({
  venta,
  onClose
}: {
  venta: VentaScoring;
  onClose: () => void;
}) {
  const estadoConfig = estadosConfig[venta.estado];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Detalles Venta #{venta.id}</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="flex items-center mb-4">
          <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${estadoConfig.color}`}>
            {estadoConfig.label}
          </span>
          {venta.pdf_url && (
            <a href={venta.pdf_url} target="_blank" rel="noopener noreferrer" className="ml-4 text-blue-600 hover:underline flex items-center">
              <FileText size={16} className="mr-1" /> Ver PDF
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Cliente</h4>
            <p className="text-sm">{venta.cliente_nombre}</p>
            <p className="text-sm text-gray-500">{venta.cliente_telefono}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Vehículo</h4>
            <p className="text-sm">{venta.vehiculo_modelo}</p>
            
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Vendedor</h4>
            <p className="text-sm">{venta.vendedor_nombre}</p>
            <p className="text-sm text-gray-500">Supervisor: {venta.supervisor_nombre || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Scoring</h4>
            <p className="text-sm">{venta.scoring_nombre || 'Sin asignar'}</p>
            {venta.pv && <p className="text-sm text-gray-500">PV: {venta.pv}</p>}
          </div>
        </div>

        {venta.motivo_rechazo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-red-800 mb-1">Motivo</h4>
            <p className="text-sm text-red-700">{venta.motivo_rechazo}</p>
          </div>
        )}

        {(venta.notas_vendedor || venta.notas_scoring || venta.notas_cobranza) && (
          <div className="space-y-2 mb-6">
            <h4 className="font-semibold text-gray-800">Notas</h4>
            {venta.notas_vendedor && (
              <div className="bg-blue-50 p-3 rounded">
                <span className="text-xs text-blue-600 font-medium">Vendedor:</span>
                <p className="text-sm">{venta.notas_vendedor}</p>
              </div>
            )}
            {venta.notas_scoring && (
              <div className="bg-purple-50 p-3 rounded">
                <span className="text-xs text-purple-600 font-medium">Scoring:</span>
                <p className="text-sm whitespace-pre-wrap">{venta.notas_scoring}</p>
              </div>
            )}
            {venta.notas_cobranza && (
              <div className="bg-green-50 p-3 rounded">
                <span className="text-xs text-green-600 font-medium">Cobranza:</span>
                <p className="text-sm whitespace-pre-wrap">{venta.notas_cobranza}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL: MENSAJES CON CAMBIO DE ESTADO
function ModalMensajes({
  venta,
  mensajes,
  loading,
  currentUserId,
  currentUserRole,
  onEnviar,
  onCambiarEstado,
  onClose
}: {
  venta: VentaScoring;
  mensajes: MensajeScoring[];
  loading: boolean;
  currentUserId: number;
  currentUserRole: string;
  onEnviar: (mensaje: string, tipo: string) => void;
  onCambiarEstado: (ventaId: number, nuevoEstado: string, notas: string, motivoRechazo: string) => void;
  onClose: () => void;
}) {
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [showEstados, setShowEstados] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleEnviar = (tipo: string = 'respuesta') => {
    if (!nuevoMensaje.trim()) return;
    onEnviar(nuevoMensaje, tipo);
    setNuevoMensaje('');
  };

  // Determinar si puede cambiar estados
  const canProcesarScoring = ['owner', 'director', 'jefe_scoring', 'scoring'].includes(currentUserRole);
  const canProcesarCobranza = ['owner', 'director', 'jefe_scoring', 'cobranza'].includes(currentUserRole);
  const esVendedor = ['vendedor', 'supervisor'].includes(currentUserRole);
  
  // Estados que puede manejar scoring
  const puedeProcegarScoring = canProcesarScoring && ['asignada', 'en_proceso', 'observada'].includes(venta.estado);
  // Estados que puede manejar cobranza
  const puedeProcesarCobranza = canProcesarCobranza && ['pendiente_pago', 'seña', 'finalizada', 'cargada_concesionario'].includes(venta.estado);
  // Vendedor puede marcar corregido cuando está observada
  const puedeMarcarCorregido = esVendedor && venta.estado === 'observada';

  const getOpcionesEstado = () => {
    if (puedeProcegarScoring) {
      return [
        { value: 'en_proceso', label: 'En Proceso', color: 'bg-orange-500' },
        { value: 'pendiente_pago', label: 'Aprobado - Pendiente Pago', color: 'bg-cyan-500' },
        { value: 'observada', label: 'Observar', color: 'bg-amber-500' },
        { value: 'rechazada', label: 'Rechazar', color: 'bg-red-500' },
      ].filter(opt => opt.value !== venta.estado);
    }
    if (puedeProcesarCobranza) {
      return [
        { value: 'seña', label: 'Señada', color: 'bg-teal-500' },
        { value: 'finalizada', label: 'Finalizada', color: 'bg-green-500' },
        { value: 'cargada_concesionario', label: 'Cargada en Concesionario', color: 'bg-emerald-600' },
      ].filter(opt => opt.value !== venta.estado);
    }
    return [];
  };

  const handleCambiarEstado = (nuevoEstado: string) => {
    const mensaje = nuevoMensaje.trim();
    onCambiarEstado(venta.id, nuevoEstado, mensaje, nuevoEstado === 'rechazada' ? mensaje : '');
    setNuevoMensaje('');
    setShowEstados(false);
  };

  const handleMarcarCorregido = () => {
    if (!nuevoMensaje.trim()) {
      alert('Escribí un mensaje explicando la corrección');
      return;
    }
    onEnviar(nuevoMensaje, 'correccion');
    onCambiarEstado(venta.id, 'en_proceso', 'Corrección enviada por vendedor', '');
    setNuevoMensaje('');
  };

  const estadoConfig: Record<string, { label: string; color: string }> = {
    pendiente_supervisor: { label: 'Pendiente Supervisor', color: 'bg-yellow-500' },
    ingresada: { label: 'Ingresada', color: 'bg-blue-500' },
    asignada: { label: 'Asignada', color: 'bg-indigo-500' },
    en_proceso: { label: 'En Proceso', color: 'bg-orange-500' },
    observada: { label: 'Observada', color: 'bg-amber-500' },
    rechazada: { label: 'Rechazada', color: 'bg-red-500' },
    pendiente_pago: { label: 'Pendiente de Pago', color: 'bg-cyan-500' },
    seña: { label: 'Señada', color: 'bg-teal-500' },
    finalizada: { label: 'Finalizada', color: 'bg-green-500' },
    cargada_concesionario: { label: 'Cargada en Concesionario', color: 'bg-emerald-600' },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl h-[700px] flex flex-col">
        {/* Header con estado */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">Venta #{venta.id} - {venta.cliente_nombre}</h3>
              <p className="text-sm text-gray-500">{venta.vehiculo_modelo} • Vendedor: {venta.vendedor_nombre}</p>
            </div>
            <button onClick={onClose}><X size={24} /></button>
          </div>
          
          {/* Estado actual */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Estado:</span>
              <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${estadoConfig[venta.estado]?.color || 'bg-gray-500'}`}>
                {estadoConfig[venta.estado]?.label || venta.estado}
              </span>
            </div>
            
            {/* Botón cambiar estado (solo scoring/cobranza) */}
            {(puedeProcegarScoring || puedeProcesarCobranza) && (
              <button
                onClick={() => setShowEstados(!showEstados)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center space-x-1"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Cambiar Estado</span>
              </button>
            )}
          </div>

          {/* Opciones de estado */}
          {showEstados && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium mb-2">Cambiar estado a:</p>
              <div className="flex flex-wrap gap-2">
                {getOpcionesEstado().map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleCambiarEstado(opt.value)}
                    className={`px-3 py-1 rounded-full text-white text-sm ${opt.color} hover:opacity-80`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {nuevoMensaje.trim() && (
                <p className="text-xs text-gray-500 mt-2">
                  💡 El mensaje escrito se guardará como nota del cambio
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : mensajes.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No hay mensajes</p>
              <p className="text-sm">Iniciá la conversación enviando un mensaje</p>
            </div>
          ) : (
            mensajes.map(msg => (
              <div 
                key={msg.id}
                className={`flex ${msg.remitente_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${
                  msg.remitente_id === currentUserId 
                    ? 'bg-blue-600 text-white' 
                    : msg.tipo === 'observacion' 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : msg.tipo === 'correccion'
                        ? 'bg-green-100 text-green-900 border border-green-300'
                        : msg.tipo === 'sistema'
                          ? 'bg-gray-200 text-gray-700 italic'
                          : 'bg-white text-gray-800 border border-gray-200'
                }`}>
                  <div className={`text-xs mb-1 flex items-center space-x-1 ${
                    msg.remitente_id === currentUserId ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    <span className="font-medium">{msg.remitente_nombre}</span>
                    <span>•</span>
                    <span>{msg.remitente_rol}</span>
                    {msg.tipo === 'observacion' && <span className="ml-1">⚠️</span>}
                    {msg.tipo === 'correccion' && <span className="ml-1">✅</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                  <p className={`text-xs mt-1 ${msg.remitente_id === currentUserId ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input y acciones */}
        <div className="p-4 border-t bg-white">
          {/* Alerta si está observada (para vendedor) */}
          {puedeMarcarCorregido && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                ⚠️ Esta venta tiene observaciones. Respondé explicando la corrección y hacé click en "Enviar Corrección".
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !puedeMarcarCorregido && handleEnviar()}
              placeholder={puedeMarcarCorregido ? "Explicar la corrección realizada..." : "Escribir mensaje..."}
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            {puedeMarcarCorregido ? (
              <button
                onClick={handleMarcarCorregido}
                disabled={!nuevoMensaje.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center space-x-1"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Enviar Corrección</span>
              </button>
            ) : (
              <button
                onClick={() => handleEnviar()}
                disabled={!nuevoMensaje.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}