import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Mail, Save, Eye, Send, RotateCcw, ChevronRight, ChevronDown,
  Copy, Check, Loader2, Code, FileText, Users, 
  DollarSign, Settings, Search, Bold, Italic, Link, List, 
  AlignLeft, AlignCenter, Palette
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Category icons and colors
const CATEGORIES = {
  atletas: { label: 'Atletas', icon: Users, color: 'bg-blue-100 text-blue-700' },
  voluntarios: { label: 'Voluntarios', icon: Users, color: 'bg-green-100 text-green-700' },
  pagos: { label: 'Pagos', icon: DollarSign, color: 'bg-amber-100 text-amber-700' },
  sistema: { label: 'Sistema', icon: Settings, color: 'bg-purple-100 text-purple-700' },
};

// Simple toolbar for HTML editing
const EditorToolbar = ({ onInsert }) => {
  const tools = [
    { icon: Bold, label: 'Negrita', html: '<strong>texto</strong>' },
    { icon: Italic, label: 'Cursiva', html: '<em>texto</em>' },
    { icon: Link, label: 'Enlace', html: '<a href="URL" style="color: #ea580c;">texto</a>' },
    { icon: List, label: 'Lista', html: '<ul><li>Elemento 1</li><li>Elemento 2</li></ul>' },
    { icon: AlignCenter, label: 'Centrar', html: '<div style="text-align: center;">texto</div>' },
    { icon: Palette, label: 'Color', html: '<span style="color: #ea580c;">texto</span>' },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
      {tools.map((tool) => (
        <Button
          key={tool.label}
          variant="ghost"
          size="sm"
          onClick={() => onInsert(tool.html)}
          title={tool.label}
        >
          <tool.icon className="w-4 h-4" />
        </Button>
      ))}
    </div>
  );
};

// Merge field panel component
const MergeFieldsPanel = ({ mergeFields }) => {
  const [expandedSources, setExpandedSources] = useState(['race', 'athlete']);
  const [copiedField, setCopiedField] = useState(null);

  const toggleSource = (source) => {
    setExpandedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const handleCopy = (field) => {
    navigator.clipboard.writeText(field.key);
    setCopiedField(field.key);
    toast.success(`Campo "${field.key}" copiado`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const sourceIcons = {
    race: '🏁',
    athlete: '🏃',
    volunteer: '🙋',
    payment: '💳',
    general: '⚙️'
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Haz clic en un campo para copiarlo
      </p>
      {Object.entries(mergeFields).map(([source, data]) => (
        <div key={source} className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
            onClick={() => toggleSource(source)}
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <span>{sourceIcons[source]}</span>
              {data.label}
            </span>
            {expandedSources.includes(source) ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {expandedSources.includes(source) && (
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {data.fields.map((field) => (
                <button
                  key={field.key}
                  onClick={() => handleCopy(field)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-mono">
                      {field.key}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {field.label}
                    </p>
                  </div>
                  {copiedField === field.key ? (
                    <Check className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground ml-2 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Template editor component
const TemplateEditor = ({ template, onSave, onReset }) => {
  const [subject, setSubject] = useState(template.subject || '');
  const [content, setContent] = useState(template.content || '');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');

  // Load preview function
  const loadPreview = async (templateId) => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`${API_URL}/api/email-templates/preview?template_id=${templateId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        toast.error('Error al cargar la vista previa');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoadingPreview(false);
    }
  };

  // When template changes, update content and reload preview if on preview tab
  useEffect(() => {
    setSubject(template.subject || '');
    setContent(template.content || '');
    setPreview(null);
    
    // If currently on preview tab, automatically load the new template's preview
    if (activeTab === 'preview') {
      loadPreview(template.id);
    }
  }, [template.id, template.subject, template.content]);

  const handleInsertHtml = (html) => {
    setContent(prev => prev + '\n' + html);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/email-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content })
      });

      if (response.ok) {
        toast.success('Plantilla guardada exitosamente');
        onSave({ ...template, subject, content });
      } else {
        toast.error('Error al guardar la plantilla');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('¿Estás seguro de restablecer esta plantilla a sus valores por defecto?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/email-templates/reset/${template.id}`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Plantilla restablecida');
        onReset(template.id);
      } else {
        toast.error('Error al restablecer');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`${API_URL}/api/email-templates/preview?template_id=${template.id}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        toast.error('Error al cargar la vista previa');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Ingresa un correo válido');
      return;
    }

    setSendingTest(true);
    try {
      const response = await fetch(`${API_URL}/api/email-templates/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          to_email: testEmail
        })
      });

      if (response.ok) {
        toast.success(`Correo de prueba enviado a ${testEmail}`);
        setTestEmail('');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar correo de prueba');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSendingTest(false);
    }
  };

  const categoryInfo = CATEGORIES[template.category] || CATEGORIES.sistema;
  const CategoryIcon = categoryInfo.icon;

  return (
    <div className="space-y-6">
      {/* Template Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={categoryInfo.color}>
              <CategoryIcon className="w-3 h-3 mr-1" />
              {categoryInfo.label}
            </Badge>
          </div>
          <h3 className="text-xl font-bold">{template.name}</h3>
          <p className="text-muted-foreground">{template.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {/* Subject Line */}
      <div className="space-y-2">
        <Label htmlFor="subject">Asunto del correo</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Asunto del correo..."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Puedes usar campos de combinación como {'{{athlete_nombre}}'} en el asunto
        </p>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if(v === 'preview') loadPreview(); }}>
        <TabsList>
          <TabsTrigger value="editor">
            <Code className="w-4 h-4 mr-2" />
            Editor HTML
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            Vista Previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            <EditorToolbar onInsert={handleInsertHtml} />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm resize-none focus:outline-none"
              placeholder="<div>Contenido HTML del correo...</div>"
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Asunto:</CardDescription>
                  <CardTitle className="text-base">{preview.subject}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <iframe
                    srcDoc={preview.content}
                    className="w-full h-96 border-0"
                    title="Email Preview"
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Cargando vista previa...
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Test Email Section */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" />
            Enviar Correo de Prueba
          </CardTitle>
          <CardDescription>
            Envía un correo de prueba con datos de ejemplo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={sendTestEmail} disabled={sendingTest}>
              {sendingTest ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main component
export default function EmailTemplatesManagement() {
  const [templates, setTemplates] = useState([]);
  const [mergeFields, setMergeFields] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, fieldsRes] = await Promise.all([
        fetch(`${API_URL}/api/email-templates/`),
        fetch(`${API_URL}/api/email-templates/merge-fields`)
      ]);

      if (templatesRes.ok && fieldsRes.ok) {
        const templatesData = await templatesRes.json();
        const fieldsData = await fieldsRes.json();
        setTemplates(templatesData);
        setMergeFields(fieldsData);
        if (templatesData.length > 0 && !selectedTemplate) {
          setSelectedTemplate(templatesData[0]);
        }
      }
    } catch (error) {
      toast.error('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (updatedTemplate) => {
    setTemplates(prev => prev.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ));
  };

  const handleReset = async (templateId) => {
    await loadData();
    const updated = templates.find(t => t.id === templateId);
    if (updated) {
      setSelectedTemplate(updated);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Plantillas de Correo</h2>
          <p className="text-muted-foreground">
            Personaliza los correos que se envían automáticamente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Template List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plantilla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-1">
            <Button
              variant={filterCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategory('all')}
            >
              Todas
            </Button>
            {Object.entries(CATEGORIES).map(([key, value]) => (
              <Button
                key={key}
                variant={filterCategory === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory(key)}
              >
                {value.label}
              </Button>
            ))}
          </div>

          {/* Template List */}
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredTemplates.map((template) => {
                  const categoryInfo = CATEGORIES[template.category] || CATEGORIES.sistema;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'bg-primary/10 border-l-4 border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${categoryInfo.color}`}>
                          {categoryInfo.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{template.name}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Merge Fields Panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Campos de Combinación</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MergeFieldsPanel mergeFields={mergeFields} />
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Template Editor */}
        <div className="lg:col-span-3">
          {selectedTemplate ? (
            <Card>
              <CardContent className="pt-6">
                <TemplateEditor
                  template={selectedTemplate}
                  onSave={handleSave}
                  onReset={handleReset}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Selecciona una plantilla para editarla
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
