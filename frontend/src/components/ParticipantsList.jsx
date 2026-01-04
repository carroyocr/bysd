import React, { useState, useMemo } from 'react';
import { Users, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function ParticipantsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('');

  const participants = [
    { bib: '001', nombre: 'Lucas', apellidos: 'Gaitán', nacionalidad: 'COL' },
    { bib: '002', nombre: 'Hamlet', apellidos: 'Burgos Frías', nacionalidad: 'DOM' },
    { bib: '003', nombre: 'Carlos', apellidos: 'Camejo', nacionalidad: 'VEN' },
    { bib: '004', nombre: 'Tomas', apellidos: 'Ruíz Ornes', nacionalidad: 'DOM' },
    { bib: '005', nombre: 'Francesco', apellidos: 'Biondi', nacionalidad: 'DOM' },
    { bib: '006', nombre: 'Víctor Hugo', apellidos: 'Moreno Contreras', nacionalidad: 'MEX' },
    { bib: '007', nombre: 'Herbert Martin Klaus', apellidos: 'Scharf Rodríguez', nacionalidad: 'DOM' },
    { bib: '008', nombre: 'Judelka Altagracia', apellidos: 'Vargas Almonte', nacionalidad: 'DOM' },
    { bib: '009', nombre: 'José Ángel', apellidos: 'Rondón', nacionalidad: 'VEN' },
    { bib: '010', nombre: 'Cristian', apellidos: 'Minaya Domínguez', nacionalidad: 'DOM' },
    { bib: '011', nombre: 'Luis Emilio', apellidos: 'Cabral Rivera', nacionalidad: 'DOM' },
    { bib: '012', nombre: 'Enemencio', apellidos: 'Pérez', nacionalidad: 'DOM' },
    { bib: '013', nombre: 'Walter Damián', apellidos: 'Parra', nacionalidad: 'DOM' },
    { bib: '014', nombre: 'Jorge', apellidos: 'Toribio', nacionalidad: 'DOM' },
    { bib: '015', nombre: 'Olimpia', apellidos: 'Arellano Campos', nacionalidad: 'MEX' },
    { bib: '016', nombre: 'Aivaliklis', apellidos: 'Jeanluc', nacionalidad: 'FRA' },
    { bib: '017', nombre: 'Ma Eugenia', apellidos: 'Aguilar Mendizabal', nacionalidad: 'MEX' },
    { bib: '018', nombre: 'Carlos Alberto', apellidos: 'Ovalle', nacionalidad: 'DOM' },
    { bib: '019', nombre: 'Gustavo', apellidos: 'Percivaldi', nacionalidad: 'ARG' },
    { bib: '020', nombre: 'Iván', apellidos: 'Ortega', nacionalidad: 'MEX' },
    { bib: '021', nombre: 'Miguel', apellidos: 'Vásquez', nacionalidad: 'DOM' },
    { bib: '022', nombre: 'Luis Antonio', apellidos: 'De León Encarnación', nacionalidad: 'DOM' },
    { bib: '023', nombre: 'Moisés', apellidos: 'Encarnación Tapia', nacionalidad: 'DOM' },
    { bib: '024', nombre: 'Alexandra', apellidos: 'Jeronimo', nacionalidad: 'USA' },
    { bib: '025', nombre: 'Arturo', apellidos: 'Valdez', nacionalidad: 'DOM' },
    { bib: '026', nombre: 'Fausto', apellidos: 'Batista Meléndez', nacionalidad: 'DOM' },
    { bib: '027', nombre: 'Kathy', apellidos: 'Español', nacionalidad: 'DOM' },
    { bib: '028', nombre: 'Yoselin', apellidos: 'Peña', nacionalidad: 'DOM' },
    { bib: '029', nombre: 'Yesenia', apellidos: 'Grullon', nacionalidad: 'DOM' },
    { bib: '030', nombre: 'Braulio', apellidos: 'Jiménez De La Rosa', nacionalidad: 'DOM' },
    { bib: '031', nombre: 'Yeirys', apellidos: 'Soto', nacionalidad: 'DOM' },
    { bib: '032', nombre: 'Tommy', apellidos: 'García Sánchez', nacionalidad: 'DOM' },
    { bib: '033', nombre: 'Heldra', apellidos: 'Garib Valori', nacionalidad: 'DOM' },
    { bib: '034', nombre: 'José Gabriel', apellidos: 'Rodríguez López', nacionalidad: 'DOM' },
    { bib: '035', nombre: 'Sissy', apellidos: 'Jorge De Mencía', nacionalidad: 'DOM' },
    { bib: '036', nombre: 'Julio Eduardo', apellidos: 'Molina Canahuate', nacionalidad: 'DOM' },
    { bib: '037', nombre: 'George Omar', apellidos: 'Tejada Pimentel', nacionalidad: 'DOM' },
    { bib: '038', nombre: 'Ismael', apellidos: 'Morillo Guzmán', nacionalidad: 'DOM' },
    { bib: '039', nombre: 'Ámbar Esmeralda', apellidos: 'De Los Santos', nacionalidad: 'DOM' },
    { bib: '040', nombre: 'Margaret', apellidos: 'Medrano', nacionalidad: 'DOM' },
    { bib: '041', nombre: 'Ana Amalia', apellidos: 'Blömer Mueses', nacionalidad: 'DOM' },
    { bib: '042', nombre: 'Pascal', apellidos: 'Sterlin', nacionalidad: 'HAI' },
    { bib: '043', nombre: 'Luis', apellidos: 'Pérez Ernst', nacionalidad: 'PER' },
    { bib: '044', nombre: 'Alberto', apellidos: 'Ruiz', nacionalidad: 'DOM' },
    { bib: '045', nombre: 'DAIYI', apellidos: 'Shiguetome Rodríguez', nacionalidad: 'JAP' },
    { bib: '046', nombre: 'Ernesto', apellidos: 'Ovalles Javier', nacionalidad: 'DOM' },
    { bib: '047', nombre: 'David', apellidos: 'Orellana', nacionalidad: 'VEN' },
    { bib: '048', nombre: 'Simón Bolívar', apellidos: 'Cepeda Lora', nacionalidad: 'DOM' },
    { bib: '049', nombre: 'Miltón', apellidos: 'Núñez Imbert', nacionalidad: 'DOM' },
    { bib: '050', nombre: 'Pedro', apellidos: 'Rodríguez Pérez', nacionalidad: 'DOM' },
    { bib: '051', nombre: 'Rodrigo', apellidos: 'Farach Aldana', nacionalidad: 'GUA' },
    { bib: '052', nombre: 'Bernardo', apellidos: 'De Jesús', nacionalidad: 'DOM' },
    { bib: '053', nombre: 'Jhoel', apellidos: 'Camacho Tejada', nacionalidad: 'DOM' },
    { bib: '054', nombre: 'Esteban Gabriel', apellidos: 'Senna', nacionalidad: 'BRA' },
    { bib: '055', nombre: 'Victor', apellidos: 'Kery', nacionalidad: 'DOM' },
    { bib: '056', nombre: 'Robert', apellidos: 'Duran Suarez', nacionalidad: 'DOM' },
    { bib: '057', nombre: 'Erick', apellidos: 'Paulino', nacionalidad: 'DOM' },
    { bib: '058', nombre: 'Cesar', apellidos: 'Encarnación Rodríguez', nacionalidad: 'DOM' },
    { bib: '059', nombre: 'Rafael', apellidos: 'Altuna Martínez', nacionalidad: 'DOM' },
    { bib: '060', nombre: 'Alexandra', apellidos: 'Mateo', nacionalidad: 'DOM' },
    { bib: '061', nombre: 'Even', apellidos: 'Lafay', nacionalidad: 'FRA' },
    { bib: '062', nombre: 'Cristian', apellidos: 'Ballenilla', nacionalidad: 'DOM' },
    { bib: '063', nombre: 'Jorge Lewis', apellidos: 'Camilo Tejada', nacionalidad: 'DOM' },
    { bib: '064', nombre: 'Carlos', apellidos: 'Burgos', nacionalidad: 'DOM' },
    { bib: '065', nombre: 'Samuel', apellidos: 'Rosario Franco', nacionalidad: 'DOM' },
    { bib: '066', nombre: 'Juan', apellidos: 'Pérez', nacionalidad: 'DOM' },
    { bib: '067', nombre: 'Ramon Alfredo', apellidos: 'Jose Rojas', nacionalidad: 'DOM' },
    { bib: '068', nombre: 'Juan Omar', apellidos: 'Jiménez Ortiz', nacionalidad: 'DOM' },
    { bib: '069', nombre: 'Joan', apellidos: 'Gomez Velazquez', nacionalidad: 'DOM' },
    { bib: '070', nombre: 'Oscar', apellidos: 'Moquete', nacionalidad: 'DOM' },
    { bib: '071', nombre: 'Carlos Bienvenido', apellidos: 'Ogando Montás', nacionalidad: 'DOM' },
    { bib: '072', nombre: 'Daphne Liliana', apellidos: 'Heyaime Fernández', nacionalidad: 'DOM' },
    { bib: '073', nombre: 'José Antonio', apellidos: 'Santos Leonardo', nacionalidad: 'DOM' },
    { bib: '074', nombre: 'Michelle', apellidos: 'Domínguez Ramírez', nacionalidad: 'DOM' },
    { bib: '075', nombre: 'Ana (Karina)', apellidos: 'Ortiz Guerrero', nacionalidad: 'DOM' },
    { bib: '076', nombre: 'Isabel', apellidos: 'Delgado', nacionalidad: 'DOM' },
    { bib: '077', nombre: 'Pedro Pablo', apellidos: 'Taveras', nacionalidad: 'DOM' },
    { bib: '078', nombre: 'Rommell', apellidos: 'Morel Tejada', nacionalidad: 'DOM' },
    { bib: '079', nombre: 'Alexis', apellidos: 'Vásquez', nacionalidad: 'DOM' },
    { bib: '080', nombre: 'Jacob', apellidos: 'Levinson', nacionalidad: 'USA' },
    { bib: '081', nombre: 'Kensey', apellidos: 'Pichardo Guillen', nacionalidad: 'DOM' },
    { bib: '082', nombre: 'Carlos Ariel', apellidos: 'De Jesús Chaljub', nacionalidad: 'DOM' },
    { bib: '083', nombre: 'Rudolf', apellidos: 'Scheidig', nacionalidad: 'DOM' },
    { bib: '084', nombre: 'Armando José', apellidos: 'Bisonó Estrella', nacionalidad: 'USA' },
    { bib: '085', nombre: 'Julio Alberto', apellidos: 'Minaya Fernández', nacionalidad: 'ESP' },
    { bib: '086', nombre: 'Gabriel', apellidos: 'Tapia', nacionalidad: 'DOM' },
    { bib: '087', nombre: 'Melany', apellidos: 'Vanegas', nacionalidad: 'DOM' },
    { bib: '088', nombre: 'Lennys del Rosario', apellidos: 'Jimenez Gonzalez', nacionalidad: 'VEN' },
    { bib: '089', nombre: 'Thais', apellidos: 'Herrera', nacionalidad: 'DOM' },
    { bib: '090', nombre: 'Livio', apellidos: 'Feliz', nacionalidad: 'DOM' },
  ];

  // Get unique nationalities for filter
  const nationalities = useMemo(() => {
    const unique = [...new Set(participants.map(p => p.nacionalidad))].sort();
    return unique;
  }, []);

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(participant => {
      const matchesSearch = 
        participant.bib.toLowerCase().includes(searchTerm.toLowerCase()) ||
        participant.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        participant.apellidos.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesNationality = !nationalityFilter || participant.nacionalidad === nationalityFilter;
      
      return matchesSearch && matchesNationality;
    });
  }, [searchTerm, nationalityFilter, participants]);

  return (
    <section className="py-12">
      <Card className="border-border shadow-medium">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Participantes 2026</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredParticipants.length} de {participants.length} atletas registrados
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mt-6">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por BIB, nombre o apellidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Nationality Filter */}
            <div className="md:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={nationalityFilter}
                  onChange={(e) => setNationalityFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas las nacionalidades</option>
                  {nationalities.map(nat => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Table - Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-foreground">BIB</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-foreground">Nombre</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-foreground">Apellidos</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-foreground">Nacionalidad</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant, index) => (
                  <tr key={participant.bib} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="font-mono">
                        {participant.bib}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{participant.nombre}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{participant.apellidos}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs">
                        {participant.nacionalidad}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards - Mobile */}
          <div className="md:hidden space-y-3">
            {filteredParticipants.map((participant) => (
              <div key={participant.bib} className="p-4 border border-border rounded-lg bg-card">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className="font-mono">
                    {participant.bib}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {participant.nacionalidad}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{participant.nombre}</p>
                  <p className="text-sm text-muted-foreground">{participant.apellidos}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredParticipants.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se encontraron participantes con los criterios de búsqueda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
