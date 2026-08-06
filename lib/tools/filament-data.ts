export type FilamentAcabado = "mate" | "glossy" | "silk" | "translucido";

export type FilamentProfile = {
  material: string;
  acabados: FilamentAcabado[];
  usoIdeal: string[];
  resistenciaMecanica: "baja" | "media" | "alta";
  exteriorUV: boolean;
  flexible: boolean;
  nozzle: string;
  cama: string;
  ventilacion: string;
  notas: string;
};

export const FILAMENT_PROFILES: FilamentProfile[] = [
  {
    material: "PLA",
    acabados: ["mate", "glossy", "silk"],
    usoIdeal: ["decoracion", "decorativa", "figura", "florero", "bandeja", "prototipo", "bajo esfuerzo"],
    resistenciaMecanica: "baja",
    exteriorUV: false,
    flexible: false,
    nozzle: "210-220°C (mate) / 190-210°C (silk, según marca)",
    cama: "55-60°C",
    ventilacion: "100% desde capa 2",
    notas:
      "Mejor opción para piezas de exhibición interior. El mate disimula mejor las líneas de capa en fotos de listing; el silk da brillo pero las resalta más.",
  },
  {
    material: "PETG",
    acabados: ["glossy", "translucido"],
    usoIdeal: ["funcional", "exterior protegido", "contacto con agua", "maceta", "organizador"],
    resistenciaMecanica: "media",
    exteriorUV: false,
    flexible: false,
    nozzle: "240-250°C",
    cama: "70-80°C",
    ventilacion: "30-50%",
    notas:
      "Más resistente al impacto que PLA. Requiere secado (6 h a 65°C) si estuvo expuesto. Menos nítido en detalle fino que el PLA.",
  },
  {
    material: "ASA",
    acabados: ["mate"],
    usoIdeal: ["exterior", "resistente uv", "funcional exterior", "jardin"],
    resistenciaMecanica: "alta",
    exteriorUV: true,
    flexible: false,
    nozzle: "250-270°C",
    cama: "90-100°C",
    ventilacion: "0% (cerrada durante la impresión)",
    notas:
      "La única opción de esta lista pensada para sol/intemperie prolongada. Enclosure recomendado; más difícil de calibrar que PLA/PETG.",
  },
  {
    material: "TPU (95A)",
    acabados: ["mate"],
    usoIdeal: ["flexible", "junta", "funda", "elastico"],
    resistenciaMecanica: "media",
    exteriorUV: false,
    flexible: true,
    nozzle: "220-230°C",
    cama: "40-50°C",
    ventilacion: "empezar en 50%, subir si hay stringing",
    notas:
      "Imprimir desde spool externo, no compatible con AMS estándar. Reducir velocidad a 30-60 mm/s.",
  },
];

export type FilamentRequest = {
  tipoPieza: string;
  usoPrincipal?: string;
  acabadoDeseado?: FilamentAcabado;
  exterior?: boolean;
  esfuerzoMecanico?: "bajo" | "medio" | "alto";
  flexible?: boolean;
};

export type FilamentScore = {
  profile: FilamentProfile;
  score: number;
  reasons: string[];
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function recommendFilament(req: FilamentRequest): FilamentScore[] {
  const usoTexto = normalize(`${req.tipoPieza} ${req.usoPrincipal ?? ""}`);

  const scored = FILAMENT_PROFILES.map((profile) => {
    let score = 0;
    const reasons: string[] = [];

    if (req.flexible) {
      if (profile.flexible) {
        score += 5;
        reasons.push("Es flexible, como se pidió.");
      } else {
        score -= 5;
      }
    }

    if (req.exterior) {
      if (profile.exteriorUV) {
        score += 4;
        reasons.push("Resiste sol/intemperie a diferencia de otras opciones.");
      } else {
        score -= 2;
      }
    }

    if (req.esfuerzoMecanico) {
      const nivel = { baja: 0, media: 1, alta: 2 }[profile.resistenciaMecanica];
      const pedido = { bajo: 0, medio: 1, alto: 2 }[req.esfuerzoMecanico];
      if (nivel >= pedido) {
        score += 2 + (nivel - pedido === 0 ? 1 : 0);
      } else {
        score -= 2 * (pedido - nivel);
      }
    }

    if (req.acabadoDeseado) {
      if (profile.acabados.includes(req.acabadoDeseado)) {
        score += 2;
        reasons.push(`Disponible en acabado ${req.acabadoDeseado}.`);
      } else {
        score -= 1;
      }
    }

    if (profile.usoIdeal.some((u) => usoTexto.includes(normalize(u)))) {
      score += 2;
      reasons.push("Coincide con el tipo de pieza/uso descrito.");
    }

    return { profile, score, reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}
