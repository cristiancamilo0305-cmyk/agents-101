# Base de conocimiento — Impresión 3D con Bambu Lab

Referencia interna para consultas sobre impresoras Bambu Lab, materiales, perfiles de impresión y resolución de problemas. Usa esta información para responder con precisión; no inventes specs que no aparezcan aquí.

---

## Impresoras soportadas

| Modelo | Volumen de impresión (mm) | Hotend max | Cama | AMS nativo |
|--------|----------------------------|------------|------|------------|
| X1 Carbon | 256 × 256 × 256 | 300 °C | PEI texturizada + liso | Sí (AMS / AMS Lite) |
| P1S | 256 × 256 × 256 | 300 °C | PEI texturizada | Sí (AMS / AMS Lite) |
| P1P | 256 × 256 × 256 | 300 °C | PEI texturizada | Sí (AMS / AMS Lite) |
| A1 | 256 × 256 × 256 | 300 °C | PEI texturizada | AMS Lite |
| A1 mini | 180 × 180 × 180 | 300 °C | PEI texturizada | AMS Lite |

**Nota:** X1 Carbon incluye lidar para calibración automática de flujo y detección de spaghetti. P1S/P1P requieren calibración manual periódica del flujo si cambias mucho de filamento.

---

## Filamentos recomendados

### PLA
- **Uso:** prototipos, figuras decorativas, piezas de bajo esfuerzo mecánico.
- **Temperatura nozzle:** 210–220 °C (Bambu PLA Basic: 220 °C).
- **Cama:** 55–60 °C.
- **Ventilación:** 100 % desde capa 2.
- **Humedad:** mantener < 30 % RH; PLA húmedo cruje y produce hilos.

### PETG
- **Uso:** piezas funcionales, contacto con alimentos (solo si el filamento está certificado food-safe), exterior protegido.
- **Temperatura nozzle:** 240–250 °C.
- **Cama:** 70–80 °C.
- **Ventilación:** 30–50 %; demasiada ventilación debilita capas.
- **Tip:** secar 6 h a 65 °C antes de imprimir si estuvo expuesto.

### ABS / ASA
- **Uso:** ABS interior; ASA exterior (UV-resistente).
- **Temperatura nozzle:** ABS 260–280 °C; ASA 250–270 °C.
- **Cama:** 90–100 °C.
- **Enclosure:** obligatorio para ABS; recomendado para ASA.
- **Ventilación:** cerrada (0 %) durante impresión.

### TPU (95A)
- **Uso:** piezas flexibles, juntas, fundas.
- **Temperatura nozzle:** 220–230 °C.
- **Cama:** 40–50 °C.
- **Velocidad:** reducir a 30–60 mm/s; desactivar "auxiliary fan" si hay stringing.
- **AMS:** no compatible con TPU blando en AMS estándar; imprimir desde spool externo.

---

## Perfiles de calidad en Bambu Studio

| Perfil | Capa (mm) | Uso típico |
|--------|-----------|------------|
| Standard | 0.20 | Uso general, buen balance velocidad/calidad |
| Strength | 0.24–0.28 | Piezas mecánicas, más perimetros |
| Extra Fine | 0.12 | Miniaturas, detalle fino |
| Draft | 0.28–0.32 | Prototipos rápidos, baja calidad visual |

**Regla práctica:** para piezas funcionales con roscas M3, usar mínimo 4 perimetros y relleno 25–40 % (gyroid o grid).

---

## AMS — Automated Material System

- Capacidad: 4 bobinas por unidad AMS; hasta 4 AMS en cadena (16 filamentos) en X1/P1.
- **Secado integrado:** 45 °C (PLA/PETG), 65 °C (ABS/ASA), ciclo recomendado 8–12 h.
- **Cambio automático:** soportado en impresión multicolor; pausa automática si se acaba un color.
- **Filamentos NO recomendados en AMS:** TPU blando, filamento húmedo sin secar, bobinas > 1 kg sin adaptador.
- **RFID:** bobinas Bambu oficiales cargan perfil automáticamente; genéricas requieren perfil manual.

---

## Diseño para impresión (DFAM)

1. **Orientación:** coloca la cara más visible hacia arriba; evita soportes en caras estéticas.
2. **Espesor mínimo de pared:** 1.2 mm (3 perimetros a 0.4 mm nozzle) para piezas rígidas.
3. **Holgura para encastre:** 0.2–0.3 mm en PLA; 0.3–0.4 mm en PETG.
4. **Agujeros verticales:** diseñar 0.2 mm más pequeños que la medida nominal (ej. M3 → taladro 2.8 mm).
5. **Brims vs rafts:** usar brim 5–8 mm en piezas con poca área de contacto; evitar rafts salvo ABS problemático.
6. **Tolerancias roscas:** para roscas impresas directamente, usar perfil "ISO metric profile" en CAD con offset +0.1 mm.

---

## Troubleshooting frecuente

### Warping (esquinas levantadas)
- Subir temperatura de cama 5 °C.
- Usar brim de 8 mm.
- Cerrar enclosure (ABS/ASA).
- Limpiar cama con agua + jabón; evitar touch con dedos (grasa).

### Stringing (hilos entre piezas)
- Secar filamento.
- Bajar temperatura nozzle 5 °C.
- Aumentar retraction (direct drive: 0.8–1.2 mm; Bowden: no aplica en Bambu).
- Activar "Wipe tower" en multicolor.

### Layer shifting (capas desplazadas)
- Apretar correas X/Y (P1P/P1S).
- Verificar que no haya obstrucción en guías.
- Reducir aceleración a 8000 mm/s² temporalmente.

### First layer no adhiere
- Calibrar nivelación (Calibración → Bed Level en Bambu Studio).
- Limpiar cama PEI.
- Subir cama +5 °C o bajar velocidad primera capa a 20 mm/s.

### Spaghetti detection (X1 Carbon)
- Si aborta en falso positivo: desactivar temporalmente en Bambu Studio → Print options → AI spaghetti detection.
- Si no detecta fallo real: revisar que la cámara no esté obstruida.

---

## Mantenimiento

| Intervalo | Acción |
|-----------|--------|
| Cada 200 h | Limpiar y lubricar varillas con aceite de máquina de coser |
| Cada 500 h | Reemplazar nozzle (desgaste en fibras abrasivas) |
| Mensual | Limpiar ventiladores de hotend y extrusor |
| Al cambiar filamento abrasivo (CF, glow) | Usar nozzle de acero endurecido 0.4 o 0.6 mm |
| AMS cada 3 meses | Limpiar rodillos de alimentación con alcohol isopropílico |

---

## Recursos oficiales

- **Slicer:** Bambu Studio (descarga en bambulab.com)
- **Perfiles de filamento:** biblioteca integrada en Bambu Studio + MakerWorld
- **Firmware:** actualizar desde la app Bambu Handy o Bambu Studio (Settings → Device → Update firmware)
- **Soporte:** ticket en support.bambulab.com; incluir número de serie y logs de impresión (.3mf exportado)

---

## FAQ rápido

**¿Puedo usar filamento de terceros?** Sí. Configura temperatura y diámetro manualmente si no tiene RFID.

**¿Qué nozzle para piezas miniatura?** 0.2 mm; reduce velocidad a 50 mm/s máximo.

**¿Cuánto tarda secar PLA en AMS?** 8 h a 45 °C; PETG 8 h a 45 °C; ABS 12 h a 65 °C.

**¿Puedo imprimir sin conexión a internet?** Sí en modo LAN (activar en Bambu Studio → Device → LAN Only Mode).

**¿Filamento recomendado para piezas de drone?** PETG o ABS; evitar PLA por deformación térmica > 60 °C.

---

## Setup de referencia — Bambu Lab A1 Combo (Cristian)

Configuración activa del taller para figuras decorativas de interiores (floreros, bandejas, figuras ~17 cm en negro/blanco).

| Componente | Detalle |
|------------|---------|
| Impresora | Bambu Lab **A1 Combo** (AMS Lite incluido) |
| Volumen útil | 256 × 256 × 256 mm |
| Filamento principal | **Elegoo PLA mate** (negro y blanco) |
| Línea de producto | Decoración de interiores: floreros, bandejas, figuras (ej. gatos ~17 cm) |
| Slicer | Bambu Studio |
| Post-proceso habitual | Lijado + imprimación en piezas premium; venta directa y Amazon |

---

## Perfil Elegoo PLA mate — figuras decorativas (A1 Combo)

El PLA **mate** enmarca más las capas que un acabado silk o glossy. Para piezas de exhibición (cabezas, curvas, frentes):

### Temperaturas y extrusión
- **Nozzle:** 215–220 °C (punto de partida **218 °C**).
- **Cama:** 60 °C.
- **Flujo:** calibrar con Bambu Studio → Device → Calibration → Flow Rate (mate a veces necesita +2–4 %).
- **Secado obligatorio:** 6–8 h a **45 °C** en AMS Lite antes de tiradas largas o cambio negro ↔ blanco.

### Calidad de superficie (prioridad en cabeza y curvas)
| Parámetro | Valor recomendado | Por qué |
|-----------|-------------------|---------|
| Altura de capa | **0.12 mm** | Menos “escalones” en curvas de cabeza |
| Perímetros | 3–4 | Paredes más uniformes |
| Velocidad pared exterior | **60–80 mm/s** | Superficie más lisa |
| Velocidad primera capa | 20 mm/s | Base estable |
| Ventilación | 100 % desde capa 2 | Mejor definición en voladizos pequeños |
| Seam (costura) | **Nearest** o alineada en espalda | Evita línea vertical en frente/cara |
| Ironing | Desactivado en curvas verticales | Solo útil en superficies planas superiores |
| Relleno | 15–20 % grid/gyroid | Suficiente para decoración, menos vibración |

### Multicolor negro/blanco (AMS Lite)
- Usar **torre de purga**; en piezas pequeñas la transición puede dejar marcas en la cabeza.
- Si el defecto aparece **solo en la zona de cambio de color**, imprimir en **un solo color** y pintar a mano suele dar mejor acabado comercial.
- Purga mínima: subir un poco (más material desperdiciado, menos manchas).

### Orientación para figuras (gatos, bustos)
1. Colocar la **costura en la parte trasera** (no en mejillas ni frente).
2. Evitar que la punta de la nariz o orejas sean el punto más alto sin soporte si el overhang supera ~50°.
3. Inclinar ligeramente (5–15°) a veces reparte mejor las líneas de capa en la frente — probar en pieza de prueba antes de tirada larga.

### Diagnóstico rápido de defectos en cabeza

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| Líneas **horizontales** en mejillas/frente | Capas gruesas o velocidad alta | 0.12 mm + exterior ≤ 70 mm/s |
| Línea **vertical** fija | Seam mal ubicado | Seam → back / nearest + rotar modelo |
| Zona **arrugada** o extrusión irregular | Filamento húmedo o flujo bajo | Secar 8 h + recalibrar flujo |
| Rugosidad **solo en negro** tras cambio | Purga insuficiente AMS | Subir purga o imprimir monocolor |
| “Película” o brillo distinto en parches | Temperatura inestable | Fijar 218 °C, desactivar variación dinámica |

### Post-proceso para acabado “liso comercial” (Amazon)
1. Lijado 220 → 400 en zonas visibles (cabeza, frente).
2. Imprimación filler en spray (capa fina).
3. Lijado 600 en seco.
4. Pintura acrílica mate acorde al color final.
5. Fotografía con luz difusa — el mate oculta micro-rayas en listing.

---

## Catálogo y diseño — decoración moderna de interiores

Tendencias con buena rotación en marketplaces (home decor impreso en 3D):

| Categoría | Ejemplos | Notas de diseño |
|-----------|----------|-----------------|
| Orgánico / soft forms | Floreros ondulados, bandejas con bordes fluidos | Sin paredes < 1.2 mm; base ancha anti-vuelco |
| Minimalista nórdico | Bandejas planas, portavelas geométricos | Superficies planas → ironing opcional en la cara superior |
| Figurativa | Gatos, aves, siluetas 15–20 cm | Priorizar 0.12 mm; evaluar pintura post-impresión |
| Funcional decorativo | Maceteros con plato, organizadores de escritorio | Drenaje en maceteros; evitar agua estancada en PLA |

**Restricciones DFAM para venta:**
- Espesor mínimo de pared: **1.2 mm** (3 perimetros con nozzle 0.4).
- Base de apoyo suficiente para envío (Amazon FBA exige resistencia a apilado).
- Evitar voladizos > 55° sin soporte en caras visibles.
- Diseñar empaque: caja rígida + bubble wrap; figuras 17 cm → caja ~20×20×22 cm típica.

**Flujo de diseño externo (Hunyuan / Meshy / Tripo):**
1. Brief: estilo + dimensiones + foto de referencia.
2. Generar malla → reparar en Bambu Studio / Meshmixer (agujeros, paredes finas).
3. Imprimir prototipo → foto → iterar.
4. Versión final → fotos listing (fondo blanco, 2000 px lado largo mínimo).

---

## Modelado 3D en línea — de idea o imagen a STL exportable

Flujo completo para pasar de **una idea escrita**, **una foto** o **una referencia visual** a un archivo listo para imprimir en Bambu Lab.

### Rutas de entrada

| Entrada | Herramientas típicas | Mejor para |
|---------|---------------------|------------|
| **Texto → 3D** | Meshy (text), Tripo3D, Hunyuan3D | Figuras decorativas, objetos orgánicos, conceptos rápidos |
| **Imagen → 3D** | Meshy (image), Tripo3D, Hunyuan3D, Rodin (Hyperhuman) | Replicar forma de referencia, figuras, esculturas |
| **Sketch → 3D** | Meshy sketch, TinkerCAD (manual) | Bocetos simples, piezas geométricas |
| **CAD paramétrico** | Fusion 360, Shapr3D, Onshape | Piezas funcionales, medidas exactas, roscas |

### Plataformas recomendadas (2025–2026)

**Meshy** (meshy.ai)
- Modos: Text to 3D, Image to 3D, Text to Texture.
- Export: STL, OBJ, FBX, GLB, USDZ.
- Tip: usar "Remesh" y "Make printable" si está disponible; revisar paredes finas antes de exportar.

**Tripo3D** (tripo3d.ai)
- Modos: imagen única o multivista (frontal + lateral mejora precisión).
- Export: GLB, OBJ, STL.
- Tip: subir foto con fondo limpio y sujeto centrado; especificar "single object, watertight mesh".

**Hunyuan3D** (Tencent — hunyuan.tencent.com o integraciones)
- Fuerte en objetos orgánicos y personajes estilizados.
- Export: OBJ/GLB; convertir a STL en Blender o Bambu Studio si hace falta.

**Blender** (gratis — post-proceso obligatorio casi siempre)
- Reparar malla: 3D Print Toolbox → Check All → Make Manifold.
- Solidify para paredes < 1.2 mm.
- Decimate si el STL supera ~50 MB.
- Export STL: escala en metros → aplicar escala (Ctrl+A) antes de exportar.

**Bambu Studio** (validación final)
- Importar STL/OBJ/3MF → Slice → detectar errores de malla.
- Funciones: reparar agujeros automático, orientar, añadir soportes.

### Brief ideal (texto o imagen)

Plantilla para describir el diseño al generador:

```
Objeto: [ej. gato sentado decorativo]
Estilo: [minimalista / orgánico / nórdico / realista]
Dimensiones objetivo: [ej. 17 cm alto × 12 cm ancho]
Uso: [decoración interior / bandeja / florero]
Restricciones impresión: sin soportes en cara frontal, base plana, paredes ≥ 1.2 mm
Material previsto: PLA mate negro
Detalles clave: [orejas puntiagudas, cola curvada, expresión neutra]
Evitar: [soportes visibles en mejillas, base muy estrecha]
```

Para **imagen de referencia:**
- Fondo blanco o recortado (remove.bg si hace falta).
- Una sola pieza por imagen (no escenas complejas).
- Buena luz, sin sombras duras que confundan la geometría.
- Si la herramienta permite multivista: frontal + perfil 90°.

### Pipeline iterativo hasta diseño exportable

```
1. IDEA / IMAGEN
      ↓
2. GENERAR en Meshy / Tripo / Hunyuan (v1)
      ↓
3. REPARAR malla (Blender o Bambu Studio)
   - Manifold / watertight
   - Paredes ≥ 1.2 mm (Solidify)
   - Base plana (cortar en Z=0 si flota)
      ↓
4. ESCALAR a dimensiones reales (cm → mm en Blender o Bambu)
      ↓
5. EXPORTAR STL (binario, escala aplicada)
      ↓
6. IMPORTAR en Bambu Studio → preview soportes
      ↓
7. PROTOTIPO impreso (PLA barato, 0.2 mm)
      ↓
8. FOTO del prototipo → ajustar brief → v2
      ↓
9. VERSIÓN FINAL → STL + .3mf con perfil guardado
```

**Criterios de "listo para imprimir":**
- Malla cerrada (no leaks en slice preview).
- Pared mínima 1.2 mm en zona visible.
- Base de contacto ≥ 40 mm² o brim planificado.
- Tamaño dentro del volumen A1 (256 mm) o A1 mini (180 mm).
- STL < 100 MB (decimate si no).

### Formatos de exportación

| Formato | Cuándo usarlo |
|---------|---------------|
| **STL** | Estándar para impresión; sin color; universal |
| **OBJ** | Intermedio; a veces más ligero; importar a Blender/Bambu |
| **3MF** | Preferido en Bambu Studio (incluye escala, perfiles) |
| **GLB/FBX** | Preview web; convertir a STL antes de imprimir |
| **PNG/JPG** | Solo entrada para Image-to-3D; no imprimible directamente |

### Conversión imagen → servicio 3D (sin modelar manual)

Si solo tienes una foto y quieres STL rápido:

1. Preparar imagen (recorte, fondo blanco, 1024–2048 px).
2. Subir a **Tripo3D** o **Meshy Image to 3D**.
3. Descargar STL/OBJ.
4. Abrir en Blender → Make Manifold → Solidify 1.2 mm.
5. Export STL → Bambu Studio.

**Limitaciones típicas de IA generativa:**
- Partes flotantes o agujeros ocultos → siempre reparar.
- Caras muy detalladas → decimate o 0.12 mm capa lenta.
- Simetría imperfecta → espejar en Blender si molesta.
- Copyright: no subir personajes/licenciados para vender.

### Herramientas de reparación rápida

| Problema | Solución |
|----------|----------|
| Agujeros en malla | Blender 3D Print Toolbox / Bambu "repair" |
| Paredes < 1 mm | Modifier Solidify (1.2–1.6 mm) |
| Modelo gigante o minúsculo | Apply scale; medir con regla en Bambu |
| Demasiados polígonos | Decimate Modifier (ratio 0.3–0.5) |
| Base irregular | Bisect plano en Z; sentar en cama |
| Objeto hueco no deseado | Solidify + eliminar caras internas |

### Prompts de ejemplo (text-to-3D)

**Figura decorativa:**
> "Minimalist ceramic cat figurine, sitting pose, smooth organic curves, flat base 8 cm diameter, total height 17 cm, no fine fur texture, suitable for FDM 3D printing, single watertight mesh"

**Bandeja orgánica:**
> "Organic wave-shaped decorative tray, Scandinavian style, 25×18 cm, low profile 3 cm height, smooth walls, flat stable bottom, printable without supports"

**Florero:**
> "Modern twisted vase, single opening, 20 cm tall, base wide for stability, wall thickness suitable for 3D printing, minimalist"

---


Guía operativa para listar decoración impresa (no constituye asesoría legal/fiscal).

### Modelos de fulfillment
| Modelo | Descripción | Cuándo usarlo |
|--------|-------------|---------------|
| **FBM** (Fulfillment by Merchant) | Tú imprimes, empacas y envías | Pocas unidades, prueba de mercado |
| **FBA** (Fulfillment by Amazon) | Envías stock a almacén Amazon | Escala, Prime badge, rotación estable |

### Requisitos comunes de listing (Home & Kitchen / Home Décor)
- **Título:** marca + tipo de producto + material + tamaño aproximado (ej. “Florero decorativo PLA mate 18 cm — línea Nordic”).
- **Bullets:** material (PLA), uso (interior), dimensiones, cuidado (limpiar con paño húmedo, no lavavajillas), hecho a mano/impreso bajo demanda si aplica.
- **Imágenes:** mínimo 1 fondo blanco puro; lifestyle en ambiente; escala (mano o regla); empaque si FBA.
- **Precio:** considerar costo filamento (~15–25 %), tiempo impresión, empaque, comisión Amazon (~15 % categoría), devoluciones.

### Compliance y riesgos
- **Propiedad intelectual:** no vender figuras con copyright (Disney, anime, etc.) sin licencia.
- **Seguridad:** portavelas → usar vela LED o advertir distancia; productos infantiles → normativas extra.
- **Etiquetado:** muchos vendedores incluyen “Impreso en 3D — PLA” en inserto.
- **Hecho a mano / artesanal:** Amazon Handmade es otra vía si quieres posicionamiento artesanal.

### KPIs para decidir si un SKU vale la pena
- Tiempo de impresión < 8 h por unidad (ideal < 5 h).
- Tasa de defectos < 5 % tras perfil estabilizado.
- Margen bruto objetivo: **≥ 40 %** tras comisiones y material.
- Rotación: reponer stock FBA antes de 14 días de cobertura.

### Plantilla de ficha de producto (interna)
```
Nombre:
Dimensiones (L×A×H cm):
Peso (g):
Tiempo impresión (h):
Filamento (g):
Perfil Bambu (.3mf):
Precio coste estimado:
Precio venta Amazon:
Keywords (5):
Restricciones (no food-safe, solo interior, etc.):
```

---

## Glosario — términos que usa el agente de impresión

| Término | Significado |
|---------|-------------|
| Seam | Punto donde la boquilla sube de capa en la pared; deja línea vertical |
| Overhang | Parte que flota sin soporte debajo (barbilla, orejas) |
| Flow rate | Cantidad de filamento extruido vs. teórico |
| AMS Lite | Sistema 4 bobinas del A1 Combo |
| DFAM | Design for Additive Manufacturing — diseñar pensando en impresión |
| FBA / FBM | Modelos de envío en Amazon |
| Purga | Filamento descartado al cambiar de color en AMS |
