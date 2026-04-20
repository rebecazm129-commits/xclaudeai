# xCLAUDE Installer — Troubleshooting Guide

## Arquitectura del Sistema

```
Usuario descarga .dmg
    ↓
Electron App (src/main.js + src/index.html)
    ↓
Ejecuta vendor/setup.js
    ↓
Modifica ~/Library/Application Support/Claude/claude_desktop_config.json
    ↓
Añade xCLAUDE server config + shadow_registry.json
    ↓
xCLAUDE intercepta llamadas a MCP servers locales (filesystem, etc.)
    ↓
Genera eventos en ~/.xclaud/audit.jsonl
    ↓
Dashboard (polling cada 3s) lee audit.jsonl y muestra eventos
```

**CRITICAL:** xCLAUDE solo puede proxiar servers que estén en `claude_desktop_config.json` EN EL MOMENTO de ejecutar `setup.js`. Si filesystem se añade DESPUÉS, xCLAUDE no lo detecta y shadow_registry queda vacío.

---

## ✅ Checklist Pre-Release

Antes de generar .dmg y subir a GitHub, verificar:

### Dashboard UI
- [ ] Muestra "xCLAUDE" (no "xCLAUD") en descripciones de eventos
- [ ] Timestamps aparecen en hora local del sistema (no UTC)
- [ ] Contadores de severidad actualizan correctamente
- [ ] Eventos se refrescan cada 3 segundos automáticamente

### App Behavior
- [ ] App cierra correctamente desde:
  - [ ] Cmd+Q
  - [ ] Dock → Quit
  - [ ] Tray icon → Quit
- [ ] Emoji ⚡ visible en barra de menú superior
- [ ] Ventana reabre correctamente desde:
  - [ ] Clic en emoji ⚡
  - [ ] Clic en icono del Dock
- [ ] Ventana mantiene dimensiones 720x560px

### Instalación
- [ ] Flow completo sin quedarse colgado en "Proceed?"
- [ ] Responde automáticamente "y" a confirmación
- [ ] API key vacía (Enter) funciona para modo local
- [ ] Filesystem se añade AUTOMÁTICAMENTE (mensaje: "Filesystem server added automatically")
- [ ] Shadow registry muestra proxied tools > 0 (típicamente 14)

### Detección de Amenazas
- [ ] Severity CRITICAL: prompt injection detectado
- [ ] Severity HIGH: credentials/API keys detectadas
- [ ] Severity MEDIUM: PII (emails, teléfonos) detectado
- [ ] Severity LOW: operaciones normales
- [ ] Dashboard muestra todos los niveles correctamente

### Build
- [ ] .dmg Intel generado sin errores
- [ ] .dmg ARM64 generado sin errores
- [ ] Ambos archivos en `dist/`

---

## 🐛 Puntos de Fallo Conocidos

### 1. Dashboard muestra "xCLAUD" en lugar de "xCLAUDE"

**Síntoma:** Eventos aparecen como "xCLAUD detected..." en el dashboard.

**Causa raíz:** El servidor genera descripciones con "xCLAUD" (nombre corto). El dashboard mostraba texto sin procesar.

**Fix:** `src/index.html` línea 372
```javascript
desc: e.description.replace(/xCLAUD\b/g, 'xCLAUDE')
```

**Ubicación:** Solo afecta a UI, no a logs en `audit.jsonl`.

---

### 2. App no cierra desde dock/tray

**Síntoma:** Al hacer Quit desde dock o tray icon, la app sigue ejecutándose en background. El icono del tray desaparece pero el proceso sigue vivo.

**Causa raíz:** Electron por defecto no cierra cuando se cierra la última ventana en macOS. El handler `window.on('close')` solo ocultaba la ventana sin verificar si era un quit real.

**Fix:** `src/main.js`
```javascript
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

mainWindow.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});

// CRÍTICO: Eliminar el handler que bloqueaba el quit
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') app.quit();
// });
```

**Prevención:** Siempre testear Cmd+Q, dock Quit, y tray Quit antes de release.

---

### 3. Timestamps en UTC

**Síntoma:** Los timestamps en el dashboard muestran hora UTC en lugar de hora local del sistema.

**Causa raíz:** `audit.jsonl` almacena timestamps en ISO 8601 (UTC). El código extraía solo la parte de hora con `.slice(11,19)` sin conversión a timezone local.

**Fix:** `src/index.html` línea 370
```javascript
// Antes:
time: e.ts.slice(11,19)

// Después:
time: new Date(e.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})
```

**Prevención:** Siempre convertir timestamps UTC a local antes de mostrar al usuario.

---

### 4. Instalación se queda colgada en "Proceed?"

**Síntoma:** El wizard de instalación se queda infinitamente en "Installing xCLAUDE...". El setup script pregunta "Proceed? (y/N)" pero nunca recibe respuesta.

**Causa raíz:** El script `vendor/setup.js` pregunta confirmación interactiva. Electron ejecutaba el script y enviaba `y\n` al stdin ANTES de que el prompt apareciera. La respuesta se perdía en el buffer.

**Intentos fallidos:**
- ❌ Enviar `y\n` al inicio del script → llegaba antes del prompt
- ❌ Delay de 2 segundos antes de enviar → timing impredecible

**Fix:** `src/main.js` líneas 129-140
```javascript
proc.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('[Setup]', text);
  
  // Detectar el prompt y responder inmediatamente
  if (text.includes('Proceed?')) {
    proc.stdin?.write('y\n');
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setup-progress', text);
  }
});
```

**Prevención:** Para scripts interactivos, siempre detectar prompts en stdout y responder reactivamente (no proactivamente).

---

### 5. Shadow registry vacío (proxied tools: 0)

**Síntoma:** Después de instalar xCLAUDE, el dashboard muestra "Proxied tools: 0". El archivo `~/.xclaud/shadow_registry.json` existe pero está vacío o solo tiene `{"servers": []}`.

**Causa raíz:** xCLAUDE captura la configuración de MCP servers EN EL MOMENTO de ejecutar `setup.js`. Si `claude_desktop_config.json` no tiene el filesystem server (u otros servers) configurado ANTES de la instalación, xCLAUDE no tiene nada que proxiar.

**Escenario típico:**
1. Usuario instala xCLAUDE → `mcpServers` está vacío
2. xCLAUDE se instala correctamente pero shadow_registry queda vacío
3. Usuario añade filesystem manualmente después → xCLAUDE ya no lo detecta

**Fix temporal (workaround):**
```bash
# Desinstalar xCLAUDE
# Añadir filesystem a claude_desktop_config.json manualmente
# Reinstalar xCLAUDE
npx xclaudeai setup
```

**Fix permanente (✅ IMPLEMENTADO):**
Modificar `vendor/setup.js` para añadir automáticamente el filesystem server a `claude_desktop_config.json` durante la instalación.

**Código añadido:** `vendor/setup.js` líneas 75-86 (después de leer config, antes de capturar servers)
```javascript
// ── AUTO-ADD FILESYSTEM ─────────────────────────────────────────────────────
// Si filesystem no existe, añadirlo automáticamente para evitar shadow registry vacío
if (!existing.mcpServers?.filesystem) {
  const desktopPath = path.join(os.homedir(), "Desktop");
  existing.mcpServers = existing.mcpServers || {};
  existing.mcpServers.filesystem = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", desktopPath]
  };
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
  ok("Filesystem server added automatically (Desktop folder)");
}
```

**Testing realizado (19/04/2026):**
1. Config limpio creado (sin xclaude ni filesystem)
2. Instalación ejecutada desde app en dev
3. Verificación post-instalación:
   - ✅ Filesystem aparece en shadow_registry.json
   - ✅ Path correcto: `/Users/.../Desktop`
   - ✅ Dashboard muestra "Proxied tools: 14"

**Prevención:** El filesystem ahora se añade automáticamente. Shadow registry nunca quedará vacío en instalaciones nuevas.

---

### 6. Detección PII/Credentials no funciona

**Síntoma:** El dashboard solo muestra eventos con severity `low`. Aunque se pasen credenciales o PII, no se detectan como `medium` o `high`.

**Causa raíz:** El código de detección está en `vendor/dist/server.js`, pero este archivo se regenera cada vez que se ejecuta `npx xclaudeai`. Los cambios locales se pierden.

**Fix:**
1. Modificar `vendor/dist/server.js` localmente con la lógica de detección
2. Copiar el archivo modificado desde la instalación activa:
```bash
cp ~/.npm/_npx/c0a2601c0f66218d/node_modules/xclaudeai/dist/server.js ~/Downloads/xclaud-installer/vendor/dist/server.js
```

**Ubicación del código de detección:** `vendor/dist/server.js` función `dispatchTool()`

**Prevención:** 
- Publicar nueva versión del paquete `xclaudeai` en npm con el fix integrado
- Documentar que cambios en `vendor/dist/server.js` deben copiarse manualmente antes de generar .dmg

---

### 7. Tray icon no aparece + Ventana no reabre desde Dock (✅ RESUELTO)

**Síntoma:** 
- Icono del tray no aparece en la barra de menú superior (donde WiFi, batería, etc.)
- Al cerrar ventana con X, no se puede volver a abrir haciendo clic en el icono del Dock
- Usuario queda sin forma de reabrir el dashboard excepto reiniciando la app completamente

**Causa raíz:** 
1. Tray icon creado con `nativeImage.createEmpty()` → icono invisible
2. Falta handler `app.on('activate')` en macOS para reabrir ventana desde Dock

**Fix aplicado:** `src/main.js` (19/04/2026)

**Parte 1 - Tray icon visible:** Líneas 75-80
```javascript
// Crear icono base de 1x1 pixel transparente
const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
tray = new Tray(icon);
// Usar emoji como icono visible en la barra de menú
tray.setTitle('⚡');
```

**Parte 2 - Reabrir desde Dock:** Líneas 33-35
```javascript
// FIX: Reabrir ventana desde Dock en macOS
app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});
```

**Testing realizado (19/04/2026):**
- ✅ Emoji ⚡ aparece en barra de menú superior
- ✅ Clic en emoji reabre ventana
- ✅ Clic en icono Dock reabre ventana
- ✅ Cierre con X oculta ventana correctamente
- ✅ Quit desde tray/dock/Cmd+Q cierra completamente

**Prevención:** Siempre testear tray visibility y reopen desde Dock antes de release.

---

## 🔍 Comandos de Diagnóstico

### Verificar instalación de xCLAUDE
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | grep -A 10 xclaudeai
```

Debe mostrar:
```json
"xclaudeai": {
  "command": "npx",
  "args": ["-y", "xclaudeai"]
}
```

### Verificar shadow registry
```bash
cat ~/.xclaud/shadow_registry.json
```

Debe tener `servers` con al menos 1 entrada (filesystem).

### Ver eventos recientes
```bash
tail -20 ~/.xclaud/audit.jsonl | jq
```

### Contar eventos por severity
```bash
cat ~/.xclaud/audit.jsonl | jq -r .severity | sort | uniq -c
```

### Ver solo eventos críticos
```bash
cat ~/.xclaud/audit.jsonl | jq 'select(.severity == "critical")'
```

### Verificar que Claude Desktop está ejecutándose
```bash
ps aux | grep "Claude.app"
```

### Limpiar instalación y empezar de cero
```bash
# Backup del config
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/claude_config_backup.json

# Eliminar xCLAUDE del config (editar manualmente)
# Reiniciar Claude Desktop

# Eliminar datos de xCLAUDE
rm -rf ~/.xclaud/

# Reinstalar
npx xclaudeai setup
```

---

## 📝 Decisiones de Diseño (Por Qué Se Hizo Así)

### ¿Por qué Node.js incluido en el .dmg?
Para que el usuario final no necesite instalar Node.js. Electron incluye Node.js automáticamente. Esto hace la app 100% standalone.

### ¿Por qué polling cada 3s en el dashboard?
Porque `audit.jsonl` se escribe desde otro proceso (el servidor xCLAUDE). No podemos usar file watchers de forma confiable cross-process en Electron. Polling es simple y funciona.

### ¿Por qué ejecutar setup.js con ELECTRON_RUN_AS_NODE?
Porque `vendor/setup.js` es código Node.js puro (no HTML/renderer). Electron puede ejecutar scripts Node.js directamente sin abrir ventana usando esta variable de entorno.

### ¿Por qué no usar child_process.exec()?
Porque `exec()` espera a que el proceso termine para devolver output. `spawn()` permite leer stdout en tiempo real, necesario para detectar "Proceed?" y responder inmediatamente.

### ¿Por qué separar vendor/ del código principal?
Porque `vendor/` contiene código copiado de `xclaud-mcp` (setup.js, dist/server.js). Mantenerlo separado facilita actualizarlo cuando se publiquen nuevas versiones del paquete npm.

---

## 🚀 Workflow de Release

1. **Aplicar todos los fixes necesarios**
   - Modificar código en `src/`
   - Si se modifica `vendor/dist/server.js`, copiar desde `~/.npm/_npx/.../xclaudeai/dist/server.js`

2. **Ejecutar checklist pre-release** (ver arriba)

3. **Generar .dmg**
   ```bash
   cd ~/Downloads/xclaud-installer
   ./node_modules/.bin/electron-builder --mac
   ```

4. **Verificar archivos generados**
   ```bash
   ls -lh dist/*.dmg
   ```
   Debe haber 2 archivos:
   - `xCLAUDE Installer-1.0.0.dmg` (Intel)
   - `xCLAUDE Installer-1.0.0-arm64.dmg` (Apple Silicon)

5. **Subir a GitHub**
   - Ir a `https://github.com/rebecazm129-commits/xclaudeai/releases`
   - Editar release `v1.0.0`
   - Eliminar .dmg antiguos
   - Subir .dmg nuevos desde `dist/`

6. **Actualizar Notion** con cambios aplicados

---

## 📚 Referencias

- Electron docs: https://www.electronjs.org/docs/latest/
- electron-builder: https://www.electron.build/
- xCLAUDE repo: https://github.com/rebecazm129-commits/xclaudeai
- Notion doc: https://www.notion.so/Instalador-gr-fico-xCLAUDE-Electron-345242b46fa781c88f13d135e8121f42
