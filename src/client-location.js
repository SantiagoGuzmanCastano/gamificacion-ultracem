export const COLOMBIA_DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
  'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada', 'Bogotá D.C.',
];

export const COLOMBIA_CAPITALS = {
  Amazonas: 'Leticia',
  Antioquia: 'Medellín',
  Arauca: 'Arauca',
  Atlántico: 'Barranquilla',
  Bolívar: 'Cartagena de Indias',
  Boyacá: 'Tunja',
  Caldas: 'Manizales',
  Caquetá: 'Florencia',
  Casanare: 'Yopal',
  Cauca: 'Popayán',
  Cesar: 'Valledupar',
  Chocó: 'Quibdó',
  Córdoba: 'Montería',
  Cundinamarca: 'Bogotá',
  Guainía: 'Inírida',
  Guaviare: 'San José del Guaviare',
  Huila: 'Neiva',
  'La Guajira': 'Riohacha',
  Magdalena: 'Santa Marta',
  Meta: 'Villavicencio',
  Nariño: 'San Juan de Pasto',
  'Norte de Santander': 'San José de Cúcuta',
  Putumayo: 'Mocoa',
  Quindío: 'Armenia',
  Risaralda: 'Pereira',
  'San Andrés y Providencia': 'San Andrés',
  Santander: 'Bucaramanga',
  Sucre: 'Sincelejo',
  Tolima: 'Ibagué',
  'Valle del Cauca': 'Cali',
  Vaupés: 'Mitú',
  Vichada: 'Puerto Carreño',
  'Bogotá D.C.': 'Bogotá D.C.',
};

export function citiesForDepartment(department) {
  const city = COLOMBIA_CAPITALS[department];
  return city ? [city] : [];
}

export function normalizeClientLocation(city, department) {
  const normalizedCity = String(city ?? '').trim();
  const normalizedDepartment = String(department ?? '').trim();
  if (normalizedCity.length < 2 || normalizedCity.length > 80) return null;
  if (!citiesForDepartment(normalizedDepartment).includes(normalizedCity)) return null;
  return { city: normalizedCity, department: normalizedDepartment };
}
