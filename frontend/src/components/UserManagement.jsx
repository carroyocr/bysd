import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldOff, Trash2, 
  Save, X, Loader2, Eye, EyeOff, Edit2, CheckCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Available permissions
const PERMISSIONS = [
  { id: 'control', label: 'Panel de Control', description: 'Ver y gestionar la carrera en tiempo real' },
  { id: 'athletes', label: 'Atletas', description: 'Gestionar inscripciones y BIBs' },
  { id: 'finances', label: 'Finanzas', description: 'Ver y gestionar ingresos y gastos' },
  { id: 'volunteers', label: 'Voluntarios', description: 'Gestionar turnos y asignaciones' },
  { id: 'sponsors', label: 'Patrocinadores', description: 'Gestionar patrocinadores' },
  { id: 'surveys', label: 'Encuestas', description: 'Ver resultados de encuestas' },
  { id: 'config', label: 'Configuración', description: 'Configurar carrera y manuales' },
  { id: 'scanner', label: 'Escáner QR', description: 'Registrar vueltas con QR' },
  { id: 'users', label: 'Usuarios', description: 'Gestionar usuarios y permisos' },
];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New user form
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    nombre: '',
    email: '',
    permissions: ['scanner'] // Default permission
  });
  const [showPassword, setShowPassword] = useState(false);
  
  // Edit user
  const [editingUser, setEditingUser] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        // If endpoint doesn't exist yet, show empty
        setUsers([]);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error('Usuario y contraseña son requeridos');
      return;
    }
    
    if (!newUser.email) {
      toast.error('El email es requerido para enviar las credenciales');
      return;
    }
    
    if (newUser.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      
      if (response.ok) {
        toast.success('Usuario creado exitosamente');
        setNewUser({ username: '', password: '', nombre: '', email: '', permissions: ['scanner'] });
        setShowNewUserForm(false);
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al crear usuario');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePermissions = async (username) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/users/${username}/permissions`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: editPermissions })
      });
      
      if (response.ok) {
        toast.success('Permisos actualizados');
        setEditingUser(null);
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al actualizar permisos');
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`¿Estás seguro de eliminar el usuario "${username}"?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/users/${username}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Usuario eliminado');
        loadUsers();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Error al eliminar usuario');
      }
    } catch (err) {
      toast.error('Error de conexión');
    }
  };

  const togglePermission = (permId, isEdit = false) => {
    if (isEdit) {
      setEditPermissions(prev => 
        prev.includes(permId) 
          ? prev.filter(p => p !== permId)
          : [...prev, permId]
      );
    } else {
      setNewUser(prev => ({
        ...prev,
        permissions: prev.permissions.includes(permId)
          ? prev.permissions.filter(p => p !== permId)
          : [...prev.permissions, permId]
      }));
    }
  };

  const startEditPermissions = (user) => {
    setEditingUser(user.username);
    setEditPermissions(user.permissions || []);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cargando usuarios...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-muted-foreground">Administra usuarios y sus permisos de acceso al panel</p>
        </div>
        <Button onClick={() => setShowNewUserForm(true)} disabled={showNewUserForm}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* New User Form */}
      {showNewUserForm && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              Crear Nuevo Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value.toLowerCase() }))}
                  placeholder="nombre.usuario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@ejemplo.com"
                  required
                />
                <p className="text-xs text-muted-foreground">Las credenciales se enviarán a este correo</p>
              </div>
            </div>
            
            {/* Permissions */}
            <div className="space-y-2">
              <Label>Permisos</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PERMISSIONS.map(perm => (
                  <label 
                    key={perm.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      newUser.permissions.includes(perm.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newUser.permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="w-4 h-4 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateUser} disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Crear Usuario</>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewUserForm(false);
                  setNewUser({ username: '', password: '', nombre: '', email: '', permissions: ['scanner'] });
                }}
              >
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuarios Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay usuarios adicionales</p>
              <p className="text-sm">El usuario "admin" tiene acceso completo por defecto</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map(user => (
                <div 
                  key={user.username} 
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{user.username}</h3>
                        {user.is_admin && (
                          <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                        )}
                      </div>
                      {user.nombre && (
                        <p className="text-sm text-muted-foreground">{user.nombre}</p>
                      )}
                      {user.email && (
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                    
                    {!user.is_admin && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => startEditPermissions(user)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Permisos
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteUser(user.username)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Current permissions */}
                  {editingUser === user.username ? (
                    <div className="mt-4 pt-4 border-t">
                      <Label className="mb-2 block">Editar Permisos</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {PERMISSIONS.map(perm => (
                          <label 
                            key={perm.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              editPermissions.includes(perm.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editPermissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id, true)}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdatePermissions(user.username)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                          Guardar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEditingUser(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(user.permissions || []).map(perm => {
                        const permInfo = PERMISSIONS.find(p => p.id === perm);
                        return (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {permInfo?.label || perm}
                          </Badge>
                        );
                      })}
                      {user.is_admin && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          Acceso completo
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Nota sobre permisos:</p>
              <ul className="mt-1 list-disc list-inside text-blue-700">
                <li>El usuario "admin" siempre tiene acceso completo</li>
                <li>Los usuarios creados aquí solo pueden acceder a las secciones asignadas</li>
                <li>El permiso "Escáner QR" permite registrar vueltas durante la carrera</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
