import { expect, test } from '@playwright/test';
import { API, mockApi } from './mock-api';

test('[manual] SCAN-B01 browser decodes PNG, resizes to 2400px, uploads JPEG and recovers from retake/upload failure', async ({page}) => {
  await mockApi(page);
  let creates=0;let uploads=0;
  await page.route(`${API}/restaurants`,route=>{creates++;return route.fulfill({json:{id:'r1'}});});
  await page.route(`${API}/restaurants/r1/scan`,async route=>{
    uploads++;
    const request=route.request();
    const form=await new Request(request.url(),{method:'POST',headers:request.headers(),body:Uint8Array.from(request.postDataBuffer()!).buffer}).formData();
    const photo=form.get('photo') as File;
    expect(photo.name).toBe('menu.jpg');expect(photo.type).toBe('image/jpeg');
    const bytes=Array.from(new Uint8Array(await photo.arrayBuffer()));
    expect(bytes.slice(0,2)).toEqual([255,216]);
    const dimensions=await page.evaluate(async bytes=>{
      const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}));
      const size=[image.width,image.height];image.close();return size;
    },bytes);
    expect(dimensions).toEqual([2400,1200]);
    if(uploads===1)return route.fulfill({status:422,json:{status:'retake',message:'Move closer and retake the photo'}});
    if(uploads===2)return route.fulfill({status:503,json:{error:'Photo upload unavailable. Try again.'}});
    return route.fulfill({json:{status:'active'}});
  });
  await page.goto('/scan/');
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=4800;canvas.height=2400;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,4800,2400);ctx.fillStyle='black';ctx.font='100px sans-serif';ctx.fillText('Noodles $14',100,200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('searchbox').fill('Photo Cafe');
  await page.getByLabel('Upload photo').setInputFiles({name:'menu.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const submit=page.getByRole('button',{name:'Find What’s Good'});
  await submit.click();await expect(page.locator('main').getByRole('alert')).toHaveText('Move closer and retake the photo');
  await expect(page).toHaveURL(/\/scan\/$/);await expect(submit).toBeEnabled();
  await submit.click();await expect(page.locator('main').getByRole('alert')).toHaveText('Photo upload unavailable. Try again.');
  await expect(page).toHaveURL(/\/scan\/$/);await submit.click();await expect(page).toHaveURL(/\/results\/\?r=r1/);
  expect(creates).toBe(1);expect(uploads).toBe(3);
});
for(const file of [{name:'corrupt.png',mimeType:'image/png'},{name:'unsupported.heic',mimeType:'image/heic'}]){
  test(`[manual] SCAN-B02 ${file.name} decode failure stops before network work`,async({page})=>{
    await mockApi(page);let writes=0;
    await page.route(`${API}/restaurants`,route=>{writes++;return route.fulfill({json:{id:'r1'}});});
    await page.goto('/scan/');await page.getByRole('searchbox').fill('Cafe');
    await page.getByLabel('Upload photo').setInputFiles({...file,buffer:Buffer.from('invalid image bytes')});
    await page.getByRole('button',{name:'Find What’s Good'}).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Try a JPEG or PNG');expect(writes).toBe(0);
    await expect(page.getByRole('button',{name:'Find What’s Good'})).toBeEnabled();
  });
}
test('[manual] SCAN-B03 failed URL import retries same restaurant and navigates only after active menu',async({page})=>{
  await mockApi(page);let creates=0;let imports=0;
  await page.route(`${API}/restaurants`,route=>{creates++;return route.fulfill({json:{id:'r1'}});});
  await page.route(`${API}/restaurants/r1/menu`,route=>{
    imports++;expect(route.request().postDataJSON()).toEqual({url:'https://example.test/menu.pdf'});
    return imports===1?route.fulfill({status:502,json:{error:'Menu could not be fetched. Try again.'}}):route.fulfill({json:{status:'active'}});
  });
  await page.goto('/scan/');await page.getByRole('searchbox').fill('Cafe');
  await page.getByRole('button',{name:'Web or PDF link'}).click();await page.getByLabel('Menu page or PDF URL').fill('https://example.test/menu.pdf');
  await page.getByRole('button',{name:'Find What’s Good'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('Try again');
  await expect(page).toHaveURL(/\/scan\/$/);await expect(page.getByLabel('Menu page or PDF URL')).toHaveValue('https://example.test/menu.pdf');
  await page.getByRole('button',{name:'Find What’s Good'}).click();await expect(page).toHaveURL(/\/results\/\?r=r1/);
  expect(creates).toBe(1);expect(imports).toBe(2);
});
for(const width of [390,1280]){
  test(`[manual] A11Y-B01 dialog traps keyboard focus and preserves logical order at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await mockApi(page);await page.goto('/results/?r=r1');
    const trigger=page.getByRole('button',{name:/My profile/});await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Your profile'});const close=dialog.getByRole('button',{name:'Close dialog'});
    await expect(dialog.getByRole('spinbutton')).toHaveValue('25');
    await expect(dialog.getByRole('button',{name:/Apply Filters/})).toBeEnabled();
    await expect(close).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByRole('checkbox',{name:'peanut',exact:true})).toBeFocused();
    await close.focus();await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button',{name:/Apply Filters/})).toBeFocused();
    await page.keyboard.press('Tab');await expect(close).toBeFocused();
    for(let i=0;i<35;i++){
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  });
}
test('[manual] A11Y-B02 200% text zoom keeps form controls reachable and validation named',async({page})=>{
  await mockApi(page);await page.setViewportSize({width:640,height:450});await page.goto('/results/?r=r1');
  // A 640px viewport models the CSS viewport of a 1280px window at 200% browser zoom.
  // Double the root text size as well to exercise text-only zoom without relying on OS shortcuts.
  await page.addStyleTag({content:':root {font-size: 200%}'});
  await page.getByRole('button',{name:/My profile/}).click();const dialog=page.getByRole('dialog');
  const budget=dialog.getByRole('spinbutton',{name:'Budget per dish in dollars'});
  await budget.fill('-1');await dialog.getByRole('button',{name:/Apply Filters/}).click();
  await expect(budget).toBeFocused();expect(await budget.evaluate((node:HTMLInputElement)=>node.validity.rangeUnderflow)).toBe(true);
  await expect(dialog).toBeVisible();
  await budget.fill('20');const apply=dialog.getByRole('button',{name:/Apply Filters/});await apply.scrollIntoViewIfNeeded();await expect(apply).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
