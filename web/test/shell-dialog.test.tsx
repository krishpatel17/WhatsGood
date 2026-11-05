// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Dialog } from '../components/Dialog';
import { AppShell } from '../components/AppShell';
import { api, type Profile, type Restaurant } from '../lib/api';
const route = vi.hoisted(() => ({path:'/results/'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path}));
const saved: Profile & {id:string}={id:'p1',allergies:['soy'],diets:[],tastes:['spicy'],budget:25,notes:'Keep'};
beforeEach(()=>{
  // jsdom omits native dialog methods; Edge E2E separately exercises their native implementation.
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
  route.path='/results/';history.replaceState(null,'','/results/?r=r1');
});
afterEach(()=>{cleanup();Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');Reflect.deleteProperty(HTMLDialogElement.prototype,'close');vi.restoreAllMocks();localStorage.clear();history.replaceState(null,'','/');document.body.style.overflow='';});

it('[manual] DIALOG-R01 unmount restores trigger focus and the previous body scrolling policy',()=>{
  document.body.style.overflow='auto';
  const trigger=document.createElement('button');trigger.textContent='Trigger';document.body.append(trigger);trigger.focus();
  const {unmount}=render(<Dialog title="Filters" onClose={()=>{}}><input aria-label="Preference"/></Dialog>);
  expect(screen.getByRole('dialog',{name:'Filters'})).toBeTruthy();expect(document.body.style.overflow).toBe('hidden');
  screen.getByRole('textbox').focus();unmount();
  expect(document.activeElement).toBe(trigger);expect(document.body.style.overflow).toBe('auto');trigger.remove();
});
it('[manual] DIALOG-R02 close button, cancel and outside backdrop close; dialog content clicks do not',()=>{
  const close=vi.fn();render(<Dialog title="Filters" onClose={close}><input aria-label="Preference"/></Dialog>);
  const dialog=screen.getByRole('dialog');
  vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue({left:10,right:110,top:10,bottom:110,width:100,height:100,x:10,y:10,toJSON:()=>({})});
  fireEvent.click(screen.getByRole('textbox'));fireEvent.click(dialog,{clientX:50,clientY:50});expect(close).not.toHaveBeenCalled();
  fireEvent.click(dialog,{clientX:5,clientY:50});expect(close).toHaveBeenCalledTimes(1);
  fireEvent(dialog,new Event('cancel',{bubbles:true}));expect(close).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));expect(close).toHaveBeenCalledTimes(3);
});
it('[manual] DIALOG-R03 keyboard boundary wrap excludes hidden and disabled controls',()=>{
  render(<Dialog title="Filters" onClose={()=>{}}><input aria-label="Preference"/><button>Apply</button><button disabled>Unavailable</button><button hidden>Hidden</button></Dialog>);
  const dialog=screen.getByRole('dialog');const close=screen.getByRole('button',{name:'Close dialog'});const apply=screen.getByRole('button',{name:'Apply'});
  for(const node of dialog.querySelectorAll<HTMLElement>('button,input')){
    vi.spyOn(node,'getClientRects').mockReturnValue((node.hidden?[]:[{width:100,height:20}]) as unknown as DOMRectList);
  }
  close.focus();expect(fireEvent.keyDown(close,{key:'Tab',shiftKey:true})).toBe(false);expect(document.activeElement).toBe(apply);
  expect(fireEvent.keyDown(apply,{key:'Tab'})).toBe(false);expect(document.activeElement).toBe(close);
  const input=screen.getByRole('textbox');input.focus();expect(fireEvent.keyDown(input,{key:'Tab'})).toBe(true);expect(document.activeElement).toBe(input);
  expect(fireEvent.keyDown(input,{key:'ArrowRight'})).toBe(true);
});
it('[manual] SHELL-R01 profile save closes its dialog and refreshes the shared profile indicator',async()=>{
  localStorage.setItem('wg.profileId','p1');
  const load=vi.spyOn(api,'getProfile').mockResolvedValue(saved);
  const update=vi.spyOn(api,'updateProfile').mockResolvedValue(saved);
  vi.spyOn(api,'restaurant').mockResolvedValue({id:'r1',name:'Cafe',address:'Main St',has_menu:true,has_reviews:true});
  render(<AppShell><p>Results</p></AppShell>);
  await screen.findByTitle('Cafe');await screen.findByLabelText('Profile set');
  fireEvent.click(screen.getByRole('button',{name:/My profile/}));
  const dialog=screen.getByRole('dialog',{name:'Your profile'});
  await waitFor(()=>expect((within(dialog).getByRole('spinbutton') as HTMLInputElement).value).toBe('25'));
  fireEvent.change(within(dialog).getByRole('spinbutton'),{target:{value:'20'}});
  fireEvent.click(within(dialog).getByRole('button',{name:/Apply Filters/}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(update).toHaveBeenCalledWith('p1',expect.objectContaining({budget:20,allergies:['soy'],notes:'Keep'}));
  expect(load).toHaveBeenCalledTimes(3);expect(screen.getByLabelText('Profile set')).toBeTruthy();
});
it('[manual] SHELL-R02 scanner dialog marks active source then returns to restaurant source on cancel',()=>{
  history.replaceState(null,'','/');route.path='/';
  const load=vi.spyOn(api,'getProfile');render(<AppShell><p>Restaurants</p></AppShell>);
  const scanner=screen.getByRole('button',{name:'Scan Menu'});expect(scanner.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(scanner);expect(screen.getByRole('dialog',{name:'Scan the menu'})).toBeTruthy();expect(scanner.getAttribute('aria-pressed')).toBe('true');
  fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:true}));expect(screen.queryByRole('dialog')).toBeNull();
  expect(scanner.getAttribute('aria-pressed')).toBe('false');expect(screen.getByRole('link',{name:'Pick Restaurant'}).getAttribute('aria-current')).toBe('page');
  expect(load).not.toHaveBeenCalled();
});
it.each([{path:'/setup/',name:/My profile/},{path:'/scan/',name:'Scan Menu'}])('[manual] SHELL-R03 $path header action focuses the form already on the page',({path,name})=>{
  route.path=path;history.replaceState(null,'',path);
  render(<AppShell><input aria-label="Existing form"/></AppShell>);fireEvent.click(screen.getByRole('button',{name}));
  expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(screen.getByRole('textbox'));
});
it('[manual] SHELL-R04 pending profile/restaurant responses and profile events do not update an unmounted shell',async()=>{
  localStorage.setItem('wg.profileId','p1');let profileDone!:(p:typeof saved)=>void;let restaurantDone!:(r:Restaurant)=>void;
  const load=vi.spyOn(api,'getProfile').mockReturnValue(new Promise(resolve=>{profileDone=resolve;}));
  vi.spyOn(api,'restaurant').mockReturnValue(new Promise(resolve=>{restaurantDone=resolve;}));
  const {unmount,container}=render(<AppShell><p>Results</p></AppShell>);unmount();
  await act(async()=>{profileDone(saved);restaurantDone({id:'r1',name:'Old',address:'',has_menu:true,has_reviews:true});window.dispatchEvent(new Event('wg:profile'));});
  expect(container.childElementCount).toBe(0);expect(load).toHaveBeenCalledTimes(1);
});
it('[manual] SHELL-R05 metadata failures leave navigation and recovery dialogs usable',async()=>{
  localStorage.setItem('wg.profileId','p1');vi.spyOn(api,'getProfile').mockRejectedValue(new Error('offline'));vi.spyOn(api,'restaurant').mockRejectedValue(new Error('offline'));
  render(<AppShell><p>Results</p></AppShell>);await act(async()=>{});
  expect(screen.queryByLabelText('Profile set')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/My profile/}));
  expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load');
  fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));expect(screen.queryByRole('dialog')).toBeNull();
});
