# 📚 Kaizen Manga - Paperback Integration

[![Language: Spanish](https://img.shields.io/badge/Language-Español-yellow.svg)](README.es.md)

This repository contains the official **Source** and **Tracker** connectors for the **Paperback** manga reader application on iOS (supporting both the stable **v0.8** version and the future **v0.9** specification).

It allows you to browse your local **Kaizen Manga Downloader** library, stream chapters directly (including local CBZ extractions), and synchronize reading progress bi-directionally.

---

## ⚡ Installation Methods

You can add this repository to Paperback on your iOS device in two ways:

### 🚀 Method 1: One-Click Installation (Recommended)
Access the project landing page directly from **Safari** on your iPhone/iPad:

👉 **[Kaizen Manga Installation Page](https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/)**

There, you will find the **Add to Paperback** button. Tapping it will open the app and import the repository automatically.

### 📋 Method 2: Manual Installation
If you prefer to add the repository URL manually inside the app:

1. Open **Paperback** on your device.
2. Navigate to **Settings** ➡️ **External Sources** ➡️ **Add Repository**.
3. Paste the URL corresponding to your Paperback version:
   * **For Paperback v0.8.x (iOS Stable):** 
     ```
     https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/v0.8
     ```
   * **For Paperback v0.9.x (WIP / Alpha):** 
     ```
     https://kaizen-architecture.github.io/Kaizen-Manga-Paperback-Integration/v0.9
     ```
4. Save and tap install next to the **Kaizen Manga** extension that appears in the list.

---

## ⚙️ Extension Configuration

Once installed in Paperback, you must link it to your Kaizen Manga Downloader server instance:

1. Go to **Settings** ➡️ **Active Sources** ➡️ **Kaizen Manga**.
2. Fill out the configuration fields:
   * **Server Host:** The base URL of your Kaizen server (e.g. `http://192.168.1.50:3333` or `http://your-kaizen-server:3333`).
   * **API Token:** Your API access token generated from your Kaizen Downloader admin panel.
3. Save the changes. Your library will synchronize instantly!

---

## ✨ Features

* 🔍 **Global Search:** Browse and search manga on your Kaizen server directly through Paperback's search interface.
* 🏠 **Dynamic Home Sections:**
  * **Recently Added:** Quickly access the latest downloads on your server.
  * **Unread Chapters:** Access series that have unread chapters pending.
* 📖 **Optimized CBZ Extractor:** Streams compressed image files seamlessly using JSON page structures.
* 🔄 **Bi-directional Reading Sync:** Automatically sends a background status update (`PATCH` request) to mark chapters as read in Kaizen Downloader when finished reading on Paperback.

---

## 🛠️ Local Development & Building

If you wish to make changes or contribute to the extension development locally:

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/kaizen-Architecture/Kaizen-Manga-Paperback-Integration.git
cd Kaizen-Manga-Paperback-Integration
```

### 2. Compile Extensions
You can compile the shared core library and the specific targets:
```bash
# Compile shared core library
npm run build:core

# Build v0.8 Extension (iOS v0.8.11-r1 / SDK v5)
npm run build:v0.8

# Build v0.9 Extension (SDK v6)
npm run build:v0.9
```

### 3. Serve Locally for On-Device Debugging
To debug the extension on your iPad/iPhone without deploying to GitHub Pages:
```bash
npm run serve:v0.8
```
This starts the development server on port `1024`. Copy the local IP address (e.g., `http://192.168.1.15:1024`) and paste it as an external repository in the Paperback application on your iPad.
