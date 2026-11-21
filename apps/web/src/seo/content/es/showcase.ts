import type { SeoShowcase } from '../../types';

export const showcase: SeoShowcase = {
  locale: 'es',
  title: 'Ejemplos de OpenDesign: recursos de diseño abiertos',
  description:
    'Explora sistemas de diseño, plantillas, skills, plugins y reglas de oficio reales del repositorio de código abierto OpenDesign. Libres para leer y reutilizar.',
  ogTitle: 'Ejemplos de OpenDesign: recursos de diseño abiertos',
  ogDescription:
    'Sistemas de diseño, plantillas, skills, plugins y reglas de oficio del repositorio abierto de OpenDesign. Cada entrada enlaza a su carpeta en GitHub.',
  keywords: [
    'sistemas de diseño de código abierto',
    'ejemplos de DESIGN.md',
    'plantillas de diseño gratis',
    'herramienta de diseño open source',
    'plantillas de sistema de diseño',
    'skills de diseño con IA',
    'plantillas de prototipado open source',
    'recursos de diseño colaborativo',
  ],
  eyebrow: 'Ejemplos',
  h1: 'Lo que incluye el repositorio de OpenDesign',
  lede:
    'Un recorrido por los sistemas de diseño, plantillas, skills, plugins y reglas de oficio que puedes leer, reutilizar y cambiar hoy.',
  intro: [
    'Casi todo OpenDesign vive en archivos, no en código de framework. Un sistema de diseño es una carpeta con un DESIGN.md. Una plantilla es una carpeta con un SKILL.md y un ejemplo. Esta página elige algunas entradas de cada grupo y enlaza a las carpetas reales en GitHub. El repositorio contiene muchas más de las que listamos aquí.',
    'Algunos sistemas de diseño se inspiran en productos conocidos. Describen el lenguaje visual de un sitio público: color, tipografía, espaciado y tono. Sirven como referencia de estudio y como punto de partida. No son kits de marca oficiales, y las marcas no los respaldan. Si publicas un producto, adapta los tokens a tu propia identidad.',
    'Todo lo que sigue es texto plano y HTML estático. Puedes abrirlo en un editor, revisarlo en una pull request y compartirlo con tu equipo. Nada de esto es la maqueta de una función que no existe. Si una entrada aparece en esta página, su carpeta está en el repositorio.',
  ],
  groups: [
    {
      id: 'design-systems',
      heading: 'Sistemas de diseño',
      intro:
        'Cada sistema de diseño es una carpeta con un DESIGN.md, un manifiesto y tokens CSS. Los agentes y las personas leen los mismos archivos. Las entradas de abajo se inspiran en productos públicos y en familias de estilo. Úsalas como referencia, no como kits de marca oficiales.',
      items: [
        {
          name: 'Linear (inspirado)',
          description:
            'Diseño de producto que parte del modo oscuro, con un lienzo casi negro, bordes finísimos y un solo acento morado contenido. La densidad de información sale de pequeños saltos de luminosidad.',
          path: 'design-systems/linear-app',
          tags: ['modo oscuro', 'SaaS', 'minimalista'],
        },
        {
          name: 'Stripe (inspirado)',
          description:
            'Un lienzo blanco limpio con títulos en azul marino profundo y un acento violeta saturado. Los pesos tipográficos ligeros le dan un aire técnico, tranquilo y algo cálido.',
          path: 'design-systems/stripe',
          tags: ['fintech', 'claro', 'degradados'],
        },
        {
          name: 'Vercel (inspirado)',
          description:
            'Páginas casi blancas con texto casi negro y la familia tipográfica Geist. La contención es la idea: primero la estructura, y casi nunca la decoración.',
          path: 'design-systems/vercel',
          tags: ['herramientas para desarrolladores', 'monocromo', 'minimalista'],
        },
        {
          name: 'Notion (inspirado)',
          description:
            'Neutros cálidos en lugar de grises fríos, títulos con serifa y superficies suaves. Se lee como buen papel, no como una pantalla de cristal.',
          path: 'design-systems/notion',
          tags: ['espacio de trabajo', 'cálido', 'serifa'],
        },
        {
          name: 'GitHub (inspirado)',
          description:
            'Paneles rectangulares densos con bordes finos, en modo claro y oscuro. Pensado para quien escanea listas, diffs y pull requests todo el día.',
          path: 'design-systems/github',
          tags: ['herramientas para desarrolladores', 'denso', 'claro y oscuro'],
        },
        {
          name: 'Figma (inspirado)',
          description:
            'Un aspecto de marketing basado en una fuente variable con pasos de peso muy finos. La jerarquía nace de pequeñas diferencias de peso, y el color vivo se usa para jugar.',
          path: 'design-systems/figma',
          tags: ['herramientas de diseño', 'fuente variable', 'colorido'],
        },
        {
          name: 'Supabase (inspirado)',
          description:
            'Atmósfera oscura de editor de código, con superficies negras y un acento verde esmeralda. La tipografía es una sans geométrica de terminaciones redondeadas.',
          path: 'design-systems/supabase',
          tags: ['modo oscuro', 'herramientas para desarrolladores', 'verde'],
        },
        {
          name: 'Raycast (inspirado)',
          description:
            'Un lienzo casi negro con matiz azulado y sombras en capas, tomadas del marco de las ventanas de escritorio. Da la sensación de una utilidad nativa y rápida.',
          path: 'design-systems/raycast',
          tags: ['modo oscuro', 'aire de escritorio', 'degradados'],
        },
        {
          name: 'Mintlify (inspirado)',
          description:
            'Un aspecto de documentación blanco y aireado, con texto casi negro y un único acento verde. Todo sirve a la legibilidad y a las lecturas largas.',
          path: 'design-systems/mintlify',
          tags: ['documentación', 'claro', 'legible'],
        },
        {
          name: 'PostHog (inspirado)',
          description:
            'Un fondo crema con matiz salvia, verdes terrosos y un tono irreverente y artesanal. Evita los azules y morados habituales de las herramientas de analítica.',
          path: 'design-systems/posthog',
          tags: ['analítica', 'divertido', 'cálido'],
        },
        {
          name: 'Sentry (inspirado)',
          description:
            'Paneles de un morado casi negro con acentos rosas y morados, y un toque lima. Densos, cargados de datos y hechos para depurar de noche.',
          path: 'design-systems/sentry',
          tags: ['panel', 'modo oscuro', 'datos densos'],
        },
        {
          name: 'Cursor (inspirado)',
          description:
            'Un lienzo blanco roto cálido con texto marrón casi negro, superficies crema y bordes que se funden en capas transparentes. Minimalista, con aire artesanal.',
          path: 'design-systems/cursor',
          tags: ['cálido', 'editor', 'minimalista'],
        },
        {
          name: 'Neobrutalism',
          description:
            'Una familia de estilo, no una marca. Bordes gruesos, acentos vivos en amarillo y azul y composiciones de alto contraste sobre superficies cálidas.',
          path: 'design-systems/neobrutalism',
          tags: ['atrevido', 'alto contraste', 'familia de estilo'],
        },
        {
          name: 'Editorial',
          description:
            'Una familia de estilo basada en maquetas de revista: tipografía con serifa refinada, rejillas claras y un ritmo de lectura sereno. Negro y blanco roto en el núcleo.',
          path: 'design-systems/editorial',
          tags: ['serifa', 'rejilla', 'familia de estilo'],
        },
      ],
    },
    {
      id: 'design-templates',
      heading: 'Plantillas de diseño',
      intro:
        'Una plantilla de diseño es una forma empaquetada para un tipo de pieza. Cada carpeta tiene un SKILL.md y un ejemplo hecho a mano. El agente aplica a la plantilla el sistema de diseño activo.',
      items: [
        {
          name: 'Landing page SaaS',
          description:
            'Una landing de una página con hero, funciones, prueba social, precios y una llamada a la acción final. Sigue los tokens del sistema de diseño activo.',
          path: 'design-templates/saas-landing',
          tags: ['web', 'marketing', 'landing'],
        },
        {
          name: 'Página de precios',
          description:
            'Cabecera, planes, una tabla comparativa de funciones y unas preguntas frecuentes en una sola página. Úsala cuando el brief pida planes, niveles o comparar planes.',
          path: 'design-templates/pricing-page',
          tags: ['web', 'precios', 'tablas'],
        },
        {
          name: 'Página de documentación',
          description:
            'Navegación a un lado, un artículo con scroll en el centro y un índice al otro lado. Útil para guías y referencias de API.',
          path: 'design-templates/docs-page',
          tags: ['web', 'documentación', 'lectura'],
        },
        {
          name: 'Panel de control',
          description:
            'Una pantalla de administración o analítica en un solo archivo HTML: barra lateral fija, barra superior, tarjetas de KPI y uno o dos gráficos.',
          path: 'design-templates/dashboard',
          tags: ['interfaz de producto', 'analítica', 'gráficos'],
        },
        {
          name: 'Tablero kanban',
          description:
            'Un tablero de tareas con columnas Por hacer, En curso, En revisión y Hecho, avatares de responsables, carriles y una barra de filtros.',
          path: 'design-templates/kanban-board',
          tags: ['interfaz de producto', 'tareas', 'tableros'],
        },
        {
          name: 'Onboarding móvil',
          description:
            'Tres marcos de teléfono en fila: pantalla de inicio, propuesta de valor e inicio de sesión. Incluye barra de estado, puntos de desplazamiento y un botón principal.',
          path: 'design-templates/mobile-onboarding',
          tags: ['móvil', 'flujos', 'onboarding'],
        },
        {
          name: 'Wireframe a mano alzada',
          description:
            'Un wireframe con trazo de rotulador y lápiz sobre papel cuadriculado, con pestañas para variantes y notas adhesivas. Parece una pizarra antes de que exista ningún píxel.',
          path: 'design-templates/wireframe-sketch',
          tags: ['wireframe', 'exploración', 'boceto'],
        },
        {
          name: 'Artículo de blog',
          description:
            'Un artículo largo con cabecera, bloque de imagen principal, figuras, citas destacadas, firma del autor y artículos relacionados.',
          path: 'design-templates/blog-post',
          tags: ['contenido', 'editorial', 'web'],
        },
        {
          name: 'Email de marketing',
          description:
            'Un email de lanzamiento de producto en una columna centrada, con alternativa en tablas. Tiene cabecera con logotipo, bloque de imagen, titular, botón y rejilla de especificaciones.',
          path: 'design-templates/email-marketing',
          tags: ['email', 'marketing', 'HTML'],
        },
        {
          name: 'Prototipo web general',
          description:
            'La opción por defecto para páginas de escritorio cuando ninguna plantilla más específica encaja. Parte de un HTML semilla y de una biblioteca de secciones.',
          path: 'design-templates/web-prototype',
          tags: ['prototipo', 'web', 'por defecto'],
        },
        {
          name: 'Presentación para inversores',
          description:
            'Una plantilla de presentación de captación con una historia de ejemplo sobre gancho, tracción, ventaja y petición. Úsala como estructura inicial para tus diapositivas.',
          path: 'design-templates/html-ppt-pitch-deck',
          tags: ['presentación', 'diapositivas', 'pitch'],
        },
      ],
    },
    {
      id: 'skills',
      heading: 'Skills',
      intro:
        'Las skills son capacidades funcionales que los agentes invocan a mitad de una tarea. Trabajan sobre tu entrada: redactan un brief, auditan una pantalla, extraen una marca. Cada skill es una carpeta con un SKILL.md.',
      items: [
        {
          name: 'Gestor de DESIGN.md',
          description:
            'Crea y gestiona archivos DESIGN.md, para que la dirección de diseño, los tokens y las reglas visuales vivan en una sola fuente de verdad.',
          path: 'skills/design-md',
          tags: ['DESIGN.md', 'tokens', 'documentación'],
        },
        {
          name: 'Analizador de briefs de diseño',
          description:
            'Convierte un brief estructurado en una especificación concreta. Pide paleta, tipografía, maqueta, tono, densidad y restricciones explícitas en lugar de "hazlo profesional".',
          path: 'skills/design-brief',
          tags: ['brief', 'especificación', 'planificación'],
        },
        {
          name: 'Revisión de diseño',
          description:
            'Una auditoría visual que corrige lo que encuentra, con commits atómicos y capturas de antes y después. Sirve para afinar una pantalla antes del lanzamiento.',
          path: 'skills/design-review',
          tags: ['revisión', 'QA', 'capturas'],
        },
        {
          name: 'Revisión del plan de diseño',
          description:
            'Puntúa cada dimensión del diseño de 0 a 10, explica cómo sería un 10 y señala indicios de resultado genérico de IA. Funciona bien como control antes de fusionar cambios de interfaz.',
          path: 'skills/plan-design-review',
          tags: ['revisión', 'puntuación', 'calidad'],
        },
        {
          name: 'Consultoría de diseño',
          description:
            'Construye un sistema de diseño desde cero, con riesgos creativos y maquetas realistas del producto. Encaja en talleres de arranque y en proyectos de marca desde cero.',
          path: 'skills/design-consultation',
          tags: ['sistema de diseño', 'taller', 'marca'],
        },
        {
          name: 'Extracción de marca',
          description:
            'Obtiene un kit de marca de un sitio web real mediante el navegador de la aplicación: colores, fuentes y logotipo.',
          path: 'skills/brand-extract',
          tags: ['marca', 'navegador', 'tokens'],
        },
        {
          name: 'Contrato de diseño de referencia',
          description:
            'Convierte capturas, URL y notas del tipo "que se sienta así" en un DESIGN.md sólido y en un traspaso para la implementación.',
          path: 'skills/reference-design-contract',
          tags: ['referencias', 'DESIGN.md', 'traspaso'],
        },
        {
          name: 'Guías de diseño web',
          description:
            'Revisa el código de interfaz según guías de interfaz web sobre maquetación, tipografía, color, movimiento y accesibilidad.',
          path: 'skills/web-design-guidelines',
          tags: ['auditoría', 'accesibilidad', 'código de UI'],
        },
        {
          name: 'Experto en color',
          description:
            'Una referencia de ciencia del color que cubre OKLCH, generación de paletas, contraste, nombres de color y la historia de la teoría del color.',
          path: 'skills/color-expert',
          tags: ['color', 'OKLCH', 'contraste'],
        },
      ],
    },
    {
      id: 'plugins',
      heading: 'Plugins',
      intro:
        'Los plugins son los bloques oficiales que conectan las etapas de una ejecución de diseño. Cada uno es una carpeta pequeña con un SKILL.md y un manifiesto.',
      items: [
        {
          name: 'Extracción de diseño',
          description:
            'Extrae tokens de color, tipografía y espaciado de código importado, capturas o exportaciones de Figma y los reúne en un único conjunto canónico.',
          path: 'plugins/_official/atoms/design-extract',
          tags: ['tokens', 'importar', 'extraer'],
        },
        {
          name: 'Mapa de tokens',
          description:
            'Asigna un conjunto de tokens extraídos al sistema de diseño activo. El resultado es una tabla de equivalencias determinista que las etapas siguientes pueden usar.',
          path: 'plugins/_official/atoms/token-map',
          tags: ['tokens', 'mapeo', 'sistema de diseño'],
        },
        {
          name: 'Extracción de Figma',
          description:
            'Trae el árbol de nodos de un archivo de Figma, sus tokens y sus recursos incrustados a la carpeta del proyecto como una instantánea estructurada.',
          path: 'plugins/_official/atoms/figma-extract',
          tags: ['Figma', 'importar', 'recursos'],
        },
        {
          name: 'Teatro de crítica',
          description:
            'Un panel de revisión de cinco dimensiones que puntúa una pieza en oficio, marca, accesibilidad y texto, y después impulsa las correcciones.',
          path: 'plugins/_official/atoms/critique-theater',
          tags: ['crítica', 'puntuación', 'revisión'],
        },
        {
          name: 'Revisión de diferencias',
          description:
            'Muestra el parche acumulado como un diff revisable y guarda la decisión de aceptar o rechazar en el manifiesto de la pieza.',
          path: 'plugins/_official/atoms/diff-review',
          tags: ['revisión', 'diff', 'aprobación'],
        },
        {
          name: 'Traspaso',
          description:
            'Envía la pieza aceptada a un destino posterior, como la CLI, otro agente de código, GitHub o Figma, y registra el destino de exportación.',
          path: 'plugins/_official/atoms/handoff',
          tags: ['exportar', 'traspaso', 'colaboración'],
        },
      ],
    },
    {
      id: 'craft',
      heading: 'Reglas de oficio',
      intro:
        'Los archivos de oficio son manuales de reglas sin marca. El sistema de diseño decide cómo se ven las cosas. Un archivo de oficio decide qué reglas debe cumplir una pantalla antes de publicarse.',
      items: [
        {
          name: 'Base de accesibilidad',
          description:
            'El mínimo de accesibilidad que toda pieza debe cumplir, más compromisos que van más allá. Cita WCAG 2.2 y otras normas relacionadas.',
          path: 'craft/accessibility-baseline.md',
          tags: ['accesibilidad', 'WCAG', 'base'],
        },
        {
          name: 'Cobertura de estados',
          description:
            'Lista los estados que debe mostrar toda superficie interactiva. Ataca el fallo habitual de enseñar solo el estado con datos.',
          path: 'craft/state-coverage.md',
          tags: ['estados', 'UX', 'lista de control'],
        },
        {
          name: 'Tipografía',
          description:
            'Reglas universales sobre cómo se comporta el texto en cada tamaño, aplicadas sobre las fuentes que elija el sistema de diseño.',
          path: 'craft/typography.md',
          tags: ['tipografía', 'escala', 'reglas'],
        },
        {
          name: 'Leyes de la UX',
          description:
            'Heurísticas cognitivas y perceptivas que condicionan la composición: cuántos planes caben, dónde va la acción principal y por qué los ajustes necesitan grupos.',
          path: 'craft/laws-of-ux.md',
          tags: ['UX', 'heurísticas', 'maquetación'],
        },
        {
          name: 'Contra el relleno de IA',
          description:
            'Reglas concretas y comprobables que separan el diseño de un producto publicado del resultado por defecto de un modelo. Algunas las aplica un linter automático.',
          path: 'craft/anti-ai-slop.md',
          tags: ['calidad', 'linter', 'salida de IA'],
        },
        {
          name: 'Escritura de derecha a izquierda',
          description:
            'Reglas para maquetar de derecha a izquierda y para líneas que mezclan direcciones de texto, en productos con lectores de árabe, hebreo o persa.',
          path: 'craft/rtl-and-bidi.md',
          tags: ['RTL', 'i18n', 'maquetación'],
        },
      ],
    },
  ],
  sections: [
    {
      heading: 'Cómo puede usar estos recursos un equipo',
      paragraphs: [
        'No hace falta adoptarlo todo. La mayoría de los equipos empieza con un sistema de diseño y una plantilla, y añade skills cuando las necesita. Como cada recurso es un archivo de texto, valen los hábitos de siempre: ramas, pull requests y revisión de código.',
        'Una diseñadora puede editar un DESIGN.md y ver el efecto en el siguiente prototipo. Un responsable de producto puede leer el mismo archivo y comprobar que el texto y la maqueta siguen las reglas. Un ingeniero puede leer tokens.css y reutilizar los mismos valores en el código.',
      ],
      steps: [
        'Elige el sistema de diseño más cercano a tu producto, o parte del sistema por defecto.',
        'Copia la carpeta, cámbiale el nombre y sustituye colores, tipografía y reglas por los tuyos.',
        'Abre una pull request para que el equipo revise el DESIGN.md como cualquier otro cambio.',
        'Elige una plantilla que encaje con la pieza, como una landing page o un panel de control.',
        'Genera un prototipo y usa una skill de revisión para puntuarlo con tus reglas.',
        'Fusiona el resultado y conserva la carpeta del sistema de diseño como fuente común de verdad.',
      ],
    },
    {
      heading: 'Cómo está organizado el catálogo',
      paragraphs: [
        'El repositorio separa los recursos según lo que hacen. Mantener los grupos aparte facilita encontrar y revisar cada uno.',
      ],
      table: {
        caption: 'Tipos de recurso del repositorio de OpenDesign',
        columns: ['Recurso', 'Carpeta', 'Qué contiene', 'Qué pregunta responde'],
        rows: [
          ['Sistema de diseño', 'design-systems/', 'DESIGN.md, manifiesto y tokens CSS', '¿Cómo debe verse?'],
          ['Plantilla de diseño', 'design-templates/', 'SKILL.md y un archivo de ejemplo', '¿Qué tipo de pieza es?'],
          ['Skill', 'skills/', 'SKILL.md y recursos opcionales', '¿Qué trabajo debe hacer el agente?'],
          ['Plugin', 'plugins/', 'Un manifiesto y un SKILL.md', '¿Cómo se conectan las etapas?'],
          ['Reglas de oficio', 'craft/', 'Manuales en Markdown', '¿Qué debe cumplir una pantalla antes de publicarse?'],
        ],
      },
      subsections: [
        {
          heading: 'Plantillas y skills son distintas',
          paragraphs: [
            'Una plantilla de diseño genera una forma de pieza, como una presentación o una landing page. Una skill trabaja sobre tu entrada, por ejemplo al auditar una pantalla o extraer una marca. Si una entrada sobre todo trabaja, va en la carpeta de skills.',
          ],
        },
        {
          heading: 'Las cifras cambian a menudo',
          paragraphs: [
            'En el momento de escribir esto, el repositorio contiene más de 150 sistemas de diseño, más de 110 plantillas de diseño y más de 160 skills. Abre las carpetas en GitHub para ver la lista actual.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo aportar tu propio recurso',
      paragraphs: [
        'Las contribuciones de más valor suelen ser una carpeta o un archivo Markdown. La guía de contribución del repositorio explica el nivel que debe alcanzar una pull request. La guía de skills cubre cómo escribir y probar una skill.',
      ],
      steps: [
        'Haz un fork del repositorio y crea una rama para tu recurso.',
        'Para un sistema de diseño, añade una carpeta en design-systems con un manifest.json, un DESIGN.md y un archivo tokens.css.',
        'Para una skill o una plantilla, copia la carpeta existente más parecida y edita su SKILL.md.',
        'Comprueba que el DESIGN.md tiene secciones con contenido y coincide con los valores de tokens.css.',
        'Ejecuta la aplicación web en local con pnpm tools-dev y prueba tu recurso con una petición real.',
        'Abre una pull request y rellena todas las secciones de la plantilla.',
      ],
      subsections: [
        {
          heading: 'Qué miran los revisores',
          bullets: [
            'Los archivos están completos, son coherentes y los entienden tanto personas como agentes.',
            'La descripción es concreta y no copia texto de marketing.',
            'Los sistemas inspirados en marcas dicen con claridad que son referencias y no kits oficiales.',
            'El cambio es lo bastante pequeño para revisarlo de una sentada.',
          ],
        },
        {
          heading: '¿No sabes dónde encaja tu idea?',
          paragraphs: [
            'Abre primero una incidencia. Las personas responsables te indicarán la carpeta correcta. Sale más rápido que reescribir una pull request.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: '¿Son estos sistemas de diseño kits de marca oficiales?',
      answer:
        'No. Los sistemas con nombre de producto conocido se inspiran en el aspecto público de esos productos. Sirven como referencia de estudio y como punto de partida. Las marcas no los respaldan, y conviene adaptar los tokens a tu propia identidad antes de publicar.',
    },
    {
      question: '¿Puedo usar estos recursos en un proyecto comercial?',
      answer:
        'El repositorio de OpenDesign usa la licencia Apache-2.0. Lee el archivo de licencia y las notas de cada carpeta, porque algunas entradas citan fuentes de terceros. En los sistemas inspirados en marcas, no copies logotipos ni marcas registradas.',
    },
    {
      question: '¿Qué diferencia hay entre una skill y una plantilla de diseño?',
      answer:
        'Una plantilla de diseño genera un tipo de pieza, como una presentación o una landing page. Una skill trabaja sobre tu entrada, por ejemplo al revisar una pantalla o extraer una marca. Ambas usan un archivo SKILL.md, pero viven en carpetas distintas.',
    },
    {
      question: '¿Cómo añado mi propio sistema de diseño?',
      answer:
        'Crea una carpeta en design-systems con un manifest.json, un DESIGN.md y un archivo tokens.css. Mantén sincronizados el texto y los valores de los tokens. La guía de sistemas de diseño y la guía de contribución del repositorio incluyen la lista de control completa.',
    },
    {
      question: '¿Hace falta saber programar para usar estos recursos?',
      answer:
        'No. Puedes explorar las carpetas en GitHub y leer los archivos como texto. Para usarlos dentro de OpenDesign, eliges un sistema de diseño y una plantilla en la aplicación. Para editar un DESIGN.md basta un editor de texto.',
    },
    {
      question: '¿Qué son las reglas de oficio?',
      answer:
        'Son manuales de reglas sin marca sobre temas como tipografía, color, accesibilidad y cobertura de estados. El sistema de diseño decide cómo se ve una pantalla. Un archivo de oficio decide qué reglas debe cumplir antes de publicarse.',
    },
    {
      question: '¿Es esta la lista completa de recursos?',
      answer:
        'No. Esta página muestra una selección corta de cada grupo. El repositorio contiene muchas más entradas, y las cifras cambian cuando la gente contribuye. Abre las carpetas en GitHub para verlo todo.',
    },
    {
      question: '¿Puede todo un equipo compartir el mismo sistema de diseño?',
      answer:
        'Sí. Un sistema de diseño es una carpeta de un repositorio, así que un equipo puede compartirlo con Git. Todos revisan los cambios en pull requests y trabajan sobre los mismos archivos.',
    },
  ],
  cta: {
    heading: 'Abre una carpeta y prueba una',
    body: 'Elige un sistema de diseño y una plantilla, y ejecútalos con un brief real. Todo está en el repositorio público, así que puedes leerlo antes de instalar nada.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Explorar el repositorio en GitHub',
  },
};
