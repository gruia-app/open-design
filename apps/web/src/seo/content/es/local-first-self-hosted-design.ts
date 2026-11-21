import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'local-first-self-hosted-design',
  locale: 'es',
  slug: 'diseno-local-first-autoalojado',
  title: 'Diseño local-first y autoalojado para equipos: OpenDesign',
  description:
    'Trabaja el diseño en local con OpenDesign: app de escritorio, demonio local, claves propias, autoalojamiento con Docker, registro privado de plugins y límites claros.',
  ogTitle: 'Diseño local-first y autoalojado para equipos',
  ogDescription:
    'Cómo mantener archivos y claves de API en tus propias máquinas con OpenDesign: escritorio, Docker, registro privado de plugins, privacidad y lo que aún necesita red.',
  keywords: [
    'herramienta de diseño local-first',
    'herramienta de diseño autoalojada',
    'alternativa open source a Figma autoalojada',
    'herramienta de diseño con clave propia',
    'diseño privado para equipos',
    'autoalojar software de diseño con docker',
    'privacidad de datos en herramientas de diseño',
    'registro privado de plugins',
  ],
  eyebrow: 'Guía',
  h1: 'Diseño local-first y autoalojado para equipos',
  lede: 'Algunos equipos no pueden enviar sus archivos de diseño a un servicio en la nube. Esta guía explica cómo OpenDesign mantiene el trabajo en tus máquinas y dónde sigue necesitando red.',
  intro: [
    'Local-first significa que tus archivos viven en tu ordenador y la aplicación trabaja con ellos allí. Un servidor es opcional, no obligatorio. Autoalojado significa que tú ejecutas el servicio, en una máquina que controlas.',
    'OpenDesign admite ambas cosas. Es una herramienta de diseño de código abierto con licencia Apache 2.0. Funciona como aplicación de escritorio o como servicio Docker. Un demonio local hace el trabajo, y el agente de programación o el modelo que elijas pone la inteligencia.',
    'Esta guía va dirigida a equipos a los que les importa adónde van sus archivos y sus claves. Indica qué se ejecuta en local, qué puede salir de tu máquina y qué no hace todavía el proyecto. Contamos los límites sin rodeos, porque una página de privacidad que solo enumera virtudes es un folleto.',
  ],
  sections: [
    {
      heading: 'Qué significa local-first en OpenDesign',
      paragraphs: [
        'El proyecto se define como local-first. Tus proyectos, los archivos generados y tus claves de API propias se quedan en tu máquina. Los flujos locales de proyectos y archivos siguen funcionando cuando los servicios de telemetría no responden.',
        'Hay un límite importante. Las funciones que usan un modelo siguen dependiendo del entorno o del proveedor que elijas. Si eliges un modelo alojado por un tercero, tus prompts viajan a ese proveedor. Si eliges un modelo que alojas tú, no viajan.',
      ],
      subsections: [
        {
          heading: 'El demonio local',
          paragraphs: [
            'Un demonio local es la parte con privilegios del sistema. Sirve la API, lanza los agentes, gestiona skills y sistemas de diseño, y guarda los resultados. La interfaz web y el shell de escritorio hablan con él.',
            'Por defecto, el demonio escucha solo en la dirección de bucle local. Otras máquinas de tu red no pueden acceder. Exponerlo a la red exige ajustes explícitos, que vemos más abajo.',
          ],
        },
        {
          heading: 'Dónde viven tus archivos',
          paragraphs: [
            'Los archivos del proyecto se quedan en tu máquina, o en el directorio de trabajo que elijas para cada proyecto. Los resultados son archivos reales, como HTML y CSS, no registros en una base de datos en la nube.',
            'El repositorio mantiene una única regla para la ubicación de datos del demonio, y esta guía no la repite. Si necesitas mover o montar esa ubicación, lee antes la sección sobre el directorio de datos en el archivo AGENTS del repositorio.',
          ],
        },
      ],
    },
    {
      heading: 'App de escritorio: plataformas y estado real',
      paragraphs: [
        'La aplicación de escritorio es el camino local-first más sencillo. Incluye el demonio y la interfaz, y detecta las herramientas de línea de comandos de agentes de programación que ya tengas en el path.',
      ],
      table: {
        caption: 'Opciones de instalación y su estado actual',
        columns: ['Opción', 'Plataformas', 'Estado'],
        rows: [
          ['App de escritorio', 'macOS con Apple Silicon e Intel', 'Versiones publicadas'],
          ['App de escritorio', 'Windows x64', 'Versiones publicadas'],
          [
            'App de escritorio',
            'Linux',
            'Sin artefacto precompilado en las versiones oficiales; ejecútalo desde el código fuente, seguimiento en la incidencia 4368',
          ],
          ['Docker Compose', 'Linux, macOS y Windows con Docker', 'Vía de autoalojamiento admitida'],
          ['Desde el código fuente', 'macOS, Linux, WSL2 y Windows nativo', 'Windows nativo es de mejor esfuerzo'],
        ],
      },
      subsections: [
        {
          heading: 'Si usas Linux',
          paragraphs: [
            'Hoy Linux no tiene versión de escritorio precompilada. El README lo dice sin rodeos, y una versión de escritorio para Linux sigue como tarea abierta en la hoja de ruta.',
            'En Linux tienes dos buenos caminos. Ejecuta OpenDesign desde el código fuente o usa la imagen Docker. El script de instalación envuelve Docker Compose y, en Linux, añade una unidad de usuario de systemd para que el servicio arranque al iniciar sesión.',
          ],
        },
        {
          heading: 'Requisitos que comprobar',
          bullets: [
            'Node 24 y la versión fijada de pnpm para compilar desde el código fuente.',
            'Docker con el plugin Compose para la vía de contenedores.',
            'Al menos una herramienta de línea de comandos de agente en el path, o un proveedor con clave propia.',
          ],
        },
      ],
    },
    {
      heading: 'Clave propia y elección de modelo',
      paragraphs: [
        'OpenDesign no incluye un agente propio. Usa las herramientas de línea de comandos de agentes que ya ejecutas, como Claude Code o Codex, y puede cambiar entre ellas. Elige la que tu equipo de seguridad ya tenga aprobada.',
        'Si no tienes ninguna, un proxy con clave propia ofrece el mismo bucle sin lanzar un proceso. Introduces una URL base, una clave y un nombre de modelo. El proxy admite rutas para Anthropic, OpenAI, Azure, Google y Ollama, además de ajustes preestablecidos compatibles.',
      ],
      subsections: [
        {
          heading: 'Adónde van tus claves',
          paragraphs: [
            'La página de privacidad indica que las claves de los proveedores se guardan en local. La aplicación y el demonio las usan para llamar al proveedor que seleccionaste. No son campos de telemetría y nunca se envían al equipo de OpenDesign.',
          ],
        },
        {
          heading: 'Mantener los prompts dentro de tu red',
          paragraphs: [
            'Para las configuraciones más estrictas, apunta el proxy a un modelo que alojes tú. Por defecto, el demonio bloquea las direcciones de proveedor en rangos privados, para evitar la falsificación de peticiones del lado del servidor. El README documenta cómo permitir un punto interno de forma deliberada. Léelo antes de cambiar ese ajuste.',
            'Considéralo un equilibrio. El bloqueo te protege de una URL mala. La excepción deja trabajar a tu propio servidor de modelos. Decidid una vez, como equipo.',
          ],
        },
        {
          heading: 'Coste y facturación',
          paragraphs: [
            'Con clave propia, pagas directamente a tu proveedor. OpenDesign no fija una facturación mínima para esa vía. Revisa las condiciones de tu proveedor sobre retención y entrenamiento, porque se aplican a tus prompts.',
          ],
        },
      ],
    },
    {
      heading: 'Privacidad y cumplimiento normativo',
      paragraphs: [
        'OpenDesign publica una página de privacidad que describe la aplicación entregada. Léela entera antes de desplegar la herramienta. Esta sección resume los puntos que importan en una revisión de tu equipo de seguridad o de legal.',
      ],
      subsections: [
        {
          heading: 'Qué puede enviar la aplicación',
          bullets: [
            'Las analíticas de producto y las trazas de calidad están activadas por defecto. Puedes desactivarlas o reducirlas en Ajustes, en Privacidad.',
            'La telemetría de seguridad y fiabilidad está siempre activa en las compilaciones con destino de telemetría configurado. Es limitada y se depura, y el interruptor general de analíticas no la desactiva.',
            'Los forks y las compilaciones de desarrollo sin credenciales de telemetría no envían ninguna de las dos clases.',
          ],
        },
        {
          heading: 'Qué no recoge nunca la aplicación',
          bullets: [
            'El contenido de los archivos de resultado que generas.',
            'Tus claves de API propias, tokens y credenciales guardadas.',
            'Texto legible de prompts o proyectos en la reproducción de sesión con máscara de privacidad.',
          ],
        },
        {
          heading: 'Lo que esto no te da',
          paragraphs: [
            'OpenDesign no afirma tener certificaciones de cumplimiento. El código abierto y el almacenamiento local ayudan a tu propia auditoría, pero no la sustituyen. Tu equipo sigue siendo responsable de la residencia de datos, la retención, el control de acceso y su proveedor de modelos.',
            'La página de privacidad también avisa de que anónimo no significa que la red no pueda ver una dirección. Cualquier petición HTTPS expone una dirección de origen al servicio que la recibe. Si eso importa, bloquea los hosts de telemetría en tu cortafuegos.',
          ],
        },
      ],
    },
    {
      heading: 'Autoalojamiento con Docker',
      paragraphs: [
        'Docker es la vía documentada para empezar con el autoalojamiento. Sirve para un servidor compartido del equipo, una máquina de laboratorio o un servidor doméstico.',
      ],
      subsections: [
        {
          heading: 'Pasos básicos',
          steps: [
            'Instala Docker Desktop, o Docker con el plugin Compose en Linux.',
            'Clona el repositorio y abre la carpeta deploy.',
            'Copia el archivo de entorno de ejemplo a un archivo de entorno nuevo.',
            'Genera un token aleatorio y ponlo como token de la API, o configura un proxy inverso autenticado de confianza.',
            'Ejecuta docker compose up en segundo plano y espera a que se descargue la imagen.',
            'Comprueba el contenedor con docker compose ps y consulta el endpoint de salud en el puerto local.',
          ],
        },
        {
          heading: 'Autenticación y exposición',
          paragraphs: [
            'La configuración de Compose asigna el puerto a la dirección de bucle local del host. El modo recomendado es un modo protegido con token de API. El navegador inicia sesión con el usuario documentado y el token como contraseña.',
            'Si pones un proxy inverso delante, fija los orígenes permitidos a tu dirección pública. Desactiva la autenticación de la API solo cuando ese proxy ya autentique todas las peticiones y nada llegue al demonio de forma directa.',
          ],
        },
        {
          heading: 'Notas sobre red local y nube',
          paragraphs: [
            'Para acceder al demonio desde otras máquinas de una red, debes fijar de forma deliberada el host de escucha y los orígenes permitidos. Las credenciales de conectores y las rutas de vista previa de artefactos en vivo siguen limitadas al bucle local.',
            'El repositorio incluye además notas de despliegue para Azure Container Instances y Alibaba Cloud, y una plantilla de la tienda de Sealos que ejecuta la imagen publicada con almacenamiento persistente y autenticación básica. Usa un volumen persistente para los datos y sigue la regla del directorio de datos del repositorio.',
          ],
        },
      ],
    },
    {
      heading: 'Autoalojar un registro de plugins',
      paragraphs: [
        'Los plugins y las skills amplían OpenDesign. Un registro es una fuente de un archivo JSON de marketplace más el proceso de revisión que hay detrás. En la primera versión puede ser un repositorio estático de GitHub, GitHub Enterprise, almacenamiento S3 o R2, o cualquier host HTTPS.',
        'Un registro privado permite que un equipo publique skills internas, como las reglas de marca de la empresa, sin enviarlas a un catálogo público.',
      ],
      subsections: [
        {
          heading: 'Añadir y comprobar un registro',
          steps: [
            'Publica el archivo JSON del marketplace en una dirección HTTPS directa. Una página de árbol de GitHub no sirve, porque el demonio rechaza el HTML.',
            'Añade el registro con el comando od marketplace add y elige un nivel de confianza, restringido o de confianza.',
            'Actualízalo con od marketplace refresh y búscalo con od marketplace search.',
            'Ejecuta od marketplace doctor con la opción estricta para comprobar identificadores, archivos, licencia e identidad del publicador.',
          ],
        },
        {
          heading: 'GitHub Enterprise privado',
          paragraphs: [
            'Para un repositorio privado en GitHub Enterprise, inicia sesión con od marketplace login. La autenticación se delega en la herramienta de línea de comandos de GitHub, y los tokens se quedan dentro de ella.',
          ],
        },
        {
          heading: 'Ir más allá de los archivos estáticos',
          paragraphs: [
            'El entorno de ejecución habla con una interfaz de backend de registro. Un archivo estático, un registro basado en pull requests y un registro en base de datos comparten el mismo contrato. Una base de datos gestionada podría añadir más adelante catálogos privados, listas de permitidos, flujos de aprobación y registros de auditoría.',
            'Esas funciones de base de datos son una dirección de diseño en la documentación, no un producto entregado. Hoy cuenta con la vía estática.',
          ],
        },
      ],
    },
    {
      heading: 'Los límites del trabajo sin conexión, sin adornos',
      paragraphs: [
        'Local-first no significa sin conexión. Deja esto claro a tu equipo antes de la primera demostración.',
      ],
      bullets: [
        'Generar necesita un modelo. Un modelo alojado necesita acceso a internet. Un modelo propio necesita una ruta hasta tu servidor.',
        'Instalar la aplicación, descargar la imagen Docker e instalar plugins desde un registro remoto necesitan red.',
        'Las analíticas opcionales y la búsqueda de actualizaciones necesitan red. El trabajo local con proyectos y archivos no.',
        'Linux todavía no tiene compilación de escritorio oficial.',
        'Las ediciones quirúrgicas en modo comentario están entregadas solo en parte, según la hoja de ruta.',
        'Las cuentas multiusuario y los espacios de trabajo compartidos en la nube no son algo que esta guía afirme.',
      ],
    },
    {
      heading: 'Lista de decisiones para desplegar en un equipo',
      table: {
        caption: 'Preguntas que resolver antes de desplegar en un equipo',
        columns: ['Decisión', 'Opciones', 'Quién decide'],
        rows: [
          ['Vía de instalación', 'App de escritorio, Docker o código fuente', 'Responsable de ingeniería'],
          ['Acceso a modelos', 'Herramienta de agente aprobada, clave alojada o modelo propio', 'Responsable de seguridad'],
          ['Telemetría', 'Mantener los valores por defecto, reducir en Ajustes o bloquear hosts en el cortafuegos', 'Responsable de seguridad'],
          ['Exposición', 'Solo bucle local, proxy inverso con token o red local con orígenes permitidos', 'TI'],
          ['Plugins', 'Catálogo público, registro estático privado o ninguno', 'Responsable de diseño'],
          ['Copias de seguridad', 'Copiar el volumen persistente y los directorios de proyectos', 'TI'],
        ],
      },
    },
  ],
  faq: [
    {
      question: '¿OpenDesign es realmente local-first?',
      answer:
        'Sí. Los proyectos, los archivos generados y tus claves de API propias se quedan en tu máquina. Las funciones con modelo siguen llamando al entorno o proveedor que elijas, así que los prompts salen de la máquina si ese proveedor es externo.',
    },
    {
      question: '¿Hay una app de escritorio de OpenDesign para Linux?',
      answer:
        'Todavía no. Las versiones oficiales cubren macOS con Apple Silicon e Intel, y Windows x64. En Linux puedes ejecutar OpenDesign desde el código fuente o con Docker, y una versión para Linux tiene una incidencia abierta de seguimiento.',
    },
    {
      question: '¿Puedo autoalojar OpenDesign con Docker?',
      answer:
        'Sí. El repositorio incluye una configuración de Docker Compose y una guía paso a paso. Fijas un token de API o pones por delante un proxy inverso autenticado de confianza. El demonio escucha en el bucle local salvo que lo cambies a propósito.',
    },
    {
      question: '¿OpenDesign envía mis diseños a la nube?',
      answer:
        'La página de privacidad indica que nunca se recoge el contenido de los archivos generados ni tus claves de API. Las analíticas y las trazas de calidad están activadas por defecto y puedes desactivarlas. Un canal de fiabilidad sigue activo en las compilaciones configuradas.',
    },
    {
      question: '¿Puedo usar mi propio modelo o mi propia clave de API con OpenDesign?',
      answer:
        'Sí. Puedes usar las herramientas de línea de comandos de agentes que tengas en el path, o un proxy con clave propia, con URL base, clave y modelo. El proxy admite varios proveedores, entre ellos Ollama, y las claves se quedan en tu máquina.',
    },
    {
      question: '¿Puedo tener un registro privado de plugins para mi empresa?',
      answer:
        'Sí. Un registro puede ser un archivo JSON de marketplace estático en cualquier host HTTPS, o un repositorio de GitHub Enterprise. Lo añades con od marketplace add, fijas un nivel de confianza y lo compruebas con od marketplace doctor.',
    },
    {
      question: '¿OpenDesign tiene SOC 2 u otras certificaciones de cumplimiento?',
      answer:
        'El proyecto no afirma tener ninguna. El almacenamiento local y el código abierto ayudan a tu propia revisión, pero tu equipo debe evaluar el tratamiento de datos, la retención y su proveedor de modelos según sus propias normas.',
    },
  ],
  cta: {
    heading: 'Quédate con los archivos y prueba la herramienta',
    body: 'OpenDesign es de código abierto con licencia Apache 2.0. Descarga la aplicación de escritorio, o clona el repositorio y prueba la vía Docker en una máquina que te sobre. Tus archivos se quedan donde los pongas.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el repositorio en GitHub',
  },
};
