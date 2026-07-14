// Validaciones de formato de los campos de captura (regex).
// Se aplican como atributo `pattern` de los inputs: el navegador valida al
// enviar el formulario y muestra `title` como mensaje. Los campos numéricos
// (type="number") no aceptan pattern; ahí mandan min/max/step.
//
// Nota: el atributo pattern se compila con la bandera 'v', que exige escapar
// / y - dentro de las clases de caracteres.

const REGLAS = {
  // OF de producción: numérica, como 26002000024 (se admite de 4 a 12 dígitos
  // para OFs cortas históricas).
  of: {
    pattern: '\\d{4,12}',
    title: 'OF numérica de 4 a 12 dígitos (ej. 26002000024)',
  },
  // Referencia de pieza: alfanumérica con espacios, puntos, guiones o diagonal
  // (VW "5NA 853 601", Ford "SL1B-...", Stellantis "68xxx…").
  referencia: {
    pattern: '[A-Za-z0-9][A-Za-z0-9 .\\-\\/]{1,29}',
    title: 'De 2 a 30 caracteres: letras, números, espacios, puntos o guiones (ej. 5NA 853 601)',
  },
  // Denominación de pieza: texto corto, al menos 2 caracteres visibles.
  denominacion: {
    pattern: '\\S[\\s\\S]{1,79}',
    title: 'De 2 a 80 caracteres',
  },
  // Barra del baño de cromado: código corto alfanumérico.
  barra: {
    pattern: '[A-Za-z0-9\\-]{1,20}',
    title: 'Código alfanumérico de hasta 20 caracteres, sin espacios',
  },
  // Posición de rack: letras + número, como FA3 o B12.
  posicionRack: {
    pattern: '[A-Za-z]{1,3}\\d{1,3}',
    title: 'Letras seguidas de número (ej. FA3)',
  },
  // Norma del cliente: "TL 528 D-21", "WSS-M1P83-E2", "GMW 14668", "PS.50014".
  norma: {
    pattern: '[A-Za-z0-9][A-Za-z0-9 .\\-\\/]{1,39}',
    title: 'De 2 a 40 caracteres: letras, números, espacios, puntos o guiones (ej. TL 528 D-21)',
  },
  // Apartado de la norma: numeración con puntos, como 3.5.1 (letra final opcional).
  apartado: {
    pattern: '\\d+(\\.\\d+)*[A-Za-z]?',
    title: 'Numeración con puntos (ej. 3.5.1)',
  },
  // Usuario del sistema: minúsculas, números y . _ - (3 a 30).
  usuario: {
    pattern: '[a-z0-9._\\-]{3,30}',
    title: 'De 3 a 30 caracteres: minúsculas, números, punto, guion o guion bajo',
  },
  // Nombre de persona: letras (con acentos), espacios y apóstrofos.
  nombrePersona: {
    pattern: "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'\\-]{2,59}",
    title: 'De 3 a 60 caracteres: solo letras, espacios y guiones',
  },
  // Contraseña: mínimo 6 caracteres, sin espacios.
  password: {
    pattern: '\\S{6,}',
    title: 'Mínimo 6 caracteres, sin espacios',
  },
  // ID interno de equipo de laboratorio: LM-INS-001.
  equipoId: {
    pattern: '[A-Za-z0-9][A-Za-z0-9.\\-\\/]{1,29}',
    title: 'Código alfanumérico con guiones, sin espacios (ej. LM-INS-001)',
  },
  // Nombre de catálogo (cliente, área, equipo…): texto corto.
  nombreCatalogo: {
    pattern: '\\S[\\s\\S]{1,59}',
    title: 'De 2 a 60 caracteres',
  },
  // Proyecto: código o nombre corto.
  proyecto: {
    pattern: '\\S[\\s\\S]{1,59}',
    title: 'De 2 a 60 caracteres',
  },
  // N° de etiqueta de materia prima: código alfanumérico.
  numeroEtiqueta: {
    pattern: '[A-Za-z0-9\\-\\/]{1,30}',
    title: 'Código alfanumérico de hasta 30 caracteres, sin espacios',
  },
  // Color del material (materia prima).
  colorMaterial: {
    pattern: '[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .\\-\\/]{1,39}',
    title: 'De 2 a 40 caracteres',
  },
  // Proveedor de materia prima.
  proveedor: {
    pattern: '\\S[\\s\\S]{1,59}',
    title: 'De 2 a 60 caracteres',
  },
};

// Props listas para esparcir en un <input>: {...val('of')}
export function val(tipo) {
  const r = REGLAS[tipo];
  return { pattern: r.pattern, title: r.title };
}

// Para validar en JS (prompt de reset de contraseña, checks manuales).
export function cumple(tipo, valor) {
  const r = REGLAS[tipo];
  return new RegExp(`^(?:${r.pattern})$`, 'v').test(valor);
}
