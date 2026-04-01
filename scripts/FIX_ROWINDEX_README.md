# Instrucciones para corregir los rowIndex

## El problema
Las transacciones del 31/03/2026 tienen rowIndex del 153-196, pero deberían continuar después del rowIndex 452 (último del 30/03/2026). El script las corregirá a 453-496.

## Requisitos

1. **Obtener el archivo de credenciales de servicio:**
   - Ve a la [consola de Firebase](https://console.firebase.google.com/)
   - Selecciona tu proyecto
   - Ve a ⚙️ Configuración del proyecto > Cuentas de servicio
   - Click en "Generar nueva clave privada"
   - Guarda el archivo descargado como `serviceAccountKey.json` en la carpeta raíz del proyecto

2. **Ejecutar el script:**

   ```bash
   # Primero ver qué cambios haría (modo dry-run)
   npx tsx scripts/fixRowIndexes.ts

   # Si todo se ve bien, aplicar los cambios
   npx tsx scripts/fixRowIndexes.ts --fix
   ```

## Alternativa sin serviceAccountKey.json

Si prefieres no usar credenciales de servicio, puedes hacer la corrección manualmente desde la consola de Firebase:

1. Ve a Firestore Database en la consola
2. Filtra la colección `transactions` por `importId` = `JHTfhpLS1AXRFshDj9d3`
3. Ordena por `rowIndex`
4. Edita cada documento cambiando:
   - 153 → 453
   - 154 → 454
   - 155 → 455
   - ...y así sucesivamente hasta 196 → 496

O ejecuta este script desde el emulador de Firebase si tienes los datos localmente.
