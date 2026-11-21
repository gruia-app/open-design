import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'ai-prototyping-workflow',
  locale: 'es',
  slug: 'prototipado-con-agentes-ia',
  title: 'Prototipado con agentes de IA: del briefing al prototipo',
  description:
    'Aprende un flujo de prototipado con agentes de IA en OpenDesign: escribe el briefing, fija la dirección, revisa el resultado y entrega HTML real a ingeniería.',
  ogTitle: 'Prototipado con agentes de IA: del briefing a un prototipo real',
  ogDescription:
    'Un bucle práctico para equipos de producto: briefing, dirección, artefacto, crítica y entrega. Úsalo con el agente de código que ya tienes, en OpenDesign.',
  keywords: [
    'prototipado con ia',
    'flujo de prototipado con agentes',
    'generar prototipo html con ia',
    'del briefing al prototipo',
    'herramienta de diseño con ia open source',
    'prototipar con agentes de código',
    'handoff de diseño a código con ia',
    'prototipado para equipos de producto',
  ],
  eyebrow: 'Guía',
  h1: 'Prototipado con agentes de IA, del briefing al prototipo funcional',
  lede:
    'OpenDesign convierte un briefing escrito en un prototipo HTML real con el agente de código que ya tienes en tu equipo. Esta guía explica el bucle y cómo lo usa un equipo de producto.',
  intro: [
    'Muchos prototipos nacen de un mensaje vago en un hilo de chat. Alguien escribe "necesitamos una página de ajustes para equipos", y tres personas imaginan tres páginas distintas. Un flujo de prototipado con IA fija el orden del trabajo. Primero escribes el briefing. Después acordáis una dirección. Solo entonces construye el agente.',
    'OpenDesign sigue un bucle: descubrir el briefing, fijar la dirección, generar el artefacto, criticarlo y entregarlo. El bucle no es nuevo. Los buenos equipos de diseño ya trabajan así. La diferencia es que un agente de código hace el trabajo de teclado y cada paso deja un archivo que puedes abrir.',
    'Esta guía cubre el bucle completo para equipos de producto. Explica los tipos de artefacto, cómo escribir un briefing que funcione, cómo iterar sin perder el hilo y cómo pasar el resultado a ingeniería. Describe cómo usamos la herramienta. No promete magia.',
  ],
  sections: [
    {
      heading: 'Qué es un flujo de prototipado con IA',
      paragraphs: [
        'Un flujo de prototipado con IA es una secuencia fija de pasos en la que un agente de código construye el prototipo y las personas lo dirigen. La secuencia importa más que el modelo. Un equipo con una secuencia clara obtiene resultados repetibles con casi cualquier agente competente.',
        'OpenDesign no incluye su propio agente. Usa las CLI de agentes de código que ya funcionan en tu ordenador, como Claude Code, Codex, Cursor Agent, OpenCode, Qwen o GitHub Copilot CLI. Si no tienes ninguna CLI instalada, puedes configurar en Ajustes un proveedor con tu propia clave.',
      ],
      subsections: [
        {
          heading: 'Por qué un bucle gana a un único prompt',
          paragraphs: [
            'Un prompt largo esconde decisiones. El agente adivina el público, el tono, la maqueta y la marca. La mayoría de esas conjeturas fallan en pequeño, y las pagas más tarde.',
            'Un bucle hace visible cada decisión. Respondes preguntas antes de construir. Apruebas una dirección antes del primer píxel. Lees una crítica antes de entregar. Cada puerta cuesta un minuto y ahorra una hora.',
          ],
        },
        {
          heading: 'Qué sigue bajo tu control',
          bullets: [
            'El agente: tú eliges qué CLI instalada o qué proveedor con clave hace el trabajo.',
            'La marca: un archivo DESIGN.md en el proyecto describe colores, tipografía y componentes.',
            'Los archivos: el resultado es HTML y CSS planos en la carpeta de tu proyecto.',
            'La aprobación: nada se entrega hasta que una persona acepta el resultado.',
          ],
        },
      ],
    },
    {
      heading: 'Los cinco pasos del bucle de OpenDesign',
      paragraphs: [
        'El bucle tiene cinco pasos. Cada paso tiene una tarea y un resultado. Los equipos que se saltan un paso suelen volver a él más tarde, a mayor precio.',
      ],
      steps: [
        'Descubre el briefing. El agente hace preguntas cortas sobre público, objetivo, plataforma y tono.',
        'Fija la dirección. Eliges una dirección visual o asocias un sistema de diseño existente.',
        'Genera el artefacto. El agente escribe los archivos y la vista previa se actualiza cuando cambian.',
        'Critica. Un panel de revisión puntúa el artefacto y el agente corrige lo que falla.',
        'Entrega. Exportas el resultado o pasas los archivos a ingeniería.',
      ],
      subsections: [
        {
          heading: 'Paso 1: descubrir el briefing',
          paragraphs: [
            'El agente puede hacer preguntas aclaratorias en un formulario dentro del chat. Las respondes de una vez. Las respuestas vuelven al agente como tu siguiente mensaje, así que no se pierde nada.',
            'Mantén las respuestas cortas y concretas. "Responsables de operaciones de una empresa de logística, escritorio, tablas densas" es una buena respuesta. "Todo el mundo" no lo es.',
          ],
        },
        {
          heading: 'Paso 2: fijar la dirección',
          paragraphs: [
            'Si no tienes marca, puedes elegir entre varias direcciones visuales preparadas. Si tienes marca, asocias un sistema de diseño. En OpenDesign, un sistema de diseño es una carpeta con un archivo DESIGN.md que el agente lee en cada render.',
            'Cierra este paso antes de construir. Cambiar la dirección después de construir cuesta más que cambiarla antes.',
          ],
        },
        {
          heading: 'Pasos 3 a 5: construir, criticar, entregar',
          paragraphs: [
            'El agente escribe los archivos y la vista previa los sigue. Cuando el agente termina un artefacto, el Design Jury integrado puede revisarlo. Cinco revisores lo puntúan: Designer, Critic, Brand, Accessibility y Copy.',
            'Por defecto la revisión dura hasta tres rondas. El artefacto sale cuando la puntuación compuesta llega a 8,0 sobre 10. Si no llega, la ejecución recurre a la mejor ronda. Después exportas o pasas los archivos.',
          ],
        },
      ],
    },
    {
      heading: 'Qué puedes prototipar',
      paragraphs: [
        'Un proyecto nuevo empieza en una de seis pestañas de creación: Prototype, Live Artifact, Deck, Template, Media y Other. La pestaña fija el tipo de proyecto y las skills que usa el agente.',
      ],
      table: {
        caption: 'Pestañas de creación de OpenDesign y qué produce cada una',
        columns: ['Pestaña de creación', 'Qué produce', 'Uso habitual'],
        rows: [
          [
            'Prototype',
            'Interfaces web adaptables, móvil, tableta o app de escritorio en HTML',
            'Páginas de aterrizaje, pantallas de app, flujos',
          ],
          [
            'Live Artifact',
            'Artefactos de alta fidelidad con datos y parámetros editables',
            'Paneles, cuadros de KPI, salas de decisión',
          ],
          [
            'Deck',
            'Presentaciones de varias diapositivas con notas del orador',
            'Presentaciones de inversión, informes semanales, charlas internas',
          ],
          [
            'Template',
            'Un proyecto nuevo a partir de una plantilla que guardaste',
            'Formatos repetibles para tu equipo',
          ],
          [
            'Media',
            'Imágenes, vídeo y audio con los proveedores que configures',
            'Recursos visuales y gráficos en movimiento',
          ],
          [
            'Other',
            'Un proyecto libre sin skill obligatoria',
            'Documentos y todo lo que no encaja en otro sitio',
          ],
        ],
      },
      subsections: [
        {
          heading: 'Prototipos web, de escritorio y móvil',
          paragraphs: [
            'En la pestaña Prototype eliges una o varias plataformas y un nivel de fidelidad. También puedes elegir una plantilla de renderizado del catálogo de plantillas de diseño, como un panel, una página de documentación o el flujo de una app móvil.',
            'El resultado es una página real en HTML y CSS. Se muestra en una vista previa aislada dentro de la app. Puedes abrir los archivos en cualquier editor.',
          ],
        },
        {
          heading: 'Presentaciones y paneles',
          paragraphs: [
            'Las presentaciones usan plantillas de deck y admiten notas del orador. Revisas las diapositivas como miniaturas y exportas cuando estás listo.',
            'Los live artifacts ofrecen un panel de ajustes (tweaks). El agente escribe un manifiesto con los parámetros que merece la pena cambiar, y la vista previa se redibuja sin recargar. Ayuda cuando alguien quiere ver el mismo panel con otras cifras.',
          ],
        },
        {
          heading: 'Formatos de exportación',
          bullets: [
            'HTML: el formato nativo de cada prototipo.',
            'PDF: para documentos y presentaciones que se leen sin conexión.',
            'PPTX: para presentaciones que marketing o ventas editarán en una herramienta de diapositivas.',
            'MP4: para gráficos en movimiento creados con HyperFrames, que convierte HTML en vídeo.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo ejecuta el flujo un equipo de producto',
      paragraphs: [
        'El bucle funciona para una sola persona. Funciona mejor si cada rol es dueño de una puerta. Los roles de abajo son una sugerencia. Los equipos pequeños los fusionarán.',
      ],
      table: {
        caption: 'Quién es dueño de cada puerta en una ejecución de equipo',
        columns: ['Paso', 'Responsable', 'Pregunta que responde'],
        rows: [
          ['Briefing', 'Responsable de producto', '¿Para quién es esto y qué debe poder hacer la persona usuaria?'],
          ['Dirección', 'Responsable de diseño', '¿Qué marca y qué dirección visual se aplican?'],
          ['Construcción', 'Agente de código', '¿El artefacto cumple el briefing y el sistema de diseño?'],
          ['Crítica', 'Responsable de diseño y revisores', '¿Pasa la revisión el artefacto y está el equipo de acuerdo?'],
          ['Traspaso', 'Ingeniero front-end', '¿Puedo seguir desde estos archivos sin rehacer nada?'],
        ],
      },
      subsections: [
        {
          heading: 'Un sprint de prototipo de un día',
          steps: [
            'Por la mañana: producto escribe el briefing y diseño asocia el sistema de diseño.',
            'A media mañana: el agente construye la primera versión y el equipo revisa la vista previa en conjunto.',
            'Primera hora de la tarde: el equipo lista tres cambios y el agente los aplica en un solo mensaje.',
            'A media tarde: se ejecuta el Design Jury y el equipo corrige lo que marca como imprescindible.',
            'Al final del día: ingeniería recibe los archivos y empieza desde HTML real.',
          ],
        },
        {
          heading: 'Guarda la marca en un solo sitio',
          paragraphs: [
            'Pon la marca en el archivo DESIGN.md, no en el prompt. Así todos los proyectos, personas y agentes usan los mismos tokens. Un color nuevo cambia en un archivo, no en veinte chats.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo escribir un buen briefing',
      paragraphs: [
        'Un buen briefing es corto y concreto. Nombra a una persona, una tarea y una restricción. Así el agente tiene menos que adivinar.',
      ],
      bullets: [
        'Nombra al público en una frase, por ejemplo "responsables de finanzas de una empresa mediana".',
        'Indica la única tarea que la página debe permitir.',
        'Indica la plataforma: web, móvil, tableta o app de escritorio.',
        'Lista el contenido que debe aparecer, como una tabla, un gráfico o un bloque de precios.',
        'Lista lo que se debe evitar, como fotos de archivo o formularios largos.',
        'Añade una referencia, como una captura o una URL, si la tienes.',
      ],
      subsections: [
        {
          heading: 'Un briefing débil y uno mejor',
          paragraphs: [
            'Débil: "Haz un panel para nuestro producto". El agente debe inventar al usuario, los datos y el estilo.',
            'Mejor: "Un panel semanal para responsables de soporte, en escritorio. Muestra tickets abiertos por prioridad, tiempo medio de respuesta y los diez tickets más antiguos. Usa nuestro sistema de diseño. Que sea sobrio y denso."',
          ],
        },
        {
          heading: 'Usa referencias, no adjetivos',
          paragraphs: [
            'Palabras como "moderno" y "limpio" significan cosas distintas para cada persona. Una captura, una URL o un sistema de diseño existente aportan más información. Si no tienes nada, elige una de las direcciones preparadas y sigue.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo iterar sin perder el hilo',
      paragraphs: [
        'La iteración es donde más prototipos se tuercen. El equipo envía diez peticiones pequeñas y la página se desvía. Unos pocos hábitos mantienen el rumbo.',
      ],
      bullets: [
        'Agrupa los comentarios. Envía un mensaje con tres a cinco cambios, no cinco mensajes con uno.',
        'Señala el elemento. Di "la segunda tarjeta de la fila de precios", no "esa caja".',
        'Cambia una capa cada vez. Primero la estructura, luego el texto, luego el color.',
        'Usa el panel de ajustes para los valores. No pidas al agente que reescriba una cifra.',
        'Guarda una buena versión. Guarda una plantilla cuando un proyecto se convierta en un formato que reutilizarás.',
      ],
      subsections: [
        {
          heading: 'Cuándo empezar de nuevo',
          paragraphs: [
            'Empieza de nuevo cuando la dirección es errónea, no cuando lo son los detalles. Si tres rondas de comentarios no acercan la página al briefing, el problema es el briefing o la dirección. Vuelve al paso uno o al paso dos.',
          ],
        },
        {
          heading: 'Qué aporta la crítica',
          paragraphs: [
            'El Design Jury revisa lo que las personas olvidan con prisa: contraste, estados de foco, estructura semántica, uso de tokens y texto de los mensajes de error. No sustituye una revisión humana. La hace más corta.',
          ],
        },
      ],
    },
    {
      heading: 'Traspaso a ingeniería',
      paragraphs: [
        'El traspaso es sencillo porque el artefacto ya es código. No hay exportación desde un lienzo ni archivo de medidas que interpretar.',
      ],
      steps: [
        'Abre la carpeta del proyecto y comprueba que están el HTML, el CSS y los recursos.',
        'Instala el servidor MCP de OpenDesign en el agente de código que usa ingeniería, con el comando od mcp install de ese agente.',
        'Pide al agente de ingeniería que lea los archivos y los porte a vuestro framework, como React, Next.js o Vue.',
        'Mantén el archivo DESIGN.md en el repositorio para que los componentes nuevos sigan los mismos tokens.',
        'Revisa el resultado en una pull request normal.',
      ],
      subsections: [
        {
          heading: 'Por qué ayuda MCP',
          paragraphs: [
            'OpenDesign incluye un servidor MCP por stdio. Un agente en otro repositorio puede leer los archivos vivos de tus proyectos de OpenDesign, como el CSS de tokens, los componentes y el HTML de entrada. Ve el archivo actual, no una exportación antigua en un zip.',
          ],
        },
        {
          heading: 'Traspaso a personas que no son ingenieras',
          paragraphs: [
            'Marketing y ventas suelen querer otro formato. Exporta una presentación como PPTX o PDF. Exporta un gráfico en movimiento como MP4. Comparte el HTML cuando alguien solo necesite verlo.',
          ],
        },
      ],
    },
    {
      heading: 'Límites y compromisos honestos',
      paragraphs: [
        'Este flujo no sirve para todos los casos. Ten claros sus límites antes de montar un proceso a su alrededor.',
      ],
      bullets: [
        'La calidad depende del agente y del modelo que elijas. Un modelo débil da páginas débiles.',
        'El resultado es código. Si quieres mover formas a mano en un lienzo, encaja mejor una herramienta de lienzo.',
        'La instalación necesita la app de escritorio, un entorno local o un despliegue con Docker, y una CLI de agente o una clave de API.',
        'El Design Jury es una ayuda. Una persona debe decidir si el trabajo es bueno.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Qué es un flujo de prototipado con IA?',
      answer:
        'Es una secuencia fija en la que un agente de código construye un prototipo y las personas aprueban cada etapa. En OpenDesign la secuencia es descubrir el briefing, fijar la dirección, generar el artefacto, criticar y entregar. Cada etapa produce un archivo o una decisión que puedes inspeccionar.',
    },
    {
      question: '¿Con qué agentes de código funciona OpenDesign?',
      answer:
        'OpenDesign funciona con CLI de agentes locales como Claude Code, Codex, Cursor Agent, OpenCode, Qwen y GitHub Copilot CLI. La lista actual está en el registro de runtimes del repositorio. Si no tienes ninguna CLI, puedes usar un proveedor con tu propia clave configurado en Ajustes.',
    },
    {
      question: '¿Qué puedo exportar de un prototipo de OpenDesign?',
      answer:
        'Los prototipos son archivos HTML y CSS. Las presentaciones pueden exportarse a PPTX y PDF, y los gráficos en movimiento de HyperFrames pueden exportarse a MP4. Las rutas de exportación disponibles dependen del tipo de artefacto.',
    },
    {
      question: '¿Puede el prototipo con IA usar mi propia marca?',
      answer:
        'Sí. Añades un archivo DESIGN.md de tu marca a la carpeta de sistemas de diseño, o dejas que el agente lo cree a partir de una captura o una URL. Cada render lee entonces ese archivo como contrato de marca.',
    },
    {
      question: '¿Cómo paso un prototipo hecho con IA a ingeniería?',
      answer:
        'Entrega los archivos del proyecto, porque el prototipo es HTML y CSS reales. También puedes instalar el servidor MCP de OpenDesign en su agente de código para que lea los archivos vivos. Después portan la página a React, Next.js, Vue o al framework que uséis.',
    },
    {
      question: '¿Qué es el Design Jury?',
      answer:
        'El Design Jury es un panel de revisión integrado con cinco revisores: Designer, Critic, Brand, Accessibility y Copy. Puntúa el artefacto en hasta tres rondas por defecto y lo da por bueno cuando la puntuación compuesta llega a 8,0 sobre 10. Una persona toma la decisión final.',
    },
    {
      question: '¿Necesito instalar algo para usar el flujo?',
      answer:
        'Necesitas la app de escritorio de OpenDesign para macOS o Windows, o una instalación con Docker o desde el código fuente, además de una CLI de agente de código o una clave de API. La guía rápida del repositorio lista los requisitos exactos. El proyecto es de código abierto con licencia Apache 2.0.',
    },
  ],
  cta: {
    heading: 'Prueba el bucle con tu próximo briefing',
    body: 'Descarga OpenDesign, elige el agente de código que ya usas y convierte un briefing real en un prototipo. Es gratuito y de código abierto, y puedes leer cada archivo que escribe.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el código en GitHub',
  },
};
