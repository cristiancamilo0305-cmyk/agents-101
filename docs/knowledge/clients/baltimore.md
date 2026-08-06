# Base de conocimiento — Cliente Baltimore

Referencia interna para consultoría contable de Cristian con el cliente **Baltimore**. Usa esta información para responder con precisión; no inventes procesos que no aparezcan aquí.

---

## Perfil del cliente

| Campo | Detalle |
|-------|---------|
| Cliente | Baltimore |
| Servicios de Cristian | Cuentas por pagar, soporte contable, triaje de correo |
| Sistema ERP | SAP |
| Canal principal | Correo electrónico (Gmail) |

---

## Cuentas por pagar — flujo general

1. **Recepción:** facturas y solicitudes llegan por correo o portal de proveedores.
2. **Clasificación:** categorizar correo (ver bandeja Gmail integrada).
3. **Validación en SAP:** verificar factura, fecha de vencimiento, centro de costo.
4. **Integración de pagos:** cuando piden detalle de un pago, buscar en SAP por fecha y generar soporte.
5. **Confirmación:** responder al proveedor o área interna con estado (pagada, programada, pendiente documentación).

---

## Categorías de correo (triaje)

| Categoría | Acción de Cristian |
|-----------|-------------------|
| mencion_directa | Prioridad alta — mencionan a Cristian/Cris o piden apoyo urgente |
| portal_proveedores | Revisar siempre — registro, invitaciones, actualizaciones |
| solicitud_pago | Buscar en SAP por fecha de pago y enviar detalle |
| factura_pagada | Confirmar en SAP si ya se pagó |
| proxima_a_pagar | Consultar calendario de vencimientos |
| nota_credito | Revisar y aplicar en SAP |
| informativo | FYI — no requiere acción salvo archivo |

---

## SAP — consultas frecuentes

- **¿Factura pagada?** Transacción de consulta de documentos de proveedor por número de factura y ejercicio.
- **Integración de pagos:** exportar detalle del pago (fecha, referencia, facturas incluidas) desde SAP y adjuntar en respuesta.
- **Próximos vencimientos:** filtrar partidas abiertas por fecha de vencimiento en los próximos 7–14 días.

*(Ajusta transacciones específicas T-codes cuando las documentes con el cliente.)*

---

## Reglas operativas

- Correos del **portal de proveedores** siempre requieren atención, aunque parezcan informativos.
- Si mencionan a Cristian por nombre con fecha límite de pago → **mencion_directa** con prioridad.
- "Programación de pago" como aviso sin pregunta → informativo.
- "¿Ya pagaron la factura X?" → factura_pagada.
- "Envíame el detalle del pago del viernes" → solicitud_pago.

---

## Contactos clave

*(Completa con nombres reales del cliente.)*

| Rol | Nombre | Notas |
|-----|--------|-------|
| Contacto AP Baltimore | — | — |
| Aprobador pagos | — | — |

---

## Herramientas en esta plataforma

- **Chat (este agente):** procedimientos, reglas, consultas sobre procesos de Baltimore. También responde preguntas de SAP en vivo (ver abajo).
- **Bandeja Gmail:** `/consultoria/baltimore/gmail` — conectar Gmail, clasificar correos no leídos, marcar no relevantes como leídos. Para cualquier correo que en el fondo pida conciliar un pago o saber qué facturas lo integran (sin importar la categoría: solicitud_pago, mencion_directa, etc.), si se identifica proveedor y fecha, prepara automáticamente un borrador de respuesta con el desglose de facturas (sin enviarlo). Si el proveedor no calza por nombre, busca en el historial de correos del remitente qué facturas ha mencionado antes y las cruza contra SAP para inferir el proveedor real.
- **Datos SAP en vivo:** siempre se lee el archivo `SAP*.xlsx` más reciente en la carpeta local **"Baltimore - SAP"**, sincronizada por Google Drive Desktop (no una copia congelada en el repo). Columnas clave: `Name` (proveedor), `Reference` (factura), `Total amount`/`Currency`, `WF Step Description` (estatus del flujo de aprobación; "WF finished" = terminado), `Clearing Date`/`Clearing Document` (cuándo y con qué documento se liquidó el pago).

---

## Notas pendientes de documentar

- T-codes SAP específicos de Baltimore
- Calendario de cierre mensual
- Proveedores recurrentes y excepciones
- Política de aprobación de montos
