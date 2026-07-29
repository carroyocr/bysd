import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import {
  Users, UserCheck, UserX, Clock, HandHelping, Loader2, Phone,
  ChevronDown, Download, MessageCircle, Eye, X, CheckCircle2, AlertTriangle, RotateCcw, ClipboardPaste
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FILTER_OPTIONS = [
  { key: 'all_athletes', label: 'Todos los atletas', icon: Users, color: 'text-blue-600' },
  { key: 'inscribed', label: 'Inscritos a carrera', icon: UserCheck, color: 'text-green-600' },
  { key: 'waitlist', label: 'Lista de espera', icon: Clock, color: 'text-amber-600' },
  { key: 'not_inscribed', label: 'No inscritos', icon: UserX, color: 'text-red-500' },
  { key: 'volunteers', label: 'Voluntarios', icon: HandHelping, color: 'text-purple-600' },
  { key: 'manual', label: 'Lista pegada', icon: ClipboardPaste, color: 'text-gray-600' },
];

const MERGE_VARIABLES = [
  { tag: '{{nombre}}', label: 'Nombre' },
  { tag: '{{apellidos}}', label: 'Apellidos' },
  { tag: '{{nombre_completo}}', label: 'Nombre completo' },
  { tag: '{{email}}', label: 'Correo' },
];

// Sustituye las variables de combinación con los datos del destinatario
// (las etiquetas más largas primero para evitar reemplazos parciales)
function personalizeMessage(text, recipient) {
  if (!text) return '';
  return text
    .replaceAll('{{nombre_completo}}', recipient.nombre_completo || '')
    .replaceAll('{{apellidos}}', recipient.apellidos || '')
    .replaceAll('{{nombre}}', recipient.nombre || '')
    .replaceAll('{{email}}', recipient.email || '');
}

function buildWhatsAppLink(recipient, message) {
  const text = personalizeMessage(message, recipient);
  return `https://api.whatsapp.com/send?phone=${recipient.whatsapp_phone}&text=${encodeURIComponent(text)}`;
}

export default function WhatsAppComposer() {
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState('all_athletes');
  const [raceCode, setRaceCode] = useState('');
  const [manualList, setManualList] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [withoutPhone, setWithoutPhone] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showWithoutPhone, setShowWithoutPhone] = useState(false);
  const [raceConfigs, setRaceConfigs] = useState([]);
  const [openedKeys, setOpenedKeys] = useState(new Set());
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const textareaRef = useRef(null);

  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    fetch(`${API_URL}/api/race-config/all`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setRaceConfigs(Array.isArray(data) ? data : (data?.races || [])))
      .catch(() => {});
  }, [token]);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const body = {
        filter_type: filterType,
        race_code: ['inscribed', 'waitlist'].includes(filterType) ? raceCode || null : null,
        manual_entries: filterType === 'manual'
          ? manualList.split(/\n+/).map(l => l.trim()).filter(Boolean)
          : null,
      };
      const res = await fetch(`${API_URL}/api/athletes/admin/whatsapp-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const all = data.recipients || [];
      setRecipients(all.filter(r => r.whatsapp_phone));
      setWithoutPhone(all.filter(r => !r.whatsapp_phone));
      setOpenedKeys(new Set());
    } catch {
      toast.error('Error al cargar destinatarios');
    } finally {
      setLoadingRecipients(false);
    }
  }, [filterType, raceCode, manualList, token]);

  useEffect(() => {
    if (filterType !== 'manual') loadRecipients();
  }, [filterType, raceCode, loadRecipients]);

  const insertVariable = (tag) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage(m => m + tag);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + tag + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    });
  };

  const recipientKey = (r) => `${r.whatsapp_phone}|${r.email}`;

  const openChat = (r) => {
    if (!message.trim()) {
      toast.error('Escribe el mensaje antes de abrir los chats');
      return;
    }
    window.open(buildWhatsAppLink(r, message), '_blank', 'noopener');
    setOpenedKeys(prev => new Set(prev).add(recipientKey(r)));
  };

  const openNextPending = () => {
    const next = recipients.find(r => !openedKeys.has(recipientKey(r)));
    if (!next) {
      toast.success('Ya abriste el chat de todos los destinatarios');
      return;
    }
    openChat(next);
  };

  const downloadLinksCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['#', 'Nombre', 'Teléfono', 'Correo', 'Enlace de WhatsApp'];
    const rows = recipients.map((r, i) => [
      i + 1,
      esc(r.nombre_completo),
      esc(r.telefono),
      esc(r.email),
      esc(buildWhatsAppLink(r, message)),
    ].join(','));
    const csv = '\uFEFF' + [header.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.download = `whatsapp-envios-${filterType}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedFilter = FILTER_OPTIONS.find(f => f.key === filterType);
  const openedCount = recipients.filter(r => openedKeys.has(recipientKey(r))).length;
  const sampleRecipient = recipients[0] || {
    nombre: 'Juan', apellidos: 'Pérez', nombre_completo: 'Juan Pérez', email: 'juan.perez@ejemplo.com',
  };

  return (
    <div className="space-y-6" data-testid="whatsapp-composer">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Recipients */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#25D366]" />
                Destinatarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {FILTER_OPTIONS.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                    filterType === key
                      ? 'bg-[#25D366]/10 border border-[#25D366]/40 font-medium'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  data-testid={`wa-filter-${key}`}
                >
                  <Icon className={`w-4 h-4 ${filterType === key ? 'text-[#128C7E]' : color}`} />
                  <span className="flex-1">{label}</span>
                  {filterType === key && (
                    loadingRecipients
                      ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      : <Badge className="bg-[#128C7E] text-white text-xs">{recipients.length}</Badge>
                  )}
                </button>
              ))}

              {filterType === 'manual' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder={'Un destinatario por línea, empezando por el teléfono:\n809-555-1234, Juan, Pérez, juan@ejemplo.com\n8295551234, María'}
                    value={manualList}
                    onChange={(e) => setManualList(e.target.value)}
                    rows={6}
                    className="text-sm"
                    data-testid="wa-manual-list"
                  />
                  <p className="text-xs text-gray-400">
                    Formato: teléfono, nombre, apellidos, correo (separados por coma, punto y coma
                    o tabulador; puedes pegar desde Excel). Solo el teléfono es obligatorio.
                  </p>
                  <Button size="sm" variant="outline" onClick={loadRecipients} data-testid="wa-load-manual-btn">
                    Cargar destinatarios
                  </Button>
                </div>
              )}

              {['inscribed', 'waitlist'].includes(filterType) && (
                <select
                  value={raceCode}
                  onChange={(e) => setRaceCode(e.target.value)}
                  className="w-full mt-2 border rounded-lg px-3 py-2 text-sm"
                  data-testid="wa-race-select"
                >
                  <option value="">Todas las carreras</option>
                  {(Array.isArray(raceConfigs) ? raceConfigs : []).map(rc => (
                    <option key={rc.code} value={rc.code}>{rc.name}</option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {withoutPhone.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3">
                <button
                  onClick={() => setShowWithoutPhone(!showWithoutPhone)}
                  className="w-full flex items-center justify-between text-sm font-medium text-amber-700"
                  data-testid="wa-toggle-without-phone"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {withoutPhone.length} sin teléfono válido
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showWithoutPhone ? 'rotate-180' : ''}`} />
                </button>
                {showWithoutPhone && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {withoutPhone.map((r, i) => (
                      <div key={i} className="text-xs text-amber-800 py-1 border-b border-amber-100">
                        <span className="font-medium">{r.nombre_completo || r.email}</span>
                        <span className="text-amber-600 ml-2">{r.telefono || 'sin número'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Compose + send list */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                Redactar Mensaje de WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Insertar variable:</span>
                  {MERGE_VARIABLES.map(({ tag, label }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable(tag)}
                      className="px-2 py-1 rounded-md bg-[#25D366]/10 text-[#128C7E] text-xs font-medium hover:bg-[#25D366]/20 transition-colors"
                      data-testid={`wa-var-${tag.replace(/[{}]/g, '')}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Textarea
                  ref={textareaRef}
                  placeholder={'Escribe el mensaje. Ej.: Hola {{nombre}}, te recordamos que...'}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="text-sm"
                  data-testid="wa-message"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Las variables (ej. {'{{nombre}}'}) se reemplazan por los datos de cada destinatario.
                  Al abrir cada chat, WhatsApp mostrará el mensaje listo: solo te queda pulsar enviar.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    {selectedFilter && <selectedFilter.icon className="w-3.5 h-3.5" />}
                    {selectedFilter?.label}
                  </span>
                  <Badge variant="outline">{recipients.length} con WhatsApp</Badge>
                  {openedCount > 0 && (
                    <Badge className="bg-[#128C7E] text-white">{openedCount} abiertos</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPreviewRecipient(sampleRecipient)}
                    disabled={!message.trim()}
                    data-testid="wa-preview-btn"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vista previa
                  </Button>
                  <Button
                    onClick={openNextPending}
                    disabled={!message.trim() || recipients.length === 0 || openedCount >= recipients.length}
                    className="bg-[#25D366] hover:bg-[#1ebe5b] text-white"
                    data-testid="wa-open-next-btn"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Abrir siguiente chat
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient send list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#25D366]" />
                  Envíos ({openedCount}/{recipients.length})
                </CardTitle>
                <div className="flex gap-2">
                  {openedCount > 0 && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => setOpenedKeys(new Set())}
                      data-testid="wa-reset-btn"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Reiniciar marcas
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    onClick={downloadLinksCsv}
                    disabled={recipients.length === 0}
                    data-testid="wa-export-btn"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar enlaces (CSV)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRecipients ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Cargando destinatarios...
                </div>
              ) : recipients.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No hay destinatarios con teléfono válido para este filtro.
                </p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
                  {recipients.map((r, i) => {
                    const opened = openedKeys.has(recipientKey(r));
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 py-2 text-sm ${opened ? 'opacity-60' : ''}`}
                        data-testid={`wa-recipient-${i}`}
                      >
                        <span className="text-gray-400 w-7 shrink-0 text-right text-xs">{i + 1}.</span>
                        {opened
                          ? <CheckCircle2 className="w-4 h-4 text-[#128C7E] shrink-0" />
                          : <MessageCircle className="w-4 h-4 text-gray-300 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-gray-700">{r.nombre_completo || r.email}</p>
                          <p className="text-xs text-gray-400 truncate">+{r.whatsapp_phone} · {r.telefono}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewRecipient(r)}
                          disabled={!message.trim()}
                          className="text-gray-400 hover:text-gray-600"
                          title="Ver mensaje combinado"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openChat(r)}
                          disabled={!message.trim()}
                          className={opened
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                            : 'bg-[#25D366] hover:bg-[#1ebe5b] text-white'}
                          data-testid={`wa-open-${i}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          {opened ? 'Reabrir' : 'Abrir chat'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {previewRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="wa-preview-modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Vista Previa del Mensaje</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewRecipient(null)} data-testid="wa-close-preview">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-6 bg-[#ECE5DD]">
              <p className="text-xs text-gray-500 mb-2">
                Para: <span className="font-medium">{previewRecipient.nombre_completo || previewRecipient.email}</span>
                {previewRecipient.whatsapp_phone && <span> · +{previewRecipient.whatsapp_phone}</span>}
              </p>
              <div className="bg-[#DCF8C6] rounded-lg rounded-tr-none p-3 ml-8 shadow-sm">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {personalizeMessage(message, previewRecipient)}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewRecipient(null)}>Cerrar</Button>
              {previewRecipient.whatsapp_phone && (
                <Button
                  onClick={() => { openChat(previewRecipient); setPreviewRecipient(null); }}
                  className="bg-[#25D366] hover:bg-[#1ebe5b] text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Abrir chat
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
