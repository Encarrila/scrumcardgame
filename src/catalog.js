// Game catalog - HR themed cards and stories.

export const HISTORIAS = [
    { id: 1, description: "Como empleado, quiero actualizar mis datos personales en el sistema de manera autonoma", hours: 18 },
    { id: 2, description: "Como reclutador, quiero publicar vacantes en multiples portales automaticamente", hours: 24 },
    { id: 3, description: "Como gerente, quiero evaluar el desempeno de mi equipo digitalmente", hours: 32 },
    { id: 4, description: "Como empleado, quiero solicitar vacaciones a traves del sistema", hours: 15 },
    { id: 5, description: "Como RRHH, quiero generar reportes de rotacion de personal", hours: 28 },
    { id: 6, description: "Como candidato, quiero aplicar a posiciones y hacer seguimiento del proceso", hours: 21 },
    { id: 7, description: "Como RRHH, quiero gestionar el proceso de onboarding digital", hours: 36 },
    { id: 8, description: "Como empleado, quiero inscribirme a capacitaciones disponibles", hours: 19 },
    { id: 9, description: "Como RRHH, quiero implementar encuestas de clima organizacional", hours: 42 },
    { id: 10, description: "Como gerente, quiero aprobar solicitudes de mi equipo", hours: 26 },
    { id: 11, description: "Como RRHH, quiero integrar el sistema con nomina", hours: 31 },
    { id: 12, description: "Como empleado, quiero ver mi trayectoria de desarrollo profesional", hours: 23 },
    { id: 13, description: "Como RRHH, quiero automatizar el calculo de beneficios", hours: 38 },
    { id: 14, description: "Como empleado, quiero reportar reconocimientos a colegas", hours: 17 },
    { id: 15, description: "Como RRHH, quiero gestionar planes de sucesion", hours: 29 },
    { id: 16, description: "Como RRHH, quiero implementar evaluaciones 360 grados", hours: 34 }
];

export const EVENTOS = [
    { id: 1, name: "Apoyo de la Direccion", effect: "Adiciona 4 puntos a la proxima tirada del equipo", type: "positive", action: "ADD_NEXT_TEAM_ROLL", value: 4 },
    { id: 2, name: "Auditoria Laboral", effect: "Salta tu siguiente turno", type: "negative", action: "SKIP_TURN", value: 1 },
    { id: 3, name: "Cambio en Normativa", effect: "Esta historia tomara 6 horas mas", type: "negative", action: "ADD_HOURS", value: 6 },
    { id: 4, name: "Consultor Externo Disponible", effect: "Una historia en progreso se termina instantaneamente", type: "positive", action: "COMPLETE_STORY", value: 1 },
    { id: 5, name: "Reunion Sindical Urgente", effect: "Todo el equipo salta el siguiente turno", type: "negative", action: "SKIP_TEAM_TURN", value: 1 },
    { id: 6, name: "Caida del Sistema HRIS", effect: "Remueve todo progreso de una historia en progreso", type: "negative", action: "RESET_STORY", value: 1 },
    { id: 7, name: "Celebracion de Aniversario", effect: "Resta 2 puntos del resultado de todo mundo", type: "negative", action: "REDUCE_NEXT_TEAM_ROLL", value: 2 },
    { id: 8, name: "Presupuesto Extra Aprobado", effect: "Toma otra carta y sigue sus instrucciones", type: "positive", action: "DRAW_AGAIN", value: 1 }
];

export const PROBLEMAS = [
    { id: 1, name: "Normativa Laboral Ambigua", effect: "La especificacion legal no esta suficientemente clara", solutionId: 1 },
    { id: 2, name: "Resistencia al Cambio", effect: "Los usuarios se niegan a adoptar la nueva funcionalidad", solutionId: 2 },
    { id: 3, name: "Conflicto de Privacidad", effect: "Problema detectado con datos personales sensibles", solutionId: 6 },
    { id: 4, name: "Revision Legal Pendiente", effect: "El area legal debe aprobar antes de continuar", solutionId: 3 },
    { id: 5, name: "Informacion Sindical Faltante", effect: "No puedes proceder sin consulta sindical", solutionId: 4 },
    { id: 6, name: "Incompatibilidad de Sistemas", effect: "El sistema legacy bloquea la integracion", solutionId: 5 },
    { id: 7, name: "Falta de Presupuesto", effect: "No hay fondos disponibles para completar esta funcionalidad", solutionId: 7 },
    { id: 8, name: "Conflicto entre Areas", effect: "Diferentes departamentos no logran ponerse de acuerdo", solutionId: 8 }
];

export const SOLUCIONES = [
    { id: 1, name: "Asesoria en Compliance", effect: "Resuelve problemas de normativa laboral ambigua", resolvesId: 1 },
    { id: 2, name: "Workshop de Gestion del Cambio", effect: "Resuelve la resistencia de usuarios", resolvesId: 2 },
    { id: 3, name: "Consultoria Legal Express", effect: "Resuelve bloqueos por revision legal pendiente", resolvesId: 4 },
    { id: 4, name: "Mesa de Dialogo Sindical", effect: "Resuelve falta de informacion sindical", resolvesId: 5 },
    { id: 5, name: "Especialista en Integracion", effect: "Resuelve incompatibilidades de sistemas", resolvesId: 6 },
    { id: 6, name: "Oficina de Proteccion de Datos", effect: "Resuelve conflictos de privacidad", resolvesId: 3 },
    { id: 7, name: "Aprobacion de Presupuesto Extraordinario", effect: "Resuelve falta de presupuesto", resolvesId: 7 },
    { id: 8, name: "Facilitador de Consenso", effect: "Resuelve conflictos entre areas", resolvesId: 8 }
];

export function createCatalog() {
    return {
        stories: HISTORIAS,
        events: EVENTOS,
        problems: PROBLEMAS,
        solutions: SOLUCIONES
    };
}

export function shuffleArray(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

export function createOpportunityDeck(catalog = createCatalog()) {
    return shuffleArray([
        ...catalog.events.map((card) => ({ ...card, cardType: "evento" })),
        ...catalog.problems.map((card) => ({ ...card, cardType: "problema" })),
        ...catalog.solutions.map((card) => ({ ...card, cardType: "solucion" }))
    ]);
}
