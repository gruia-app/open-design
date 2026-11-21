import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'collaborative-design-review',
  locale: 'es',
  slug: 'revision-de-diseno-colaborativa',
  title: 'Revisión de diseño colaborativa y crítica con OpenDesign',
  description:
    'Organiza revisiones y críticas de diseño con OpenDesign: un Jurado de Diseño de cinco roles, anotaciones, rúbricas, revisión asíncrona con git y lista de control.',
  ogTitle: 'Cómo hacer una revisión de diseño colaborativa con OpenDesign',
  ogDescription:
    'Guía práctica de crítica de diseño: roles, rúbricas, anotaciones, revisión asíncrona con git y una lista de control para convertir el feedback en la siguiente iteración.',
  keywords: [
    'revisión de diseño colaborativa',
    'crítica de diseño',
    'proceso de design review',
    'lista de control de revisión de diseño',
    'revisión de diseño asíncrona',
    'herramienta de diseño colaborativo open source',
    'rúbrica de crítica de diseño',
    'feedback de diseño en equipo',
  ],
  eyebrow: 'Guía',
  h1: 'Revisión de diseño colaborativa y crítica con OpenDesign',
  lede: 'Una revisión de diseño es una reunión corta con una cola larga de tareas. Esta guía ayuda a mantener ambas pequeñas y explica dónde ayuda OpenDesign.',
  intro: [
    'Casi todas las revisiones de diseño fallan igual. Cada persona llega con un objetivo distinto, da su opinión en un formato distinto y se va sin una lista clara de cambios. La siguiente versión ignora la mitad de lo que se dijo.',
    'OpenDesign es una herramienta de diseño de código abierto que trabaja con los agentes de programación que ya usas. Genera HTML, CSS y documentos reales a partir de un briefing. Eso cambia un poco la revisión. El resultado es un archivo, así que puedes abrirlo, anotarlo, compararlo y devolvérselo al agente.',
    'Esta guía cubre lo que OpenDesign ofrece hoy para revisar y lo que no ofrece. Somos claros con las carencias. Donde el producto no tiene función, la guía propone cubrir la necesidad con una rúbrica, un repositorio y unos pocos hábitos acordados.',
  ],
  sections: [
    {
      heading: 'Cómo es una buena revisión de diseño',
      paragraphs: [
        'Una buena revisión responde a una sola pregunta: ¿este trabajo cumple el briefing? No pregunta si el revisor lo habría diseñado de otra forma. La diferencia parece pequeña. Decide si la reunión termina en una lista de cambios o en una discusión.',
        'Mantén la revisión corta y concreta. Comparte primero el briefing. Comparte después el resultado. Recoge el feedback según criterios con nombre, no según gustos.',
      ],
      subsections: [
        {
          heading: 'Revisa el briefing antes que los píxeles',
          paragraphs: [
            'Empieza cada revisión leyendo el briefing en voz alta. El briefing fija la audiencia, el objetivo y las restricciones. Cada comentario debe conectar con uno de esos tres puntos.',
            'Si un comentario no conecta, aparca la idea. Anótala aparte para más adelante. Así la revisión se centra en el trabajo y la autora mantiene la calma.',
          ],
        },
        {
          heading: 'Separa la crítica de la aprobación',
          paragraphs: [
            'La crítica ayuda a mejorar el trabajo. La aprobación decide si el trabajo sale. Si las mezclas, la gente se calla las notas sinceras, porque cada nota suena a veto.',
            'Haz primero la crítica, sin decisión asociada. Después pide a una persona, nombrada de antemano, que apruebe o pida cambios.',
          ],
        },
      ],
    },
    {
      heading: 'Roles en una revisión',
      paragraphs: [
        'Una revisión funciona mejor cuando cada persona conoce su papel. En equipos pequeños, una persona puede asumir varios roles. Nómbralos igualmente.',
      ],
      bullets: [
        'Autoría: presenta el trabajo, explica las decisiones y anota el feedback sin defenderse.',
        'Facilitación: controla el tiempo, lee el briefing y corta las conversaciones paralelas.',
        'Revisión: da feedback según los criterios acordados, un punto cada vez.',
        'Decisión: aprueba el trabajo o pide cambios al final.',
        'Ingeniería de guardia: avisa pronto de lo que cuesta construir, antes de que el diseño se endurezca.',
      ],
      subsections: [
        {
          heading: 'Deja que el agente revise, no que decida',
          paragraphs: [
            'OpenDesign incluye un panel llamado Jurado de Diseño (Design Jury). Revisa cada generación antes de que salga. Es un buen primer lector. No es quien decide.',
            'Trata su puntuación como una opinión más. Tu equipo sigue decidiendo qué significa terminado.',
          ],
        },
        {
          heading: 'Invita a menos gente de la que crees',
          paragraphs: [
            'Entre tres y cinco revisores cubren casi todo el trabajo. Más voces traen más notas contradictorias y pocas ideas nuevas. Invita a especialistas solo cuando el resultado lo pida, por ejemplo una persona de accesibilidad para un flujo de formularios.',
          ],
        },
      ],
    },
    {
      heading: 'El bucle de crítica integrado: Jurado de Diseño',
      paragraphs: [
        'Cuando un agente produce un resultado, OpenDesign puede envolverlo en un ciclo de revisión estructurado. El producto lo llama Design Jury. En el código y en la documentación se llama Critique Theater.',
        'Cinco panelistas puntúan el resultado: Designer, Critic, Brand, Accessibility y Copy. Actúan como turnos dentro de la misma sesión del agente. OpenDesign no lanza procesos adicionales para ellos.',
      ],
      subsections: [
        {
          heading: 'Cómo funcionan las rondas',
          paragraphs: [
            'La ejecución tiene hasta tres rondas por defecto. Tras cada ronda, OpenDesign calcula una puntuación compuesta con las notas de los panelistas. Si la compuesta llega a 8,0 sobre 10, el resultado sale. Si no, el agente lo revisa y empieza otra ronda.',
            'Si tres rondas no alcanzan el umbral, la política por defecto entrega la mejor ronda. La insignia final indica entonces que terminó por debajo del umbral. Ves ese dato. Nada lo esconde.',
          ],
          bullets: [
            'Critic pesa 0,4 en la puntuación compuesta.',
            'Brand, Accessibility y Copy pesan 0,2 cada uno.',
            'Designer pesa cero en la versión uno. Sus notas siguen apareciendo en la transcripción.',
            'El umbral y los pesos son de solo lectura en la versión actual.',
          ],
        },
        {
          heading: 'Cómo leer el resultado',
          paragraphs: [
            'Cuando termina la ejecución, el panel se pliega en una insignia. La insignia muestra la puntuación compuesta final y la ronda que cerró la ejecución. También muestra un estado: entregado, bajo el umbral, tiempo agotado, interrumpido o degradado.',
            'Degradado significa que el panel estuvo fuera de servicio en esa ejecución, por ejemplo porque el adaptador del agente no pudo producir una crítica válida. No tomes una ejecución degradada por una aprobación.',
          ],
        },
        {
          heading: 'Reproduce una revisión anterior',
          paragraphs: [
            'Cada ejecución guarda una transcripción estructurada. El botón Replay la reproduce en una vista de solo lectura. Puedes avanzar ronda a ronda con las teclas J y K y salir con Escape.',
            'La reproducción ayuda en una revisión de equipo. La persona que facilita puede enseñar lo que dijo el panel sin volver a generar el diseño.',
          ],
        },
        {
          heading: 'Actívalo en los proyectos adecuados',
          paragraphs: [
            'El panel es un ajuste, no una garantía. Una skill puede exigirlo, permitirlo o desactivarlo. También puedes activarlo por proyecto en Ajustes, en la sección Design Jury. Las skills que producen una exportación fija suelen desactivarlo.',
            'Comprueba el ajuste antes de fiarte. Si el panel está apagado, no aparece puntuación, y es fácil no darse cuenta.',
          ],
        },
      ],
    },
    {
      heading: 'Comentarios y anotaciones sobre la vista previa',
      paragraphs: [
        'El feedback humano supera al del panel en gusto, contexto y política interna. OpenDesign te da una forma de señalar lo que quieres decir.',
        'El campo de chat acepta anotaciones visuales dibujadas sobre la vista previa. Viajan con tu mensaje como adjuntos, así que el agente ve qué parte de la página marcaste.',
      ],
      subsections: [
        {
          heading: 'Qué funciona hoy y qué es parcial',
          paragraphs: [
            'La hoja de ruta del proyecto marca como parcialmente entregadas las ediciones quirúrgicas en modo comentario. El parcheo dirigido de un solo elemento sigue en desarrollo. En algunos casos, el agente regenerará más que el elemento que marcaste.',
            'Cuenta con ello. Tras cada cambio dirigido, revisa de nuevo toda la página. No des por hecho que el resto quedó igual.',
          ],
        },
        {
          heading: 'Escribe anotaciones que un agente pueda ejecutar',
          bullets: [
            'Di qué falla y qué quieres en su lugar, en una frase.',
            'Nombra el criterio, por ejemplo contraste, espaciado o tono.',
            'Marca un problema por anotación.',
            'Evita palabras como más bonito o más limpio. Pide un cambio medible.',
          ],
        },
      ],
    },
    {
      heading: 'Una rúbrica que todo el equipo pueda reutilizar',
      paragraphs: [
        'Una rúbrica convierte la opinión en una lista de control. El Jurado de Diseño usa cinco lentes. Puedes tomar esas mismas cinco para la revisión humana y añadir las tuyas.',
        'Puntúa cada criterio de uno a cinco, o usa apto y no apto. Mantén la misma escala en todas las revisiones, para poder comparar resultados con el tiempo.',
      ],
      table: {
        caption: 'Rúbrica de revisión basada en las cinco lentes del Jurado de Diseño',
        columns: ['Lente', 'Pregunta', 'Evidencia que comprobar'],
        rows: [
          [
            'Diseño',
            '¿La composición, la jerarquía y el espaciado guían la vista?',
            'Prueba de entrecerrar los ojos, alineación a la rejilla, peso visual de la acción principal',
          ],
          [
            'Ajuste al briefing',
            '¿El trabajo cumple la audiencia y el objetivo del briefing?',
            'Lista del briefing, tarea principal completada en menos de un minuto',
          ],
          [
            'Marca',
            '¿El color, la tipografía y la voz encajan con el sistema de diseño?',
            'Uso de tokens frente al archivo DESIGN.md, ningún color fuera de la paleta',
          ],
          [
            'Accesibilidad',
            '¿Pueden usarlo personas con capacidades distintas?',
            'Ratios de contraste, anillos de foco, orden de los encabezados, texto alternativo',
          ],
          [
            'Texto',
            '¿El texto es breve, claro y con el tono adecuado?',
            'Lectura en voz alta, los mensajes de error dicen qué hacer después',
          ],
        ],
      },
    },
    {
      heading: 'Revisión asíncrona con git y pull requests',
      paragraphs: [
        'No toda revisión necesita una reunión. La revisión asíncrona funciona bien en equipos distribuidos y para cambios pequeños. OpenDesign no aloja revisiones por sí mismo, así que esta parte usa herramientas que ya tienes.',
        'La razón es sencilla. OpenDesign produce archivos normales, y los archivos normales caben en git. Esta guía no afirma que exista una función de pull request integrada. Describe un hábito.',
      ],
      subsections: [
        {
          heading: 'Un flujo asíncrono sencillo',
          steps: [
            'Genera o revisa el resultado en OpenDesign y exporta o copia los archivos a un repositorio que controles.',
            'Abre una rama y una pull request. Pon el briefing y la rúbrica en la descripción.',
            'Adjunta capturas o una grabación corta de pantalla para que nadie tenga que ejecutar nada.',
            'Pide a cada revisor que comente según las lentes de la rúbrica, un comentario por problema.',
            'Deja que la persona que decide apruebe o pida cambios dentro de un plazo fijado, por ejemplo dos días laborables.',
            'Fusiona cuando la lista esté completa y enlaza la versión final con el briefing original.',
          ],
        },
        {
          heading: 'Por qué un diff ayuda en la revisión de diseño',
          paragraphs: [
            'Un diff muestra qué cambió entre dos iteraciones. Los revisores dejan de releer la página entera. Comprueban solo lo que se movió.',
            'Esto importa sobre todo cuando un agente regenera más de lo que pediste. El diff detecta la sorpresa antes de que salga.',
          ],
        },
        {
          heading: 'Guarda el briefing junto al trabajo',
          paragraphs: [
            'Guarda el briefing en el mismo repositorio, en texto plano. Los revisores leen así el briefing y el resultado en un solo sitio. Tu yo del futuro te lo agradecerá.',
          ],
        },
      ],
    },
    {
      heading: 'Convertir el feedback en la siguiente iteración',
      paragraphs: [
        'El feedback no vale nada hasta que cambia el trabajo. El paso entre una cosa y otra es donde casi todos los equipos pierden tiempo.',
      ],
      subsections: [
        {
          heading: 'Clasifica las notas',
          paragraphs: [
            'Ordena cada nota en tres grupos: imprescindible, recomendable y más adelante. Lo imprescindible bloquea la aprobación. Lo recomendable entra si es barato. Lo posterior va a un backlog con un responsable.',
            'El Jurado de Diseño usa la misma idea. El panel lleva la cuenta acumulada de elementos imprescindibles entre rondas, así que una lista clara también es una forma familiar para el agente.',
          ],
        },
        {
          heading: 'Escribe un único briefing de revisión',
          steps: [
            'Enumera lo imprescindible por orden de impacto.',
            'Redacta cada punto como una instrucción: qué cambiar, dónde y cómo comprobarlo.',
            'Añade lo que no debe cambiar, por ejemplo la navegación y los colores de marca.',
            'Envía la lista al agente en un solo mensaje, con las anotaciones adjuntas.',
            'Revisa la nueva versión con la misma rúbrica, no con otra nueva.',
          ],
        },
        {
          heading: 'Cierra el círculo',
          paragraphs: [
            'Cuéntales a los revisores qué cambiaste y qué aparcaste. Basta una respuesta corta. La gente da mejor feedback la próxima vez cuando ve que la ronda anterior contó.',
          ],
        },
      ],
    },
    {
      heading: 'Lista de control de la revisión de diseño',
      paragraphs: [
        'Usa esta tabla antes, durante y después de cada revisión. Cópiala en la plantilla de tus pull requests o en tu wiki.',
      ],
      table: {
        caption: 'Lista de control para una revisión de diseño colaborativa',
        columns: ['Fase', 'Comprobación', 'Responsable'],
        rows: [
          ['Antes', 'El briefing indica audiencia, objetivo y restricciones', 'Autoría'],
          ['Antes', 'El resultado se abre sin configuración y lleva capturas adjuntas', 'Autoría'],
          ['Antes', 'El Jurado de Diseño estaba activo en el proyecto y se leyó su resultado', 'Autoría'],
          ['Durante', 'La facilitación lee primero el briefing', 'Facilitación'],
          ['Durante', 'Cada comentario nombra una lente de la rúbrica', 'Revisión'],
          ['Durante', 'La crítica y la aprobación son pasos separados', 'Facilitación'],
          ['Después', 'Las notas se clasifican en imprescindible, recomendable y más adelante', 'Autoría'],
          ['Después', 'Un único briefing de revisión llega al agente', 'Autoría'],
          ['Después', 'Quien decide registra aprobado o cambios solicitados', 'Decisión'],
        ],
      },
    },
    {
      heading: 'Errores habituales',
      bullets: [
        'Revisar sin el briefing, de modo que el feedback deriva hacia el gusto personal.',
        'Tomar la puntuación del panel como aprobación. Es una aportación más.',
        'Enviar el feedback en diez mensajes sueltos en lugar de un briefing de revisión.',
        'Olvidar que una edición dirigida puede tocar más que el elemento marcado.',
        'Saltarse la segunda revisión porque el cambio parecía pequeño.',
      ],
    },
  ],
  faq: [
    {
      question: '¿Qué es una revisión de diseño colaborativa?',
      answer:
        'Es una sesión estructurada en la que varias personas juzgan un diseño según un briefing compartido. El objetivo es una lista clara de cambios y una decisión con nombre. Las buenas revisiones usan criterios acordados, roles definidos y resultados por escrito.',
    },
    {
      question: '¿OpenDesign tiene una función de crítica de diseño integrada?',
      answer:
        'Sí. Un panel llamado Design Jury revisa cada generación antes de que salga. Cinco panelistas puntúan el resultado en hasta tres rondas. Puedes activarlo por proyecto en Ajustes, y una skill puede exigirlo o desactivarlo.',
    },
    {
      question: '¿Pueden los revisores comentar directamente sobre el diseño?',
      answer:
        'Puedes dibujar anotaciones visuales sobre la vista previa y enviarlas con tu mensaje al agente. El proyecto marca como parciales las ediciones quirúrgicas en modo comentario. Esta guía no afirma que existan hilos de comentarios para varias personas.',
    },
    {
      question: '¿Cómo hago una revisión de diseño asíncrona con OpenDesign?',
      answer:
        'Guarda los archivos generados en un repositorio git y abre una pull request. Añade el briefing, la rúbrica y capturas a la descripción. Los revisores comentan según la rúbrica y una persona decisora aprueba dentro de un plazo acordado.',
    },
    {
      question: '¿Qué puntuación necesita el Jurado de Diseño para aprobar un diseño?',
      answer:
        'La puntuación compuesta debe llegar a 8,0 sobre 10. Si no llega tras tres rondas, la política por defecto entrega la mejor ronda y la insignia indica que quedó por debajo del umbral. El umbral es de solo lectura en la versión actual.',
    },
    {
      question: '¿Quién debería participar en una revisión de diseño?',
      answer:
        'Reúne a una persona autora, una facilitadora, de tres a cinco revisores y una persona decisora. Añade pronto a alguien de ingeniería para avisar del coste. Invita a un especialista, como accesibilidad, solo cuando el trabajo lo necesite.',
    },
    {
      question: '¿Cómo convierto el feedback en la siguiente iteración?',
      answer:
        'Clasifica las notas en imprescindible, recomendable y más adelante. Redacta lo imprescindible como un único briefing de revisión con instrucciones y restricciones. Envíalo al agente con las anotaciones adjuntas y revisa el resultado con la misma rúbrica.',
    },
  ],
  cta: {
    heading: 'Prueba un bucle de revisión con tu próximo borrador',
    body: 'OpenDesign es de código abierto. Instala la aplicación de escritorio, genera un primer borrador y activa el Jurado de Diseño en el proyecto. Lleva unos minutos, más o menos lo que dura un café.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el repositorio en GitHub',
  },
};
