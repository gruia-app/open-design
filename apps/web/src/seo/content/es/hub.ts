import type { SeoHub } from '../../types';

export const hub: SeoHub = {
  locale: 'es',
  title: 'Guías de diseño colaborativo de código abierto',
  description:
    'Guías claras sobre diseño colaborativo de código abierto, sistemas de diseño con DESIGN.md, prototipado con IA, revisión de diseño y herramientas autoalojadas.',
  ogTitle: 'Guías de diseño colaborativo de código abierto',
  ogDescription:
    'Seis guías claras sobre diseño colaborativo de código abierto, sistemas de diseño como código, prototipado con IA y diseño local.',
  keywords: [
    'guías de diseño de código abierto',
    'diseño colaborativo open source',
    'sistema de diseño como código',
    'guía DESIGN.md',
    'flujo de prototipado con IA',
    'alternativa open source a Figma',
    'herramientas de diseño autoalojadas',
    'revisión de diseño en equipo',
  ],
  eyebrow: 'Guías',
  h1: 'Guías de diseño colaborativo de código abierto',
  lede:
    'Seis guías breves para equipos de diseño y producto que quieren herramientas que puedan leer, cambiar y ejecutar por su cuenta.',
  intro: [
    'Estas guías nacen en el mismo sitio que el código. Construimos OpenDesign en abierto y nos hacían siempre las mismas preguntas. ¿Cómo diseñamos en equipo sin una herramienta cerrada? ¿Dónde viven las reglas de diseño? ¿Cómo pasamos de un brief a un prototipo que funcione? Así que escribimos las respuestas. Las mantuvimos sencillas, porque una guía que necesita glosario ya ha fallado. Todas siguen la misma forma: primero una respuesta corta, después los pasos y al final las preguntas habituales.',
    'La colección tiene seis guías. La primera explica qué significa el diseño colaborativo de código abierto y qué cambia para un equipo. La segunda muestra cómo mantener un sistema de diseño como código en un archivo DESIGN.md. La tercera recorre un flujo de prototipado con IA, del brief al prototipo. Cada guía se entiende sola, así que empieza por la que encaje con tu problema. Puedes leerlas en cualquier orden, y ninguna depende de las demás.',
    'Las tres últimas guías tratan las decisiones que rodean a las herramientas. Una compara herramientas de diseño de código abierto según lo que importa a un equipo. Otra describe una revisión de diseño colaborativa que no acaba en una reunión de opiniones. La última explica el diseño local y autoalojado: qué se queda en tu equipo, qué sale de él y quién controla los datos. Escribimos para equipos de diseño y producto, no para proveedores de herramientas. Los pasos son cortos y concretos.',
    'Cuando una guía menciona una función de OpenDesign, enlaza a los archivos del repositorio público para que puedas comprobarla. Si otra herramienta hace algo mejor, lo decimos. El repositorio usa licencia Apache-2.0, así que también puedes copiar lo que te sirva. No necesitas instalar nada para leer las guías. La página de ejemplos lista sistemas de diseño, plantillas, skills y plugins reales si quieres probar las ideas. Las guías no son un curso, así que ojea los títulos y toma los pasos que necesites.',
  ],
  faq: [
    {
      question: '¿De qué tratan estas guías?',
      answer:
        'Explican cómo pueden trabajar juntos los equipos de diseño y producto con herramientas de código abierto. Los temas son diseño colaborativo, sistemas de diseño como código, prototipado con IA, comparación de herramientas, revisión de diseño y diseño autoalojado. Cada guía es breve y práctica.',
    },
    {
      question: '¿Quién debería leerlas?',
      answer:
        'Están pensadas para diseñadores, responsables de producto e ingenieros que comparten el trabajo de diseño. No hace falta programar para seguirlas. Algunos pasos mencionan una terminal o un archivo Markdown, y los explicamos uno a uno.',
    },
    {
      question: '¿Necesito OpenDesign para seguir las guías?',
      answer:
        'No. Las ideas sirven para cualquier entorno de diseño de código abierto o autoalojado. Usamos OpenDesign en los ejemplos porque es la herramienta que mejor conocemos, y enlazamos a los archivos públicos para que compruebes cada dato.',
    },
    {
      question: '¿OpenDesign es gratuito y de código abierto?',
      answer:
        'El repositorio de OpenDesign es público y usa la licencia Apache-2.0. Puedes leer el código, ejecutarlo en tu propio equipo y modificarlo. El README del repositorio lista las opciones actuales de modelos y agentes.',
    },
    {
      question: '¿Qué es un archivo DESIGN.md?',
      answer:
        'Un archivo DESIGN.md describe el lenguaje visual de un producto en Markdown sencillo: color, tipografía, espaciado, componentes y reglas. Lo leen las personas y también los agentes de IA. Como es un archivo de texto, puedes versionarlo, revisarlo y compartirlo como código.',
    },
    {
      question: '¿Dónde puedo ver ejemplos reales?',
      answer:
        'La página de ejemplos lista sistemas de diseño, plantillas, skills, plugins y reglas de oficio del repositorio. Cada entrada enlaza a su carpeta en GitHub. Puedes abrir los archivos y leer exactamente lo que contienen.',
    },
    {
      question: '¿Con qué frecuencia actualizáis las guías?',
      answer:
        'Actualizamos una guía cuando el proyecto cambia de forma que le afecta. El historial del repositorio muestra qué cambió y cuándo. Si encuentras un error, abre una incidencia en GitHub y lo corregimos.',
    },
    {
      question: '¿Puedo contribuir a OpenDesign o a las guías?',
      answer:
        'Sí. La guía de contribución del repositorio explica cómo añadir un sistema de diseño, una plantilla, una skill o una traducción. Una pull request pequeña es bienvenida, y un aviso de error también.',
    },
  ],
  cta: {
    heading: 'Pruébalo con un brief real',
    body: 'Lee una guía, abre OpenDesign y sigue los pasos con tu propio proyecto. El código es público. Si algo no queda claro, avísanos y corregimos la guía.',
    primaryLabel: 'Descargar OpenDesign',
    secondaryLabel: 'Ver el repositorio en GitHub',
  },
};
