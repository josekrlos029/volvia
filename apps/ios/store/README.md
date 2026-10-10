# Recursos de la tienda

Todo lo que App Store Connect pide y no es código: icono, capturas, textos, notas para el
revisor. Paquete Node independiente del workspace (`apps/ios` queda fuera de pnpm a
propósito); la guía completa de publicación está en [docs/APP-STORE.md](../../../docs/APP-STORE.md).

```bash
pnpm install --ignore-workspace     # una vez
node icon.mjs                       # icono 1024 (+ dark/tinted), logo de arranque, foto del simulador
bash capture.sh                     # compila, arranca iPhone 17 Pro Max y iPad Pro 13", captura 6 estados
node frame.mjs                      # compone las capturas con titular en es-MX y en-US
node banners.mjs                    # banners de cabecera y de búsqueda (creative assets) en es-MX y en-US
VOLVIA_REVIEW_TOKEN=… node review-qr.mjs   # QR de la tarjeta demo para App Review
```

| Archivo | Qué hace |
|---|---|
| `lib.mjs` | Rutas, paleta real (navy/violeta/naranja) y reconstrucción del glifo "V" a partir del PNG de `/assets` |
| `icon.mjs` | Escribe `out/icon/` e instala el icono en `../Resources/Assets.xcassets` |
| `capture.sh` | `simctl` con `VOLVIA_SIM_STATE` por estado; verifica 1320×2868 y 2064×2752 |
| `frame.mjs` | Fondo de marca + titular (`copy.json`) + captura con esquinas redondeadas |
| `banners.mjs` | `out/banners/`: cabecera universal 5244×2950, cabecera 3840×1646 y búsqueda 3840×2560, por idioma |
| `review-qr.mjs` | `out/review/demo-card-sheet.png` para adjuntar en las notas de revisión |
| `metadata/<idioma>/` | Nombre, subtítulo, descripción, palabras clave, URLs, listos para pegar |
| `review/notes.md` | Notas al revisor, App Privacy, clasificación por edad, resto de campos |
| `ExportOptions.plist` | Para `xcodebuild -exportArchive` con subida directa |

`raw/` y `out/` se regeneran y no se versionan.
