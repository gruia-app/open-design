import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'design-systems-as-code',
  locale: 'es',
  slug: 'sistemas-de-diseno-como-codigo',
  title: 'Sistemas de diseño como código: tu marca en DESIGN.md',
  description:
    'Escribe tu sistema de diseño como un archivo DESIGN.md con tokens, guárdalo en git, revísalo como código y deja que los agentes de IA lo sigan. Guía para OpenDesign.',
  ogTitle: 'Sistemas de diseño como código: una marca en un DESIGN.md',
  ogDescription:
    'Cómo estructurar un sistema de diseño en DESIGN.md, enlazar tokens en CSS, versionarlo en git y migrar desde una guía de estilo estática, con OpenDesign.',
  keywords: [
    'sistema de diseño como código',
    'DESIGN.md',
    'design tokens CSS',
    'sistema de diseño para agentes de IA',
    'versionar sistema de diseño en git',
    'guía de marca a sistema de diseño',
    'guía de estilo a sistema de diseño',
    'sistema de diseño open source',
  ],
  eyebrow: 'Guía',
  h1: 'Sistemas de diseño como código con DESIGN.md',
  lede:
    'Una guía de estilo estática explica una marca a una persona. Un paquete DESIGN.md la explica a una persona y a un agente, y git la mantiene al día.',
  intro: [
    'La mayoría de las guías de marca viven en un PDF o en una presentación. Se leen una vez y después los valores se copian a mano. Un agente de IA saca poco de un PDF lleno de capturas, y una herramienta de compilación todavía menos.',
    'OpenDesign guarda un sistema de diseño como un paquete pequeño de archivos. El archivo principal es DESIGN.md, que explica la marca en texto claro. Un archivo tokens.css recoge las mismas decisiones como propiedades personalizadas de CSS. Un manifiesto describe el paquete. El agente lee estos archivos cada vez que un proyecto usa el sistema.',
    'Esta guía muestra cómo se construyen esos paquetes, cómo los consumen los agentes y cómo un equipo los versiona, los revisa y los migra. Nos ceñimos a lo que documenta el repositorio. Donde no estamos seguros, lo decimos.',
  ],
  sections: [
    {
      heading: 'Qué contiene un paquete de sistema de diseño',
      paragraphs: [
        'En OpenDesign, un sistema de diseño es un paquete, no un único archivo Markdown. El repositorio documenta una forma mínima de tres archivos en una carpeta. El nombre de la carpeta es un identificador corto en minúsculas.',
      ],
      bullets: [
        'manifest.json contiene los metadatos de descubrimiento: el id, el nombre, la categoría, una descripción breve y el origen del paquete.',
        'DESIGN.md contiene la prosa de diseño canónica para los agentes.',
        'tokens.css contiene las propiedades personalizadas de CSS ya compiladas.',
      ],
      subsections: [
        {
          heading: 'Los tres archivos obligatorios',
          table: {
            caption: 'Archivos mínimos de un paquete de sistema de diseño',
            columns: ['Archivo', 'Quién lo lee', 'Para qué sirve'],
            rows: [
              ['manifest.json', 'La aplicación y las comprobaciones', 'Lista el id, el nombre, la categoría, la descripción, el origen y los archivos declarados'],
              ['DESIGN.md', 'Personas y agentes', 'Explica intención, roles, reglas y antipatrones en texto'],
              ['tokens.css', 'Agentes y herramientas de compilación', 'Enlaza las mismas decisiones a variables CSS'],
            ],
          },
        },
        {
          heading: 'Archivos opcionales para un paquete más completo',
          paragraphs: [
            'Un paquete puede declarar más archivos. Dan más material al agente y dan algo que ejecutar a quien revisa.',
          ],
          bullets: [
            'USAGE.md: una guía breve para el agente con orden de lectura, puntos clave, qué hacer y qué evitar.',
            'components.html: una página independiente que muestra componentes reales construidos con los tokens.',
            'components.manifest.json, design-tokens.json y tailwind-v4.css: archivos derivados que se regeneran desde las fuentes.',
            'Páginas de vista previa de color, tipografía y espaciado.',
            'Recursos y fuentes para logotipos y tipografías web.',
            'Archivos de origen con la evidencia del importador, cuando el paquete viene de un sitio web o de un repositorio.',
          ],
        },
        {
          heading: 'Las carpetas antiguas siguen funcionando',
          paragraphs: [
            'El daemon todavía encuentra carpetas que solo contienen un archivo DESIGN.md. Esa vía existe para contenido antiguo o instalado por el usuario. Para trabajo nuevo, escribe el paquete completo.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo escribir DESIGN.md',
      paragraphs: [
        'DESIGN.md explica al agente la intención, las decisiones y el uso. No es una plantilla fija con secciones numeradas. La comprobación del repositorio pide al menos siete encabezados con contenido real en un paquete migrado, y no impone títulos ni orden.',
        'Usa encabezados que describan tu sistema real. Evita encabezados vacíos añadidos solo para llegar a una cifra.',
      ],
      subsections: [
        {
          heading: 'Temas que cubren casi todos los sistemas',
          bullets: [
            'Tema visual y atmósfera: la sensación general en pocas frases.',
            'Roles de color e intención de contraste: para qué sirve cada color, no solo su valor.',
            'Tipografía: familias, escala, interlineado y espaciado de letras.',
            'Espaciado, rejilla y composición.',
            'Componentes y estados de interacción.',
            'Comportamiento del movimiento y gestión de movimiento reducido.',
            'Requisitos de accesibilidad.',
            'Antipatrones concretos: lo que el agente nunca debe hacer.',
          ],
        },
        {
          heading: 'Escribe por roles, no por muestras de color',
          paragraphs: [
            'Una lista de valores hexadecimales dice muy poco a un agente. Un rol le dice cuándo usar el valor. Escribe que el color de acento marca la acción principal y que el texto de cuerpo usa el color de texto secundario. Así el agente toma buenas decisiones en páginas que nunca describiste.',
            'Los ejemplos incluidos, como design-systems/linear-app/DESIGN.md, siguen este patrón. Nombran cada color, explican su función y enumeran los rasgos que hacen reconocible la marca.',
          ],
        },
        {
          heading: 'Añade el origen',
          paragraphs: [
            'Si el sistema viene de un sitio web o de una guía de estilo, dilo en el archivo. Una nota breve sobre la fuente ayuda a quien revisa a decidir cuánto fiarse de un valor y cuándo refrescarlo.',
          ],
        },
      ],
    },
    {
      heading: 'Tokens: convertir texto en variables CSS',
      paragraphs: [
        'tokens.css es la hoja de estilos de tokens ya compilada. Permite al agente usar valores exactos sin traducir texto. Las declaraciones compartidas van en un bloque raíz.',
        'El contrato de tokens vive en el paquete de contratos y se reexporta en la carpeta de esquemas de design-systems. La comprobación del repositorio revisa los huecos compartidos obligatorios, la paridad de valores por defecto y una lista permitida para tokens extra. Un tokens.css final debe contener todos los huecos obligatorios. Las extensiones propias de una marca siguen la lista permitida documentada.',
      ],
      subsections: [
        {
          heading: 'Usa nombres semánticos',
          paragraphs: [
            'El CSS de los componentes debe usar variables semánticas, como fondo, primer plano y acento, en lugar de colores sueltos. Así, un cambio de tema toca los tokens y nada más.',
            'Cuando un sistema tiene variante oscura, sobrescribe los tokens semánticos bajo un selector de tema. No copies reglas enteras de componentes en un segundo bloque.',
          ],
        },
        {
          heading: 'Mantén sincronizados texto y tokens',
          paragraphs: [
            'Si DESIGN.md nombra un acento, una escala tipográfica, un ritmo de espaciado o una duración de movimiento, tokens.css debe expresar la misma decisión. Los dos archivos describen un solo sistema. Si se contradicen, el agente recibe señales mezcladas.',
          ],
          table: {
            caption: 'Qué editar cuando cambia una decisión',
            columns: ['Decisión', 'Editar en DESIGN.md', 'Editar en tokens.css'],
            rows: [
              ['Nuevo color de acento', 'Actualiza la sección de roles de color', 'Cambia las variables de acento'],
              ['Nueva fuente de texto', 'Actualiza la sección de tipografía', 'Cambia las variables de fuente'],
              ['Espaciado más ajustado', 'Actualiza la sección de espaciado', 'Cambia las variables de espaciado'],
              ['Movimiento más corto', 'Actualiza la sección de movimiento', 'Cambia las variables de duración'],
            ],
          },
        },
        {
          heading: 'Formatos derivados',
          paragraphs: [
            'Un paquete puede incluir Design Tokens en JSON y una correspondencia con Tailwind v4. La documentación los trata como cachés derivadas de tokens.css. Regenéralas. No las edites a mano, porque competirían con la fuente de verdad.',
          ],
        },
      ],
    },
    {
      heading: 'Cómo consumen los agentes un sistema de diseño',
      paragraphs: [
        'No pegas el sistema de diseño en un prompt. Cuando una skill se acoge al sistema de diseño activo, el daemon compone el paquete dentro del prompt de sistema de la ejecución.',
      ],
      subsections: [
        {
          heading: 'El orden del contexto',
          paragraphs: [
            'El protocolo de skills documenta el orden en que el material entra en el prompt.',
          ],
          steps: [
            'La guía del paquete en USAGE.md, o un contrato de uso por defecto.',
            'El cuerpo completo de DESIGN.md.',
            'La guía del modo de importación, cuando el paquete declara una.',
            'El archivo tokens.css.',
            'Un manifiesto compacto de componentes, o components.html si no existe manifiesto.',
            'Un índice de archivos ricos que el agente puede consultar bajo demanda.',
            'Las referencias de oficio que pidió la skill.',
            'El cuerpo de la skill o de la plantilla activa.',
          ],
        },
        {
          heading: 'Las reglas de oficio van junto a la marca',
          paragraphs: [
            'El repositorio mantiene también una carpeta craft con reglas universales que valen para cualquier marca, como disciplina tipográfica y de color. Cada skill elige las que necesita. DESIGN.md dice al agente lo que es cierto para tu marca. Craft le dice lo que es cierto para una buena interfaz en general.',
          ],
        },
        {
          heading: 'Las skills de medios pueden saltárselo',
          paragraphs: [
            'Las skills de interfaz, presentaciones y plantillas suelen usar el sistema de diseño. Las skills de medios suelen no usarlo. Cada skill declara su elección en su propia cabecera.',
          ],
        },
      ],
    },
    {
      heading: 'Versiones, revisión y responsables en git',
      paragraphs: [
        'Como un paquete es una carpeta de archivos de texto, git te da historial, ramas y revisión sin esfuerzo extra. Es la razón principal para tratar un sistema de diseño como código.',
      ],
      bullets: [
        'Cada cambio de regla es un commit con autor y mensaje.',
        'Una pull request muestra a la vez el diff de DESIGN.md y el de tokens.css.',
        'Una etiqueta marca una versión del sistema que un producto puede fijar.',
        'Deshacer un cambio es un solo comando si algo sale mal.',
        'Blame muestra quién decidió una regla y cuándo.',
      ],
      subsections: [
        {
          heading: 'Una lista de revisión',
          table: {
            caption: 'Lista de comprobación para una pull request de un sistema de diseño',
            columns: ['Comprobación', 'Pregunta', 'Evidencia'],
            rows: [
              ['Slug e id', '¿Coinciden el nombre de la carpeta y el id del manifiesto?', 'manifest.json'],
              ['Archivos presentes', '¿Existe cada ruta declarada?', 'Carpeta del paquete'],
              ['Profundidad del texto', '¿Tiene DESIGN.md al menos siete secciones con contenido real?', 'Encabezados de DESIGN.md'],
              ['Paridad de tokens', '¿Coinciden los tokens con el texto?', 'tokens.css y DESIGN.md'],
              ['Ejemplos', '¿Usan los componentes tokens declarados y muestran el foco?', 'components.html'],
              ['Accesibilidad', '¿Cumplen los pares de texto los objetivos de contraste?', 'Páginas de vista previa'],
              ['Comprobaciones del repositorio', '¿Pasan guard y typecheck en el repositorio?', 'Resultado de la integración continua'],
            ],
          },
        },
        {
          heading: 'Nombra a una persona responsable',
          paragraphs: [
            'Asigna una persona responsable a cada sistema. Esa persona aprueba los cambios y mantiene la coherencia del paquete. En un equipo pequeño, puede asumir el papel el responsable de diseño.',
          ],
        },
        {
          heading: 'Comprobaciones de accesibilidad para la revisión',
          bullets: [
            'El texto normal cumple una relación de contraste de 4,5 a 1 sobre su fondo real.',
            'El texto grande cumple una relación de 3 a 1.',
            'Todo control interactivo tiene un estilo de foco visible.',
            'Los ajustes de movimiento reducido se aplican solo a los elementos que se animan.',
          ],
        },
      ],
    },
    {
      heading: 'Crear un sistema de diseño a partir de referencias de marca',
      paragraphs: [
        'Rara vez empiezas de cero. Una marca suele existir ya como sitio web, logotipo y unas cuantas capturas. OpenDesign puede ayudarte a convertir esas referencias en un primer borrador.',
      ],
      steps: [
        'Reúne las referencias: la dirección del sitio web, los archivos del logotipo, las fuentes y cualquier guía existente.',
        'Abre el área de Sistema de diseño en la aplicación y empieza un sistema nuevo a partir de tus referencias.',
        'Deja que el agente inspeccione el sitio. El repositorio incluye una skill brand-extract que maneja el navegador de la aplicación para extraer colores, fuentes y logotipo de un sitio activo.',
        'Lee el DESIGN.md generado. Corrige los roles y borra lo que no encaje con tu marca.',
        'Compara tokens.css con el texto y corrige cualquier diferencia.',
        'Abre las páginas de vista previa de color, tipografía y espaciado y comprueba el contraste.',
        'Sube el paquete a tu repositorio y abre una pull request para revisarlo.',
      ],
      subsections: [
        {
          heading: 'Orígenes que admite el repositorio',
          paragraphs: [
            'El manifiesto registra de dónde viene un paquete. Los tipos de origen documentados son incluido, local, GitHub y shadcn. Así, quien revisa ve el origen de cada sistema.',
          ],
        },
        {
          heading: 'Trata el borrador como borrador',
          paragraphs: [
            'Un sistema extraído captura lo que un sitio muestra hoy. No captura la intención. Una persona debe añadir las reglas sobre cuándo usar cada valor y qué evitar. Esa parte el agente no puede adivinarla.',
          ],
        },
      ],
    },
    {
      heading: 'Migrar desde una guía de estilo estática',
      paragraphs: [
        'Una migración no tiene por qué ser un gran proyecto. Mueve primero las reglas que más importan y conserva la guía antigua hasta que el paquete nuevo cubra lo mismo.',
      ],
      subsections: [
        {
          heading: 'Un plan por etapas',
          steps: [
            'Haz un inventario de la guía antigua y lista colores, tipografía, espaciado, componentes y tono.',
            'Crea la carpeta del paquete con un manifiesto, un archivo DESIGN.md y un archivo tokens.css.',
            'Mueve primero las reglas de color y tipografía, como roles con su motivo.',
            'Enlaza cada decisión a un token y comprueba que texto y tokens coinciden.',
            'Añade antipatrones sacados de comentarios de revisión reales.',
            'Ejecuta un briefing real con el sistema nuevo y compara el artefacto con tus páginas actuales.',
            'Corrige los huecos y después retira la guía antigua o enlázala al paquete.',
          ],
        },
        {
          heading: 'Qué cambia para el equipo',
          table: {
            caption: 'Guía de estilo estática frente a un paquete DESIGN.md',
            columns: ['Aspecto', 'Guía de estilo estática', 'Paquete DESIGN.md'],
            rows: [
              ['Formato', 'PDF, presentación o página web', 'Archivos de texto en una carpeta'],
              ['Quién lee', 'Personas', 'Personas, agentes y herramientas de compilación'],
              ['Historial', 'Nombres de archivo y memoria', 'Commits y etiquetas de git'],
              ['Revisión', 'Reuniones y comentarios', 'Pull requests'],
              ['Valores', 'Se copian a mano', 'Se enlazan como variables CSS'],
              ['Desviaciones', 'Se descubren por casualidad', 'Se ven en un diff'],
            ],
          },
        },
        {
          heading: 'Qué no cambia',
          paragraphs: [
            'El criterio sigue importando. Un paquete no sustituye a un responsable de diseño. Solo hace que sus decisiones sean legibles, repetibles y fáciles de revisar.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: '¿Qué es un archivo DESIGN.md?',
      answer:
        'DESIGN.md es un archivo Markdown que explica en texto el sistema de diseño de una marca: tema, roles de color, tipografía, espaciado, componentes, movimiento y antipatrones. En OpenDesign, los agentes lo leen como parte del prompt. Va junto a un archivo tokens.css y un manifiesto en una carpeta de paquete.',
    },
    {
      question: '¿Qué significa tener un sistema de diseño como código?',
      answer:
        'Significa que las reglas de diseño viven en archivos de texto que las herramientas pueden leer, en lugar de en un PDF. Las versionas en git, las revisas con pull requests y enlazas los valores a variables CSS. Así personas y agentes de IA trabajan desde la misma fuente.',
    },
    {
      question: '¿Cómo usan los agentes de IA un archivo DESIGN.md?',
      answer:
        'Cuando una skill se acoge, el daemon añade el paquete al prompt de sistema. Envía la guía de uso, el cuerpo de DESIGN.md, los tokens y un índice de componentes antes de las instrucciones de la skill. El agente sigue entonces tus colores, tu tipografía y tus reglas.',
    },
    {
      question: '¿Necesito tokens.css además de DESIGN.md?',
      answer:
        'En un paquete nuevo, sí. DESIGN.md recoge la intención y tokens.css recoge valores exactos que el agente puede usar tal cual. Una carpeta solo con DESIGN.md sigue funcionando como formato antiguo, pero el repositorio no la recomienda para contenido nuevo.',
    },
    {
      question: '¿Cómo versiono un sistema de diseño en git?',
      answer:
        'Guarda la carpeta del paquete en un repositorio. Cambia DESIGN.md y tokens.css en el mismo commit, revísalos en una pull request y etiqueta las versiones estables. Los productos pueden fijar una etiqueta y actualizar cuando quieran.',
    },
    {
      question: '¿Puedo crear un sistema de diseño a partir de un sitio web existente?',
      answer:
        'Sí, como punto de partida. El área de Sistema de diseño y la skill brand-extract pueden leer colores, fuentes y logotipo de un sitio activo. Revisa el borrador y añade las reglas de uso, porque un sitio web muestra valores pero no intención.',
    },
    {
      question: '¿En qué se diferencia de usar solo design tokens?',
      answer:
        'Los tokens dan valores exactos, pero no explican cuándo usarlos. DESIGN.md añade roles, reglas y antipatrones. Juntos dan al agente los números y también el razonamiento.',
    },
    {
      question: '¿Puedo usar los sistemas de diseño incluidos como base?',
      answer:
        'Sí. El repositorio incluye un catálogo amplio de sistemas de diseño, más de cien, en la carpeta design-systems. Lee unos cuantos para ver cómo están escritos, copia el más cercano y adáptalo a tu marca. Comprueba el origen y la licencia de cualquier sistema que reutilices.',
    },
  ],
  cta: {
    heading: 'Convierte tu guía de estilo en un paquete',
    body:
      'Descarga la aplicación, abre el área de Sistema de diseño y parte de un ejemplo incluido o de tu propio sitio web. El primer borrador tarda minutos. Las reglas tardan más, como debe ser.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver los sistemas de diseño en GitHub',
  },
};
