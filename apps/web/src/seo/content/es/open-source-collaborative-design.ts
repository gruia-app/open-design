import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'open-source-collaborative-design',
  locale: 'es',
  slug: 'diseno-colaborativo-open-source',
  title: 'Diseño colaborativo open source para equipos de producto',
  description:
    'Cómo diseñan en equipo los equipos de producto con herramientas open source: sistemas de diseño compartidos, skills, artefactos revisables y gobierno claro.',
  ogTitle: 'Diseño colaborativo open source, sin depender de un lienzo',
  ogDescription:
    'Guía práctica para equipos de producto: comparte sistemas de diseño, skills y artefactos con git y revísalos como código, con OpenDesign.',
  keywords: [
    'diseño colaborativo open source',
    'herramienta de diseño open source para equipos',
    'flujo de trabajo de diseño colaborativo',
    'sistema de diseño compartido',
    'alternativa open source a Figma',
    'colaboración en equipos de diseño',
    'diseño nativo en código',
    'diseñar con agentes de IA',
  ],
  eyebrow: 'Guía principal',
  h1: 'Diseño colaborativo open source para equipos de producto',
  lede:
    'Un equipo puede diseñar junto sin un único lienzo compartido. Esta guía explica un flujo basado en archivos, git y revisión, con OpenDesign.',
  intro: [
    'Casi todas las herramientas de diseño entienden la colaboración como muchos cursores sobre un mismo lienzo. Ese modelo funciona muy bien para explorar ideas visuales. Funciona peor cuando el resultado tiene que acabar como código real, en un repositorio real y con revisión de compañeros.',
    'OpenDesign sigue otro camino. Es una aplicación open source, local-first y con licencia Apache 2.0. Un agente de IA que ya usas produce el diseño como artefactos de una sola página: CSS real, tipografías reales y componentes reales. Las reglas de marca viven en archivos de texto que cualquiera del equipo puede leer.',
    'Esta guía explica cómo puede trabajar un equipo de producto sobre ese modelo. Cubre roles, recursos compartidos, puesta en marcha, gobierno y señales de que el flujo funciona. Somos un proyecto pequeño, así que las promesas también son pequeñas.',
  ],
  sections: [
    {
      heading: 'Qué significa diseñar en colaboración con open source',
      paragraphs: [
        'Diseño colaborativo open source significa que la herramienta, las reglas de diseño y el resultado están abiertos al equipo. Cualquiera puede leerlos, cambiarlos y proponer un cambio. Nadie necesita un puesto especial para hacerlo.',
        'En OpenDesign las piezas son archivos y carpetas. Un sistema de diseño es una carpeta con un archivo DESIGN.md. Una skill es una carpeta con un archivo SKILL.md. El resultado es un artefacto: un prototipo HTML, una presentación o un documento. Git puede seguir todo eso.',
      ],
      subsections: [
        {
          heading: 'Colaboración en lienzo y colaboración en archivos',
          paragraphs: [
            'Las herramientas de lienzo, como Figma, giran en torno a una superficie visual compartida. Varias personas editan los mismos marcos a la vez. Es una buena opción para el trabajo visual abierto.',
            'OpenDesign no es una herramienta de lienzo. Produce artefactos nativos en código. El equipo colabora en las entradas, que son el briefing, el sistema de diseño y las skills, y revisa las salidas. Los dos enfoques pueden convivir en el mismo equipo.',
          ],
        },
        {
          heading: 'Qué se queda en local',
          paragraphs: [
            'OpenDesign es local-first. La aplicación de escritorio funciona en macOS y Windows, y el daemon lee y escribe archivos en tu máquina. El agente se ejecuta con la herramienta de línea de comandos que elijas, por ejemplo Claude Code, Codex u OpenCode.',
            'Esto importa a los equipos que no pueden enviar trabajo de producto a un lienzo alojado fuera. Tú decides qué agente y qué modelo tocan el trabajo.',
          ],
        },
      ],
    },
    {
      heading: 'Por qué importa el código abierto en el diseño de equipo',
      paragraphs: [
        'Una herramienta de diseño pasa a formar parte de tu proceso de entrega. Si la herramienta es cerrada, el equipo hereda sus límites. Si es abierta, el equipo puede inspeccionarla, ampliarla y seguir trabajando aunque cambie el plan comercial.',
      ],
      bullets: [
        'Inspeccionable: puedes leer cómo llega un sistema de diseño al prompt del agente y puedes cambiarlo.',
        'Portable: los sistemas de diseño, las skills y las plantillas son carpetas normales. Pasan de una máquina o de un repositorio a otro.',
        'Ampliable: un equipo puede escribir su propia skill para una tarea recurrente, como una página de notas de versión.',
        'Auditable: cada cambio en una regla es un commit con autor y motivo.',
        'Independiente del agente: la aplicación detecta varios agentes de línea de comandos, así que el equipo no depende de un único proveedor.',
      ],
      subsections: [
        {
          heading: 'Open source no significa coste cero',
          paragraphs: [
            'El código abierto traslada esfuerzo a tu equipo. Alguien debe cuidar la carpeta del sistema de diseño, revisar los cambios y mantener la aplicación al día. Las secciones siguientes muestran cómo repartir esa carga.',
          ],
        },
        {
          heading: 'Una nota neutral sobre otras herramientas',
          paragraphs: [
            'Figma, Sketch y herramientas parecidas siguen siendo muy buenas para explorar ideas visuales y para pasar el diseño a desarrollo por inspección. OpenDesign actúa en otro paso: convierte un briefing y un sistema de diseño en código que se ejecuta. Muchos equipos usarán las dos cosas.',
          ],
        },
      ],
    },
    {
      heading: 'Roles y flujo de trabajo en un equipo de diseño',
      paragraphs: [
        'Un flujo de trabajo necesita roles claros. Los roles de abajo son sugerencias, no funciones de la aplicación. En un equipo pequeño, una persona puede cubrir varios.',
      ],
      table: {
        caption: 'Roles sugeridos para un equipo que usa OpenDesign',
        columns: ['Rol', 'Tarea principal', 'Trabaja sobre'],
        rows: [
          ['Responsable de diseño', 'Cuida las reglas de marca y el nivel de calidad', 'DESIGN.md, tokens y revisión de artefactos'],
          ['Responsable de producto', 'Escribe el briefing y fija el alcance', 'Briefings, notas de aceptación y prioridades'],
          ['Diseñadora o diseñador', 'Dirige al agente y refina el resultado', 'Prototipos, presentaciones y crítica de resultados'],
          ['Ingeniero o ingeniera front-end', 'Comprueba que el resultado encaja en el código', 'HTML y CSS generados, mapeo a componentes'],
          ['Mantenedor de skills', 'Empaqueta las tareas repetidas', 'Archivos SKILL.md y plantillas de diseño'],
        ],
      },
      subsections: [
        {
          heading: 'Un ciclo semanal',
          steps: [
            'El responsable de producto escribe un briefing corto con el objetivo, la audiencia y las restricciones.',
            'La persona de diseño abre un proyecto, elige el sistema de diseño y el tipo de artefacto, e inicia la sesión.',
            'El agente hace preguntas de aclaración y después genera un primer artefacto en la vista previa.',
            'La persona de diseño refina el artefacto en la misma conversación hasta que cumple el briefing.',
            'El ingeniero revisa el marcado generado y señala lo que no encaja en el código.',
            'El responsable de diseño compara el resultado con DESIGN.md e integra los cambios de reglas con git.',
          ],
        },
        {
          heading: 'Dónde mantiene el control quien diseña',
          paragraphs: [
            'El agente teclea. La persona de diseño decide la dirección. OpenDesign sigue un ciclo de entender el briefing, fijar la dirección, construir el artefacto y criticarlo. Cada paso queda a la vista de quien lleva el proyecto.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo comparte un equipo sistemas de diseño, skills y artefactos',
      paragraphs: [
        'Compartir es el núcleo del trabajo en equipo. OpenDesign te da tres cosas que compartir, y cada una es una carpeta.',
      ],
      subsections: [
        {
          heading: 'Compartir sistemas de diseño',
          paragraphs: [
            'Un paquete de sistema de diseño contiene un manifiesto, un archivo DESIGN.md y un archivo tokens.css. El agente los lee cada vez que un proyecto usa ese sistema. Si todo el equipo elige el mismo paquete, todos los artefactos parten de las mismas reglas.',
            'El repositorio incluye un catálogo amplio de sistemas de diseño, más de cien, que sirven como punto de partida. Tu propio sistema puede vivir junto a ellos o en tu repositorio. En la guía sobre sistemas de diseño como código tienes la estructura de archivos.',
          ],
        },
        {
          heading: 'Compartir skills y plantillas',
          paragraphs: [
            'Una skill describe cómo debe hacer el agente un tipo de trabajo. Una plantilla de diseño describe la forma de un artefacto, como un panel de control o una página de precios. Las dos son carpetas normales.',
            'Puedes instalar una skill pública con la herramienta de línea de comandos od, por ejemplo desde un repositorio de GitHub. Tu equipo puede guardar sus skills privadas en un repositorio e instalarlas en cada máquina.',
          ],
          bullets: [
            'Mantén un repositorio para las skills y plantillas del equipo.',
            'Nombra cada skill por la tarea, no por la persona que la escribió.',
            'Escribe una descripción corta para que el agente sepa cuándo usarla.',
          ],
        },
        {
          heading: 'Compartir artefactos para revisión',
          paragraphs: [
            'Un artefacto es un archivo. Puedes exportarlo como HTML, PDF, PPTX o vídeo, según su tipo. También puedes subir el HTML fuente a un repositorio y abrir una pull request.',
            'Así los revisores ven un diff real. Pueden ejecutar la página, comentar el código y compararlo con las reglas de diseño.',
          ],
        },
        {
          heading: 'Espacios de equipo en la línea de comandos',
          paragraphs: [
            'La herramienta od incluye también un grupo collab. Admite espacios de trabajo de equipo, presencia, publicar un proyecto para que los miembros lo descarguen, y compartir con el equipo un sistema de diseño, un plugin o una skill.',
            'Piensa en ello como la capa de equipo sobre el flujo de archivos. Consulta las notas de la versión y tu propia compilación antes de apoyarte en ello, porque cambia más deprisa que los formatos de archivo.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo poner en marcha a tu equipo',
      paragraphs: [
        'Puedes empezar con una persona de diseño y un repositorio. Añade gente solo cuando el primer ciclo funcione.',
      ],
      steps: [
        'Instala la aplicación de escritorio o ejecuta el proyecto desde el código fuente. La guía de inicio rápido lista los requisitos, incluidos Node 24 y pnpm.',
        'Instala al menos un agente de línea de comandos compatible y confirma que OpenDesign lo detecta.',
        'Crea un repositorio para tu sistema de diseño, tus skills y tus plantillas.',
        'Elige un sistema de diseño incluido que se parezca a tu marca, o empieza el tuyo con un archivo DESIGN.md.',
        'Ejecuta de principio a fin un briefing real de tu backlog y anota lo que falla.',
        'Escribe los roles de la tabla anterior y nombra a una persona responsable del sistema de diseño.',
        'Invita a una segunda persona de diseño y a un ingeniero, y repite el ciclo semanal durante dos semanas.',
      ],
      subsections: [
        {
          heading: 'Una lista breve de comprobación',
          table: {
            caption: 'Lista de comprobación antes de sumar más gente',
            columns: ['Pregunta', 'Respuesta sana', 'Si no es así'],
            rows: [
              ['¿Funciona el agente en todas las máquinas?', 'Sí, la aplicación lo detecta', 'Corrige el PATH e instala el agente'],
              ['¿Hay un repositorio con las reglas de diseño?', 'Sí, con una persona responsable', 'Créalo y asigna al responsable'],
              ['¿Cabe un briefing en una página?', 'Sí, con objetivo y restricciones', 'Usa una plantilla de briefing y acórtalo'],
              ['¿Puede un ingeniero abrir el resultado?', 'Sí, como HTML y CSS normales', 'Sube el código fuente junto al código'],
              ['¿Alguien revisa los cambios de reglas?', 'Sí, mediante pull requests', 'Activa la revisión obligatoria'],
            ],
          },
        },
        {
          heading: 'Empieza con un proyecto pequeño',
          paragraphs: [
            'Elige una página que importe pero que no bloquee una entrega, como un panel interno o el borrador de una landing. Un inicio pequeño da opiniones sinceras con poco riesgo.',
          ],
        },
      ],
    },
    {
      heading: 'Gobierno de los recursos de diseño compartidos',
      paragraphs: [
        'Los archivos compartidos necesitan reglas compartidas. Aquí, gobierno significa unos pocos acuerdos breves, no un comité.',
      ],
      bullets: [
        'Una persona responsable por sistema de diseño. Esa persona aprueba los cambios en DESIGN.md y tokens.css.',
        'Los cambios pasan por pull request. La descripción indica qué regla cambia y por qué.',
        'Los tokens y el texto van sincronizados. Si DESIGN.md nombra un acento nuevo, tokens.css cambia en la misma pull request.',
        'Cada skill tiene una descripción corta y un mantenedor con nombre.',
        'Las reglas retiradas se borran, no se comentan, para que el agente no lea nunca una guía obsoleta.',
      ],
      subsections: [
        {
          heading: 'Revisa reglas, no píxeles',
          paragraphs: [
            'Una buena revisión pregunta si la regla está clara y si el artefacto la cumple. No discute un margen concreto. Si un artefacto rompe una regla, arregla el artefacto o arregla la regla.',
          ],
        },
        {
          heading: 'Contribución y licencias',
          paragraphs: [
            'OpenDesign usa la licencia Apache 2.0 y el repositorio acepta contribuciones. Tu propio sistema de diseño y tus skills conservan la licencia que tú les des. Decide pronto si se quedan privados en la empresa o si se publican.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo saber que el flujo funciona',
      paragraphs: [
        'Preferimos señales cualitativas a cifras inventadas. Tu equipo conoce su punto de partida mejor que cualquier prueba comparativa. Observa estos cambios durante unos cuantos sprints.',
      ],
      table: {
        caption: 'Señales cualitativas de un flujo sano',
        columns: ['Señal', 'Qué notas', 'Dónde mirar'],
        rows: [
          ['Menos retrabajo', 'Los diseños casi no vuelven por fallos de marca', 'Comentarios de las pull requests'],
          ['Primer borrador más rápido', 'Un briefing llega a una página revisable el mismo día', 'Historial del proyecto'],
          ['Aspecto coherente', 'Las páginas nuevas encajan con las antiguas sin esfuerzo', 'Capturas lado a lado'],
          ['Ingeniería se implica pronto', 'Los ingenieros comentan el marcado, no la falta de especificaciones', 'Hilos de revisión'],
          ['Las reglas mejoran', 'DESIGN.md cambia a menudo y en pasos pequeños', 'Historial de git del sistema de diseño'],
        ],
      },
      subsections: [
        {
          heading: 'Señales de problema',
          bullets: [
            'Nadie cuida el sistema de diseño y las ediciones ocurren en máquinas sueltas.',
            'Los briefings superan una página porque suplen una regla que falta.',
            'Los ingenieros reescriben el resultado desde cero cada vez.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: '¿Existe una alternativa open source a Figma para equipos?',
      answer:
        'OpenDesign es una opción open source, pero funciona de otra manera. No es un lienzo compartido. Produce artefactos nativos en código a partir de un briefing y un sistema de diseño, y el equipo colabora con archivos compartidos y revisión. Muchos equipos lo usan junto a una herramienta de lienzo.',
    },
    {
      question: '¿Pueden varias personas trabajar a la vez en el mismo diseño?',
      answer:
        'El camino fiable se basa en archivos: cada persona trabaja en un proyecto y el equipo une reglas y código con git. La línea de comandos tiene además un grupo collab para espacios de equipo y presencia. Comprueba el estado actual en tu compilación antes de planificar con ello.',
    },
    {
      question: '¿Cómo mantenemos la coherencia de marca entre diseñadores?',
      answer:
        'Pon las reglas de marca en un paquete de sistema de diseño con un archivo DESIGN.md y un archivo tokens.css. Cada proyecto que elige el paquete da al agente las mismas reglas. Revisa los cambios de esos archivos con pull requests.',
    },
    {
      question: '¿Hace falta montar un servidor propio?',
      answer:
        'El flujo básico no necesita servidor. OpenDesign es local-first y su daemon se ejecuta en tu máquina. Tú eliges la herramienta de agente y el modelo, así que el trabajo de producto queda bajo tu control.',
    },
    {
      question: '¿Con qué agentes de IA funciona OpenDesign?',
      answer:
        'Detecta un registro de agentes locales de línea de comandos, entre ellos Claude Code, Codex, OpenCode y Cursor Agent. La guía de inicio rápido lista el conjunto actual. Puedes cambiar de agente entre sesiones.',
    },
    {
      question: '¿Podemos compartir nuestras propias skills con el equipo?',
      answer:
        'Sí. Una skill es una carpeta con un archivo SKILL.md. Guarda las skills del equipo en un repositorio e instálalas con la herramienta od desde una fuente de GitHub. Así todo el equipo usa las mismas skills en cada máquina.',
    },
    {
      question: '¿Cómo se revisa un diseño generado con IA?',
      answer:
        'Se revisa como código. Sube el HTML fuente, abre una pull request y compáralo con DESIGN.md. Los ingenieros pueden ejecutar la página y el responsable de diseño confirma que se siguieron las reglas.',
    },
    {
      question: '¿Cuánto cuesta adoptarlo?',
      answer:
        'La aplicación es open source con licencia Apache 2.0. Tus costes son el agente o el modelo que conectes y el tiempo que tu equipo dedica a cuidar el sistema de diseño. Aquí no publicamos precios de modelos de terceros.',
    },
  ],
  cta: {
    heading: 'Prueba un briefing con tu equipo',
    body:
      'Descarga la aplicación, elige un sistema de diseño y ejecuta un briefing real. Si te sirve, comparte el repositorio con un compañero. Si no, cuéntanos qué falló.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el repositorio en GitHub',
  },
};
