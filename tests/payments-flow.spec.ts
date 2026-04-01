import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Flujo Completo de Pagos de Propietarios', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/iniciar-sesion');
    
    // Autenticación (Ajustar credenciales según sea necesario)
    await page.getByPlaceholder('Correo electrónico').fill('derechoybienes@gmail.com');
    await page.getByPlaceholder('Contraseña').fill('123456'); // Reemplazar con pass real o de test
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    
    // Esperar a que cargue el dashboard
    await expect(page).toHaveURL('/');
  });

  test('debe importar saldos y completar un ciclo de pago', async ({ page }) => {
    // 2. Ir a Finanzas -> Saldos Mensuales (Asumiendo que están en OwnerAccounts o similar)
    // Según App.tsx, la ruta es /cuentas-propietarios
    await page.goto('/cuentas-propietarios');

    // 3. Importar CSV de Saldos
    const csvPath = path.resolve(__dirname, '../csv/PROP_FEB26.csv');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('text=Importar CSV')
    ]);
    await fileChooser.setFiles(csvPath);

    // 4. Confirmar importación
    const confirmButton = page.getByRole('button', { name: /confirmar|aceptar/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // 5. Ir a la pestaña de Lotes (dentro de la misma página o módulo)
    await page.getByRole('tab', { name: /Lotes|Pagos/i }).click();

    // 6. Seleccionar propietarios y crear lote
    // Buscamos un checkbox en la tabla de saldos pendientes
    await page.locator('table >> input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: /Crear Lote/i }).click();

    // 7. Verificar que el lote aparece
    await expect(page.locator('text=LOTE-').first()).toBeVisible();

    // 8. Marcar como pagado
    await page.getByRole('button', { name: /Marcar como Pagado/i }).first().click();
    
    // 9. Verificar en la pestaña de "Pagados"
    await page.getByRole('tab', { name: /Pagados/i }).click();
    await expect(page.locator('text=LOTE-').first()).toBeVisible();
  });
});
