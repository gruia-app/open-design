import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'open-source-design-tool-comparison',
  locale: 'es',
  slug: 'comparativa-herramientas-diseno-open-source',
  title: 'Herramientas de diseño open source: comparativa',
  description:
    'Compara herramientas de diseño open source para equipos de producto: OpenDesign, Penpot, Figma y Claude Design. Licencia, formato, agentes y autoalojamiento.',
  ogTitle: 'Cómo elegir una herramienta de diseño open source en tu equipo',
  ogDescription:
    'Una comparativa neutral de OpenDesign, Penpot, Figma y Claude Design. Descubre qué criterios importan y cuándo conviene otra herramienta.',
  keywords: [
    'herramientas de diseño open source',
    'alternativa open source a figma',
    'alternativa open source a claude design',
    'penpot vs figma',
    'alternativa a penpot',
    'herramienta de diseño autoalojada',
    'comparativa herramientas de diseño',
    'herramienta de diseño con ia código abierto',
    'herramienta de diseño para equipos de producto',
  ],
  eyebrow: 'Guía',
  h1: 'Cómo elegir una herramienta de diseño open source para un equipo de producto',
  lede:
    'Las herramientas de diseño open source se distinguen por su fuente de verdad: un lienzo o el código. Esta guía compara OpenDesign con Penpot, Figma y Claude Design con criterios neutrales.',
  intro: [
    'Elegir una herramienta de diseño es una decisión de equipo, no una cuestión de gustos. La herramienta decide dónde viven los archivos, quién puede abrirlos, cómo recibe ingeniería el trabajo y qué pasa si un proveedor cambia sus condiciones. El código abierto no responde a todas estas preguntas. Responde a algunas.',
    'Esta guía la escribe el equipo de OpenDesign, así que tenemos un sesgo. Intentamos compensarlo con criterios claros y con una sección honesta sobre cuándo conviene otra herramienta. Solo afirmamos de otras herramientas lo que es muy conocido y estable. Dejamos fuera precios y hojas de ruta, porque ambos cambian.',
    'La guía empieza por la pregunta que más importa: ¿tu fuente de verdad es un lienzo o es código? Después ofrece dos tablas comparativas, un método breve de decisión y notas para adoptar una herramienta sin un cambio arriesgado.',
  ],
  sections: [
    {
      heading: 'La pregunta que ordena las herramientas',
      paragraphs: [
        'Las herramientas de diseño se dividen en dos grupos. En el primero, la fuente de verdad es un lienzo. Las personas dibujan formas, marcos y componentes, y los ingenieros los reconstruyen en código. En el segundo, la fuente de verdad es el código. Un agente escribe HTML y CSS reales, y el diseño es la página en funcionamiento.',
        'Ningún grupo es mejor en general. Las herramientas de lienzo sirven para explorar a mano y pulir lo visual. Las herramientas nativas de código sirven para prototipos rápidos y ejecutables, con un camino corto hasta ingeniería. Muchos equipos usan ambas.',
      ],
      subsections: [
        {
          heading: 'Herramientas centradas en el lienzo',
          paragraphs: [
            'Figma y Penpot son herramientas de lienzo. Figma es un SaaS de lienzo propietario. Penpot es de código abierto, funciona en el navegador y puedes alojarlo tú. Ambas permiten que varias personas dibujen sobre un archivo compartido.',
          ],
        },
        {
          heading: 'Herramientas nativas de código',
          paragraphs: [
            'OpenDesign y Claude Design son herramientas nativas de agentes. Escribes un briefing y un agente produce artefactos como prototipos, presentaciones y paneles. Claude Design es de código cerrado y solo funciona en la nube. OpenDesign es de código abierto con licencia Apache 2.0 y funciona en tu máquina o en tu servidor.',
          ],
        },
      ],
    },
    {
      heading: 'Criterios que importan a un equipo de producto',
      paragraphs: [
        'Haz la lista de criterios antes de mirar herramientas. La siguiente lista recoge lo que importa a la mayoría de los equipos de producto. Ordénala según tu contexto.',
      ],
      bullets: [
        'Licencia: ¿puedes leer, cambiar y redistribuir el código?',
        'Dónde viven los archivos: ¿en tu disco, en tu servidor o en la nube de un proveedor?',
        'Formato de salida: ¿formas en un archivo propietario o archivos web estándar?',
        'Soporte de agentes: ¿la herramienta trabaja con los agentes de código que ya usa tu equipo?',
        'Formato del sistema de diseño: ¿cómo guardas tokens, componentes y reglas de marca?',
        'Autoalojamiento: ¿puedes ejecutarla dentro de tu propia red?',
        'Traspaso: ¿cuánto trabajo repetido hay entre el diseño y la página publicada?',
        'Colaboración: ¿cómo trabajan varias personas en el mismo proyecto?',
      ],
      subsections: [
        {
          heading: 'Por qué la licencia no basta',
          paragraphs: [
            'Una licencia de código abierto te da derechos sobre el código. No te da, por sí sola, una buena herramienta. Comprueba que el proyecto esté activo, que puedas ejecutarlo y que tus archivos sigan siendo portables.',
          ],
        },
        {
          heading: 'Por qué importa dónde están los archivos',
          paragraphs: [
            'Los archivos en tu disco o en tu servidor siguen funcionando cuando un proveedor cambia de planes. También pasan mejor una revisión de seguridad. Si tu equipo legal pregunta dónde viven los datos de diseño, una respuesta local es corta.',
          ],
        },
      ],
    },
    {
      heading: 'Tabla comparativa 1: licencia, alojamiento y archivos',
      paragraphs: [
        'La tabla siguiente cubre hechos estables y fáciles de comprobar. De las demás herramientas solo recoge propiedades muy conocidas.',
      ],
      table: {
        caption: 'Licencia, alojamiento y ubicación de los archivos',
        columns: ['Criterio', 'OpenDesign', 'Penpot', 'Figma', 'Claude Design'],
        rows: [
          ['Licencia', 'Código abierto, Apache 2.0', 'Código abierto', 'Propietaria', 'Código cerrado'],
          [
            'Dónde viven los archivos',
            'En tu máquina o en tu servidor, como carpetas de proyecto',
            'En un servidor que alojas tú o en el servicio alojado',
            'En la nube del proveedor',
            'En la nube del proveedor',
          ],
          [
            'Autoalojamiento',
            'Sí: app de escritorio, Docker o desde el código fuente',
            'Sí',
            'No',
            'No',
          ],
          [
            'Funciona en el navegador',
            'Interfaz web servida por el daemon local',
            'Sí',
            'Sí',
            'Producto alojado en la nube',
          ],
          [
            'Superficie principal de trabajo',
            'Chat y vista previa en vivo de los archivos generados',
            'Lienzo compartido',
            'Lienzo compartido',
            'Chat y artefactos generados',
          ],
        ],
      },
      subsections: [
        {
          heading: 'Cómo leer esta tabla',
          paragraphs: [
            'El autoalojamiento es la línea más clara. Si tu política exige que los datos de diseño no salgan de tu red, Figma y Claude Design quedan fuera por definición. Quedan Penpot y OpenDesign.',
          ],
        },
        {
          heading: 'Lo que la tabla no dice',
          paragraphs: [
            'La tabla no ordena por calidad. Una herramienta cerrada puede ser excelente y una abierta puede encajar mal. Usa la tabla para descartar opciones, no para elegir ganadora.',
          ],
        },
      ],
    },
    {
      heading: 'Tabla comparativa 2: salida, agentes y sistemas de diseño',
      paragraphs: [
        'Esta tabla cubre cómo produce trabajo cada herramienta y cómo encaja con los agentes de código. Estos puntos deciden cuánto trabajo repetido hay entre diseño e ingeniería.',
      ],
      table: {
        caption: 'Formato de salida, soporte de agentes y formato del sistema de diseño',
        columns: ['Criterio', 'OpenDesign', 'Penpot', 'Figma', 'Claude Design'],
        rows: [
          [
            'Formato de salida',
            'Archivos HTML y CSS; exportación a PDF, PPTX y MP4 en algunos tipos de artefacto',
            'Archivos de diseño vectorial en un lienzo',
            'Archivos de diseño en un lienzo',
            'Artefactos generados dentro del producto del proveedor',
          ],
          [
            'Soporte de agentes',
            'Usa las CLI de agentes de código de tu máquina, o un proveedor con clave',
            'No es nativa de agentes; se accede por su API y sus plugins',
            'No es nativa de agentes; se accede por su API y sus plugins',
            'Solo modelos de Anthropic',
          ],
          [
            'Formato del sistema de diseño',
            'Un archivo DESIGN.md por marca, con tokens y componentes opcionales',
            'Bibliotecas y componentes dentro del archivo de diseño',
            'Bibliotecas, estilos y componentes dentro del archivo de diseño',
            'Propietario',
          ],
          [
            'Extensibilidad',
            'Skills, plantillas de diseño, sistemas de diseño y plugins como carpetas planas',
            'Plugins y API',
            'Plugins y API',
            'Cerrada',
          ],
          [
            'Traspaso a código',
            'El artefacto ya es código web',
            'Inspeccionar y reconstruir en código',
            'Inspeccionar y reconstruir en código',
            'Exportar desde el producto',
          ],
        ],
      },
      subsections: [
        {
          heading: 'Formato de salida y trabajo repetido',
          paragraphs: [
            'Un archivo de lienzo exige reconstruirlo en código. Una página HTML generada exige revisarla y portarla a tu framework. Ambas cosas cuestan tiempo. Lo cuestan en sitios distintos.',
          ],
        },
        {
          heading: 'Soporte de agentes',
          paragraphs: [
            'OpenDesign no incluye un agente. Usa la CLI que ya instalaste. Tu equipo puede cambiar de agente sin cambiar de herramienta de diseño. También incluye un servidor MCP, de modo que un agente en otro repositorio puede leer los archivos vivos del proyecto.',
          ],
        },
      ],
    },
    {
      heading: 'Dónde encaja OpenDesign',
      paragraphs: [
        'OpenDesign es una alternativa de código abierto a Claude Design. Mantiene el mismo bucle: descubrir el briefing, fijar la dirección, generar el artefacto, criticar y entregar. Quita la dependencia del proveedor. Tú eliges el agente, conservas los archivos y puedes alojarlo tú.',
        'También es un complemento nativo de código para las herramientas de lienzo. Un equipo puede mantener Figma o Penpot para el trabajo visual detallado y usar OpenDesign para prototipos ejecutables, presentaciones y paneles. No te pedimos que abandones tu herramienta de lienzo.',
      ],
      subsections: [
        {
          heading: 'Como alternativa a Claude Design',
          bullets: [
            'Código abierto con licencia Apache 2.0.',
            'Funciona con muchas CLI de agentes de código, no con una sola familia de modelos.',
            'Se ejecuta como app de escritorio para macOS y Windows, y con Docker como otra vía.',
            'Lee un archivo de marca DESIGN.md en cada render.',
          ],
        },
        {
          heading: 'Como complemento de Figma y Penpot',
          bullets: [
            'Genera en minutos un primer prototipo funcional a partir de un briefing y afina los detalles en el lienzo.',
            'Usa plugins específicos para migrar trabajo de Figma o Pencil a código React, Next.js o Vue.',
            'Exporta presentaciones a PPTX y PDF sin redibujar diapositivas.',
          ],
        },
      ],
    },
    {
      heading: 'Cuándo conviene otra herramienta',
      paragraphs: [
        'Ninguna herramienta encaja con todos los equipos. Estos son los casos en los que te enviaríamos a otro sitio.',
      ],
      subsections: [
        {
          heading: 'Elige Penpot si quieres un lienzo de código abierto',
          paragraphs: [
            'Si tu equipo de diseño trabaja a mano sobre un lienzo compartido y necesitas código abierto con autoalojamiento, Penpot es la opción natural. OpenDesign no es un lienzo. No sustituye la manipulación directa de formas vectoriales.',
          ],
        },
        {
          heading: 'Elige Figma si el ecosistema es lo importante',
          paragraphs: [
            'Si tu agencia, tus clientes y tus plugins ya viven en Figma, cambiar sale caro. Un SaaS propietario es un trato razonable si valoras su ecosistema y no necesitas autoalojamiento.',
          ],
        },
        {
          heading: 'Elige Claude Design si quieres un producto gestionado',
          paragraphs: [
            'Si quieres un producto alojado sin instalación, y aceptas el código cerrado y una sola familia de modelos, una herramienta gestionada es más simple. OpenDesign te pide configurar un entorno y un agente.',
          ],
        },
        {
          heading: 'Quédate con tu herramienta actual si funciona',
          paragraphs: [
            'Una herramienta que tu equipo usa bien vale más que una mejor que nadie aprende. Cambia cuando te empuje un problema concreto, como la residencia de datos, la dependencia del proveedor o un traspaso lento.',
          ],
        },
      ],
    },
    {
      heading: 'Un método breve para elegir',
      paragraphs: [
        'Usa este método para una decisión que dure una semana, no un trimestre.',
      ],
      steps: [
        'Apunta tus restricciones duras, como el autoalojamiento, la licencia o la ubicación de los datos.',
        'Descarta toda herramienta que incumpla una restricción dura.',
        'Elige un proyecto real de tu lista de pendientes, con un briefing real.',
        'Ejecuta ese proyecto en las dos o tres herramientas que queden.',
        'Compara el tiempo hasta un primer resultado revisable y el trabajo repetido antes del traspaso.',
        'Pregunta al ingeniero que recibe el trabajo qué salida prefiere.',
        'Decide y apunta el motivo para que el equipo lo recuerde.',
      ],
      subsections: [
        {
          heading: 'Mide el trabajo repetido, no las demos',
          paragraphs: [
            'Una demo muestra el mejor caso. Un briefing real muestra el caso medio. Cuenta cuántos mensajes o ediciones necesitas antes de que ingeniería pueda empezar.',
          ],
        },
        {
          heading: 'Planea la salida',
          paragraphs: [
            'Pregunta cómo se sale de la herramienta antes de entrar. Los archivos planos en tu disco son la salida más fácil. Comprueba que puedes abrir y mover tu trabajo sin el proveedor.',
          ],
        },
      ],
    },
    {
      heading: 'Adoptar una herramienta sin un cambio arriesgado',
      paragraphs: [
        'No hace falta mover a todo el equipo en un día. Empieza con un proyecto y un grupo pequeño.',
      ],
      bullets: [
        'Haz el piloto en un proyecto de poco riesgo, como una herramienta interna o una página de aterrizaje.',
        'Conserva tu herramienta de lienzo para el trabajo que la necesite.',
        'Pon tu marca en un archivo DESIGN.md para que el piloto se parezca a tu producto.',
        'Revisa el resultado con un ingeniero durante la primera semana.',
        'Escribe una nota de una página sobre lo que funcionó y lo que no.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Cuál es la mejor herramienta de diseño open source para un equipo de producto?',
      answer:
        'Depende de tu fuente de verdad. Penpot es una buena opción si quieres un lienzo de código abierto. OpenDesign es una buena opción si quieres que los agentes generen prototipos, presentaciones y paneles ejecutables a partir de briefings. Muchos equipos usan las dos.',
    },
    {
      question: '¿Es OpenDesign una alternativa open source a Claude Design?',
      answer:
        'Sí. OpenDesign sigue el mismo bucle de briefing, dirección, artefacto, crítica y entrega. Es de código abierto con licencia Apache 2.0, funciona con muchas CLI de agentes de código y se ejecuta en tu máquina o en tu servidor.',
    },
    {
      question: '¿Puede OpenDesign sustituir a Figma?',
      answer:
        'Puede sustituir parte del trabajo en Figma, como los primeros prototipos y las presentaciones, pero no es un lienzo. Genera HTML y CSS reales en lugar de formas sobre un marco. Los equipos que dibujan a mano seguirán queriendo una herramienta de lienzo a su lado.',
    },
    {
      question: '¿En qué se diferencia OpenDesign de Penpot?',
      answer:
        'Penpot es un lienzo de código abierto donde las personas dibujan diseños. OpenDesign es una herramienta nativa de agentes donde un agente de código escribe el diseño como archivos web. Las dos son de código abierto y las dos pueden funcionar en tu propia infraestructura.',
    },
    {
      question: '¿Puedo alojar yo mismo una herramienta de diseño open source?',
      answer:
        'Sí. Penpot y OpenDesign admiten el autoalojamiento. OpenDesign funciona como app de escritorio, con Docker o desde el código fuente. Consulta la documentación de cada proyecto para la instalación exacta.',
    },
    {
      question: '¿Qué herramienta de diseño funciona con agentes como Claude Code o Codex?',
      answer:
        'OpenDesign funciona con CLI de agentes de código locales, entre ellas Claude Code y Codex, y ofrece un proveedor con clave para equipos sin CLI. También incluye un servidor MCP para que agentes de otros repositorios lean los archivos del proyecto.',
    },
    {
      question: '¿Tengo que dejar mi sistema de diseño para probar OpenDesign?',
      answer:
        'No. Describes tu marca en un archivo DESIGN.md y el agente lo lee en cada render. Puedes crear el archivo a mano o dejar que el agente lo redacte a partir de una captura o una URL. Tu sistema actual en otra herramienta se queda como está.',
    },
  ],
  cta: {
    heading: 'Pruébalo con un briefing real',
    body: 'Descarga OpenDesign y ejecuta un proyecto de tu lista de pendientes. Es de código abierto, funciona en tu máquina y conservas todos los archivos. Si no encaja, pierdes una tarde.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el código en GitHub',
  },
};
