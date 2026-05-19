# 📚 Kaizen Manga - Integración con Paperback

[![Language: English](https://img.shields.io/badge/Language-English-blue.svg)](README.md)

Este repositorio contiene los conectores de origen (**Source**) y seguimiento (**Tracker**) oficiales para la aplicación de lectura de manga **Paperback** en iOS (tanto para la versión actual **v0.8** como para la futura **v0.9**). 

Permite explorar toda tu biblioteca local de **Kaizen Manga Downloader**, leer tus capítulos en streaming directo (incluso archivos CBZ locales) y sincronizar el estado de lectura bidireccionalmente.

---

## ⚡ Métodos de Instalación

Puedes añadir este repositorio a Paperback en tu dispositivo iOS de dos formas:

### 🚀 Método 1: Instalación en Un Clic (Recomendado)
Accede a la página de inicio del proyecto desde el navegador **Safari** de tu iPhone/iPad:

👉 **[Página de Instalación de Kaizen Manga](https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/)**

Allí verás el botón **Añadir a Paperback**. Al pulsarlo, la app se abrirá e importará el repositorio de forma completamente automática.

### 📋 Método 2: Instalación Manual
Si prefieres añadir la dirección de forma manual dentro de la aplicación:

1. Abre **Paperback** en tu dispositivo.
2. Ve a **Settings** ➡️ **External Sources** ➡️ **Add Repository**.
3. Pega la URL correspondiente a tu versión de Paperback:
   * **Para Paperback v0.8.x (iOS estable):** 
     ```
     https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/v0.8
     ```
   * **Para Paperback v0.9.x (WIP / Alpha):** 
     ```
     https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/v0.9
     ```
4. Guarda y pulsa en instalar la extensión **Kaizen Manga** que aparecerá en la lista.

---

## ⚙️ Configuración de la Extensión

Una vez instalada en Paperback, debes enlazarla con tu servidor local o instancia de staging de Kaizen Manga Downloader:

1. Ve a **Settings** ➡️ **Active Sources** ➡️ **Kaizen Manga**.
2. Rellena los campos del formulario de configuración:
   * **Host del Servidor:** La URL base de tu servidor de Kaizen (ej. `http://192.168.1.50:3333` o `http://tu-servidor-kaizen:3333`).
   * **API Token:** Tu token de autenticación que generas desde el panel de administración de tu instancia de Kaizen Downloader.
3. Guarda los cambios. ¡Tu biblioteca se sincronizará al instante!

---

## ✨ Características Soportadas

* 🔍 **Búsqueda Avanzada:** Filtra y busca mangas en tu servidor Kaizen directamente desde el motor de búsqueda global de Paperback.
* 🏠 **Inicio Dinámico (Home Sections):**
  * **Recientemente Añadidos:** Mangas descargados recientemente en tu servidor.
  * **Capítulos Sin Leer:** Acceso rápido a las series en las que tienes capítulos pendientes de lectura.
* 📖 **Extractor de CBZ Optimizado:** Lee capítulos comprimidos locales mediante transmisión optimizada JSON.
* 🔄 **Sincronización Bidireccional:** Al terminar de leer un capítulo en Paperback, se enviará una señal en caliente (`PATCH`) al servidor de Kaizen para marcar el capítulo como leído automáticamente en tu base de datos global.

---

## 🛠️ Desarrollo Local y Compilación

Si deseas realizar modificaciones o contribuir al desarrollo de la extensión de forma local:

### 1. Clonar el Repositorio e Instalar Dependencias
```bash
git clone https://github.com/kaizen-Architecture/Kaizen-Manga-Paperback-Integration.git
cd Kaizen-Manga-Paperback-Integration
```

### 2. Compilar la Extensión
Puedes compilar la librería core compartida y el conector específico:
```bash
# Compilar core compartido
npm run build:core

# Compilar para v0.8 (iOS v0.8.11-r1 / SDK v5)
npm run build:v0.8

# Compilar para v0.9 (SDK v6)
npm run build:v0.9
```

### 3. Servir en Red Local para Pruebas en el iPad
Para depurar la extensión en vivo usando la app de Paperback sin desplegar a GitHub:
```bash
npm run serve:v0.8
```
Esto abrirá un servidor local en el puerto `1024`. Copia la dirección IP mostrada (ej. `http://192.168.1.15:1024`) y añádela como repositorio externo en la app de Paperback de tu iPad.
