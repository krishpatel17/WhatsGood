// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScanForm } from '../components/ScanForm';
import { api } from '../lib/api';
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('[manual] SCAN-R01 an unreadable photo is actionable and never creates a restaurant or uploads', async () => {
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('The source image could not be decoded')));
  const create=vi.spyOn(api,'createRestaurant');const scan=vi.spyOn(api,'scan');
  render(<ScanForm />);
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Cafe'}});
  fireEvent.change(screen.getByLabelText('Upload photo'),{target:{files:[new File(['bad'],'broken.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Find What’s Good'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Try a JPEG or PNG');
  expect(create).not.toHaveBeenCalled();expect(scan).not.toHaveBeenCalled();
  expect((screen.getByRole('button',{name:'Find What’s Good'}) as HTMLButtonElement).disabled).toBe(false);
});
it('[manual] SCAN-R02 failed URL import reuses the created ID on retry and preserves input', async () => {
  const create=vi.spyOn(api,'createRestaurant').mockResolvedValue({id:'r1'});
  const load=vi.spyOn(api,'importMenu').mockRejectedValueOnce(new Error('Menu unavailable; try again')).mockResolvedValueOnce({status:'retake',message:'Use another menu link'});
  render(<ScanForm />);fireEvent.change(screen.getByRole('searchbox'),{target:{value:' Cafe '}});
  fireEvent.click(screen.getByRole('button',{name:'Web or PDF link'}));
  fireEvent.change(screen.getByLabelText('Menu page or PDF URL'),{target:{value:'https://example.test/menu'}});
  fireEvent.click(screen.getByRole('button',{name:'Find What’s Good'}));await screen.findByRole('alert');
  expect((screen.getByLabelText('Menu page or PDF URL') as HTMLInputElement).value).toBe('https://example.test/menu');
  fireEvent.click(screen.getByRole('button',{name:'Find What’s Good'}));await screen.findByText('Use another menu link');
  expect(create).toHaveBeenCalledExactlyOnceWith('Cafe','Added from a menu link');
  expect(load.mock.calls).toEqual([['r1','https://example.test/menu'],['r1','https://example.test/menu']]);
});
it('[manual] SCAN-R03 a failed JPEG conversion releases the decoded image and sends no request', async () => {
  const bitmap={width:4800,height:2400,close:vi.fn()};
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(null));
  const create=vi.spyOn(api,'createRestaurant');
  render(<ScanForm />);fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Cafe'}});
  fireEvent.change(screen.getByLabelText('Upload photo'),{target:{files:[new File(['png'],'menu.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Find What’s Good'}));await screen.findByRole('alert');
  expect(bitmap.close).toHaveBeenCalledOnce();expect(create).not.toHaveBeenCalled();
});
it.each([
  {status:422,body:{status:'retake',message:'Move closer'}},
  {status:503,body:{error:'Upload unavailable'}},
])('[manual] SCAN-C01 photo API handles HTTP $status without hiding retake guidance', async c=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(c.body,{status:c.status}));
  const photo=new Blob(['jpeg'],{type:'image/jpeg'});
  if(c.status===422) expect(await api.scan('r1',photo)).toEqual(c.body);
  else await expect(api.scan('r1',photo)).rejects.toThrow('Upload unavailable');
  const options=fetch.mock.calls[0][1]!;expect(options.method).toBe('POST');expect(options.headers).toBeUndefined();
  const attached=(options.body as FormData).get('photo') as File;
  expect(attached.name).toBe('menu.jpg');expect(attached.type).toBe('image/jpeg');expect(attached.size).toBe(photo.size);
});
