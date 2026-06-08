import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { RichTextEditor } from './RichTextEditor';
import {
  Send, Eye, Users, UserCheck, UserX, HandHelping, Mail, Loader2,
  AtSign, X, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FILTER_OPTIONS = [
  { key: 'all_athletes', label: 'Todos los atletas', icon: Users, color: 'text-blue-600' },
  { key: 'inscribed', label: 'Inscritos a carrera', icon: UserCheck, color: 'text-green-600' },
  { key: 'not_inscribed', label: 'No inscritos', icon: UserX, color: 'text-amber-600' },
  { key: 'volunteers', label: 'Voluntarios', icon: HandHelping, color: 'text-purple-600' },
  { key: 'manual', label: 'Correos específicos', icon: AtSign, color: 'text-gray-600' },
];

const MERGE_VARIABLES = [
  { tag: '{{nombre}}', label: 'Nombre' },
  { tag: '{{apellidos}}', label: 'Apellidos' },
  { tag: '{{nombre_completo}}', label: 'Nombre completo' },
  { tag: '{{email}}', label: 'Correo' },
];

export default function EmailComposer() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [filterType, setFilterType] = useState('all_athletes');
  const [raceCode, setRaceCode] = useState('');
  const [manualEmails, setManualEmails] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [raceConfigs, setRaceConfigs] = useState([]);
  const editorRef = useRef(null);

  const token = localStorage.getItem('admin_token');

  const insertVariable = (tag) => {
    if (editorRef.current) editorRef.current.insertVariable(tag);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/race-config/all`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setRaceConfigs(data || [])).catch(() => {});
  }, [token]);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const body = {
        filter_type: filterType,
        race_code: filterType === 'inscribed' ? raceCode : null,
        manual_emails: filterType === 'manual' ? manualEmails.split(/[,;\n]+/).filter(Boolean) : null,
      };
      const res = await fetch(`${API_URL}/api/athletes/admin/email-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch {
      toast.error('Error al cargar destinatarios');
    } finally {
      setLoadingRecipients(false);
    }
  }, [filterType, raceCode, manualEmails, token]);

  useEffect(() => {
    if (filterType !== 'manual') loadRecipients();
  }, [filterType, raceCode, loadRecipients]);

  const handlePreview = async () => {
    if (!subject.trim() || isContentEmpty) {
      toast.error('Escribe un asunto y contenido');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/athletes/admin/email-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, content }),
      });
      const data = await res.json();
      setPreviewHtml(data.html);
      setShowPreview(true);
    } catch {
      toast.error('Error al generar vista previa');
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || isContentEmpty) {
      toast.error('Escribe un asunto y contenido');
      return;
    }
    if (recipients.length === 0) {
      toast.error('No hay destinatarios seleccionados');
      return;
    }
    if (!window.confirm(`¿Enviar este correo a ${recipients.length} destinatario(s)?`)) return;

    setSending(true);
    try {
      const body = {
        subject,
        content,
        recipients: {
          filter_type: filterType,
          race_code: filterType === 'inscribed' ? raceCode : null,
          manual_emails: filterType === 'manual' ? manualEmails.split(/[,;\n]+/).filter(Boolean) : null,
        },
      };
      const res = await fetch(`${API_URL}/api/athletes/admin/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Correo enviado: ${data.sent} exitosos, ${data.failed} fallidos`);
      } else {
        toast.error(data.detail || 'Error al enviar');
      }
    } catch {
      toast.error('Error al enviar correo');
    } finally {
      setSending(false);
    }
  };

  const selectedFilter = FILTER_OPTIONS.find(f => f.key === filterType);
  const isContentEmpty = !content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

  return (
    <div className="space-y-6" data-testid="email-composer">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Recipients */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E8772E]" />
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
                      ? 'bg-[#E8772E]/10 border border-[#E8772E]/30 font-medium'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  data-testid={`filter-${key}`}
                >
                  <Icon className={`w-4 h-4 ${filterType === key ? 'text-[#E8772E]' : color}`} />
                  <span className="flex-1">{label}</span>
                  {filterType === key && key !== 'manual' && (
                    <Badge className="bg-[#E8772E] text-white text-xs">{recipients.length}</Badge>
                  )}
                </button>
              ))}

              {filterType === 'inscribed' && (
                <select
                  value={raceCode}
                  onChange={(e) => setRaceCode(e.target.value)}
                  className="w-full mt-2 border rounded-lg px-3 py-2 text-sm"
                  data-testid="race-select"
                >
                  <option value="">Todas las carreras</option>
                  {raceConfigs.map(rc => (
                    <option key={rc.code} value={rc.code}>{rc.name}</option>
                  ))}
                </select>
              )}

              {filterType === 'manual' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escribe los correos separados por comas o en líneas separadas"
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    rows={4}
                    className="text-sm"
                    data-testid="manual-emails"
                  />
                  <Button size="sm" variant="outline" onClick={loadRecipients} data-testid="load-manual-btn">
                    Cargar destinatarios
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipient list */}
          {recipients.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <button
                  onClick={() => setShowRecipients(!showRecipients)}
                  className="w-full flex items-center justify-between text-sm font-medium text-gray-700"
                  data-testid="toggle-recipients"
                >
                  <span>{recipients.length} destinatario(s)</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRecipients ? 'rotate-180' : ''}`} />
                </button>
                {showRecipients && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {recipients.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-gray-50">
                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{r.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Compose */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#E8772E]" />
                Redactar Correo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Asunto</label>
                <Input
                  placeholder="Asunto del correo"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="email-subject"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Contenido
                </label>
                <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Insertar variable:</span>
                  {MERGE_VARIABLES.map(({ tag, label }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable(tag)}
                      className="px-2 py-1 rounded-md bg-[#E8772E]/10 text-[#E8772E] text-xs font-medium hover:bg-[#E8772E]/20 transition-colors"
                      data-testid={`var-${tag.replace(/[{}]/g, '')}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <RichTextEditor
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  placeholder="Escribe el contenido del correo. Usa los botones de arriba para dar formato e insertar variables como el nombre del atleta..."
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Las variables (ej. {'{{nombre}}'}) se reemplazan por los datos de cada destinatario al enviar.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    {selectedFilter && <selectedFilter.icon className="w-3.5 h-3.5" />}
                    {selectedFilter?.label}
                  </span>
                  <Badge variant="outline">{recipients.length} destinatario(s)</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePreview} data-testid="preview-btn">
                    <Eye className="w-4 h-4 mr-2" />
                    Vista previa
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || isContentEmpty || recipients.length === 0}
                    className="bg-[#E8772E] hover:bg-[#d06a28]"
                    data-testid="send-btn"
                  >
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {sending ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="preview-modal">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Vista Previa del Correo</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} data-testid="close-preview">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-6">
              <div className="border rounded-lg overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>Cerrar</Button>
              <Button
                onClick={() => { setShowPreview(false); handleSend(); }}
                className="bg-[#E8772E] hover:bg-[#d06a28]"
                disabled={sending || recipients.length === 0}
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar a {recipients.length} destinatario(s)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
