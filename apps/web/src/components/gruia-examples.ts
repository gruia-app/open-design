export type GruiaExampleCategory = 'B2B' | 'Landings' | 'Juegos';

export interface GruiaExample {
  id: string;
  category: GruiaExampleCategory;
  title: string;
  description: string;
  output: string;
  prompt: string;
  tags: string[];
  previewUrl?: string;
  sourceLabel: string;
  sourceUrl: string;
  attribution: string;
}

/**
 * These are original Spanish prompts, informed by the linked upstream
 * repository examples with their individual license metadata. They are intentionally not presented as community
 * submissions or as copies of the referenced files.
 */
export const GRUIA_EXAMPLES: GruiaExample[] = [
  {
    id: 'b2b-saas-command-center', category: 'B2B', title: 'Centro de mando SaaS',
    description: 'Dashboard de customer success para detectar riesgo de adopción antes de la renovación.',
    output: 'Vista responsive con KPIs, cola de cuentas en riesgo, filtros por segmento y panel de detalle.',
    prompt: 'Crea un prototipo web en español para un centro de mando SaaS B2B. Incluye navegación lateral colapsable, KPIs de adopción y renovación, gráfico de tendencia de los últimos 30 días, tabla de cuentas con estado de riesgo y un panel de detalle que se abre al seleccionar una cuenta. Añade filtros por segmento y propietario, estados vacíos y de carga, y acciones para asignar seguimiento. Usa datos realistas pero ficticios, layout responsive para móvil y escritorio, foco visible, navegación por teclado, etiquetas accesibles y contraste AA. No uses login ni backend.',
    tags: ['dashboard', 'customer success', 'responsive', 'accesibilidad'],
    sourceLabel: 'Referencia local licenciada: Prototype Dashboard (MIT)', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/spec/examples/create-prototype-dashboard',
    attribution: 'Referencia de OpenDesign Spec Examples; prompt original de Gruia.',
  },
  {
    id: 'b2b-onboarding-journey', previewUrl: '/gruia/examples/opendesign-onboarding.html', category: 'B2B', title: 'Onboarding por hitos',
    description: 'Flujo de activación para equipos nuevos, con progreso, checklist y ayuda contextual.',
    output: 'Onboarding guiado de cinco pasos con progreso persistente, selector de rol y resumen de activación.',
    prompt: 'Diseña un prototipo de onboarding B2B en español para una plataforma de operaciones. Construye cinco pasos: objetivo del equipo, importación de datos simulada, invitación de colegas, primera automatización y revisión final. Muestra progreso, permite volver sin perder datos, valida campos inline y ofrece “Saltar por ahora” con confirmación accesible. Incluye un resumen de activación al terminar y una vista móvil usable con una sola mano. Añade estados de error, éxito, carga y teclado; respeta prefers-reduced-motion y no dependas de autenticación.',
    tags: ['onboarding', 'activación', 'wizard', 'móvil'],
    sourceLabel: 'Referencia local incluida: Mobile Onboarding', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/mobile-onboarding',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'b2b-roi-calculator', previewUrl: '/gruia/examples/roi-calculator.html', category: 'B2B', title: 'Calculadora de ROI',
    description: 'Herramienta de preventa para convertir volumen operativo en un caso económico claro.',
    output: 'Calculadora interactiva con inputs, escenarios, desglose mensual y CTA de demo.',
    prompt: 'Crea una calculadora de ROI B2B en español para una herramienta de automatización. Pide número de personas, horas semanales repetitivas, coste horario y meses de uso; actualiza en vivo ahorro mensual, ahorro anual y periodo de recuperación. Permite comparar escenario conservador y ambicioso, explica cada fórmula con texto breve y ofrece reiniciar. Diseña un CTA final “Solicitar demo” que abra un formulario inline con nombre, email y empresa, validación clara y mensaje de éxito sin enviar datos reales. Responsive, semántica HTML, labels asociados, teclado y contraste AA.',
    tags: ['ROI', 'calculadora', 'preventa', 'formularios'],
    sourceLabel: 'Referencia local incluida: Live Artifact examples', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/live-artifact',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'landing-b2b-demo', previewUrl: '/gruia/examples/fable-b2b-landing.html', category: 'Landings', title: 'Landing de demo B2B',
    description: 'Página de conversión para una plataforma de datos, pensada para captar leads cualificados.',
    output: 'Hero con propuesta de valor, prueba social, bloques de beneficios, formulario y FAQ accesible.',
    prompt: 'Crea una landing B2B en español para una plataforma de datos de producto. El hero debe responder qué hace, para quién y qué resultado consigue, con CTA “Ver una demo” y CTA secundario “Explorar el producto”. Añade logos de prueba social como texto, tres beneficios con evidencia, una sección de flujo en tres pasos, un formulario de leadgen en dos columnas que pasa a una columna en móvil, FAQ desplegable accesible y footer completo. Incluye validación inline, mensaje de éxito, estados de foco y navegación por teclado; evita imágenes externas y usa placeholders locales.',
    tags: ['landing', 'leadgen', 'demo', 'prueba social'],
    sourceLabel: 'Referencia local incluida: OpenDesign Landing', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/open-design-landing',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'landing-service-offer', previewUrl: '/gruia/examples/opendesign-saas.html', category: 'Landings', title: 'Oferta de servicio',
    description: 'Landing editorial para vender una auditoría de diseño con alcance, proceso y precio entendibles.',
    output: 'Página de oferta con selector de paquete, alcance comparado, calendario simulado y preguntas frecuentes.',
    prompt: 'Diseña una landing de servicio en español para una auditoría de UX B2B. Presenta una promesa concreta, resultados entregables, proceso de una semana y tres paquetes comparables con selector de paquete que actualice el resumen. Incluye una sección “Qué recibes”, testimonios ficticios claramente marcados como ejemplo, calendario simulado para elegir una fecha y formulario de contacto. Añade anclajes de navegación, responsive real, estados de error y éxito, foco visible, labels y texto alternativo; no uses checkout ni datos reales.',
    tags: ['servicio', 'oferta', 'pricing', 'conversión'],
    sourceLabel: 'Referencia local incluida: SaaS Landing', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/saas-landing',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'landing-event-signup', category: 'Landings', title: 'Registro a evento',
    description: 'Landing de evento con agenda, ponentes, plazas restantes y registro sin fricción.',
    output: 'Página de evento con agenda filtrable, modal de ponente y formulario de inscripción inline.',
    prompt: 'Crea una landing de evento B2B en español para un workshop de operaciones. Incluye hero con fecha, ciudad y plazas disponibles; agenda filtrable por día; tarjetas de ponentes con panel accesible de biografía; beneficios de asistir; preguntas frecuentes y formulario de inscripción inline con nombre, email, rol y preferencias. El contador de plazas debe ser ficticio y explicitarlo. Gestiona estados de validación, éxito y lista de espera. Optimiza para móvil, teclado, lectores de pantalla, contraste AA y prefers-reduced-motion. Sin imágenes remotas ni login.',
    tags: ['evento', 'registro', 'agenda', 'leadgen'],
    sourceLabel: 'Referencia local incluida: Design Brief examples', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/design-brief',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'game-qualification-quiz', previewUrl: '/gruia/examples/lead-quiz-game.html', category: 'Juegos', title: 'Quiz de cualificación',
    description: 'Juego breve para descubrir el nivel de madurez de un equipo y recomendar el siguiente paso.',
    output: 'Quiz de cinco preguntas con progreso, puntuación explicada y recomendación accionable.',
    prompt: 'Construye un quiz interactivo en español para cualificar equipos interesados en una plataforma B2B. Presenta cinco preguntas de opción única sobre tamaño, proceso y urgencia, con progreso visible, navegación atrás/adelante y posibilidad de reiniciar. Calcula una puntuación explicable, muestra una recomendación de nivel con próximos pasos y CTA para pedir una demo. Incluye feedback no basado solo en color, foco visible, teclado, aria-live para cambios y layout móvil. Todos los resultados deben ser ficticios y funcionar sin backend.',
    tags: ['quiz', 'cualificación', 'interactivo', 'B2B'],
    sourceLabel: 'Referencia local incluida: Gamified App', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/gamified-app',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'game-product-mini-game', previewUrl: '/gruia/examples/opendesign-gamified.html', category: 'Juegos', title: 'Mini-juego de producto',
    description: 'Demo jugable que enseña el valor de una herramienta sin convertir la página en un tutorial largo.',
    output: 'Mini-juego de arrastrar y ordenar tareas con feedback, puntuación y CTA de prueba.',
    prompt: 'Crea un mini-juego de producto en español para enseñar una herramienta de planificación. El jugador debe arrastrar tareas a tres columnas, recibir feedback inmediato cuando completa una secuencia y ver una puntuación de claridad al final. Ofrece botones equivalentes a drag and drop para teclado y móvil, deshacer, reiniciar y un modo de demostración. Explica la regla antes de empezar, usa aria-live para feedback, no dependas de precisión temporal, respeta prefers-reduced-motion y termina con CTA “Probar el producto”. Sin login, sin assets externos.',
    tags: ['mini-juego', 'producto', 'drag and drop', 'demo'],
    sourceLabel: 'Referencia local incluida: Gamified App', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/gamified-app',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
  {
    id: 'game-interactive-training', category: 'Juegos', title: 'Entrenamiento interactivo',
    description: 'Simulación de decisiones para practicar un proceso operativo con consecuencias visibles.',
    output: 'Escenario ramificado con tarjetas de decisión, feedback contextual y resumen de aprendizaje.',
    prompt: 'Diseña una experiencia de entrenamiento interactivo en español para enseñar a un equipo a responder a una incidencia de cliente. Presenta un escenario inicial y tres decisiones secuenciales; cada elección debe mostrar una consecuencia breve, permitir volver a revisar y terminar con un resumen de aciertos y áreas a practicar. Incluye barra de progreso, botón de pausa, modo de alto contraste, teclado completo y feedback anunciado por aria-live. Usa ilustraciones abstractas CSS o texto, no assets remotos, y haz que la experiencia sea usable en móvil y escritorio sin login.',
    tags: ['formación', 'simulación', 'ramificado', 'accesibilidad'],
    sourceLabel: 'Referencia local incluida: Hatch Pet example', sourceUrl: 'https://github.com/nexu-io/open-design/tree/main/plugins/_official/examples/hatch-pet',
    attribution: 'Referencia de OpenDesign Official Examples; prompt original de Gruia.',
  },
];

export const GRUIA_EXAMPLE_CATEGORIES: Array<'Todos' | GruiaExampleCategory> = ['Todos', 'B2B', 'Landings', 'Juegos'];
