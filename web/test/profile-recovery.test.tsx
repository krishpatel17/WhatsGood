// @vitest-environment jsdom
// Existing refinements attributed to manual work per the user's review.
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileForm } from '../components/ProfileForm';
import { api, type Profile } from '../lib/api';
afterEach(() => {cleanup();vi.restoreAllMocks();localStorage.clear();});
it('[manual] PROFILE-R01 first save retains every preference and persists the created ID', async () => {
  const create = vi.spyOn(api,'createProfile').mockResolvedValue({id:'new-profile'});
  const update = vi.spyOn(api,'updateProfile');
  render(<ProfileForm />);
  fireEvent.click(screen.getByRole('checkbox',{name:'peanut'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'vegan'}));
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'22'}});
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'No cilantro'}});
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  await screen.findByRole('status');
  expect(create).toHaveBeenCalledExactlyOnceWith({allergies:['peanut'],diets:['vegan'],budget:22,tastes:[],notes:'No cilantro'});
  expect(localStorage.getItem('wg.profileId')).toBe('new-profile'); expect(update).not.toHaveBeenCalled();
});
it('[manual] PROFILE-R02 failed save retains entered preferences for retry', async () => {
  const create = vi.spyOn(api,'createProfile').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({id:'p1'});
  render(<ProfileForm />);
  fireEvent.click(screen.getByRole('checkbox',{name:'soy'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Keep this note'}});
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t save');
  expect((screen.getByRole('checkbox',{name:'soy'}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Keep this note');
  fireEvent.click(screen.getByRole('button',{name:'Save profile'})); await screen.findByRole('status');
  expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]); expect(screen.queryByRole('alert')).toBeNull();
});
it('[manual] PROFILE-R03 stale stored ID shows load error without silently saving blank defaults', async () => {
  localStorage.setItem('wg.profileId','stale');
  vi.spyOn(api,'getProfile').mockRejectedValue(new Error('not found'));
  const create=vi.spyOn(api,'createProfile'); const update=vi.spyOn(api,'updateProfile');
  render(<ProfileForm />); expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load');
  expect(screen.queryByRole('button',{name:/Save/})).toBeNull();
  expect(screen.getByRole('button',{name:'Try again'})).toBeTruthy();
  expect(create).not.toHaveBeenCalled();expect(update).not.toHaveBeenCalled();expect(localStorage.getItem('wg.profileId')).toBe('stale');
});
it('[manual] PROFILE-R04 in-flight save disables repeated button submissions', async () => {
  let finish!: (v:{id:string})=>void;
  const create=vi.spyOn(api,'createProfile').mockReturnValue(new Promise(r=>{finish=r;}));
  render(<ProfileForm />);fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  const button=screen.getByRole('button',{name:/Saving/}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);fireEvent.click(button);expect(create).toHaveBeenCalledTimes(1);
  await act(async()=>finish({id:'p1'}));await screen.findByRole('status');
});
it('[manual] PROFILE-R05 blocked storage warns instead of claiming the profile was saved', async () => {
  vi.spyOn(api,'createProfile').mockResolvedValue({id:'p1'});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage denied');});
  render(<ProfileForm />);fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:/Saving/})).toBeNull());
  expect(screen.queryByRole('alert')).not.toBeNull();
  expect(screen.queryByText(/^Saved\./)).toBeNull();
});

it('[manual] PROFILE-R06 load failure retries the existing ID and restores preferences', async () => {
  localStorage.setItem('wg.profileId','p1');
  const profile={id:'p1',allergies:['soy'],diets:['vegan'],tastes:['spicy'],budget:19,notes:'Retain all preferences'};
  const load=vi.spyOn(api,'getProfile').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
  render(<ProfileForm />);await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));
  await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(profile.notes));
  expect((screen.getByRole('checkbox',{name:'soy'}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('19');
  expect(load).toHaveBeenNthCalledWith(2,'p1');expect(screen.queryByRole('alert')).toBeNull();
});
it('[manual] PROFILE-R07 storage recovery reuses the created profile instead of creating duplicates', async () => {
  const create=vi.spyOn(api,'createProfile').mockResolvedValue({id:'p1'});
  const update=vi.spyOn(api,'updateProfile').mockResolvedValue({allergies:[],diets:[],tastes:[],budget:null,notes:'Keep'});
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  render(<ProfileForm />);fireEvent.change(screen.getByRole('textbox'),{target:{value:'Keep'}});
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));await screen.findByRole('alert');
  write.mockRestore();fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('status');
  expect(create).toHaveBeenCalledTimes(1);expect(update).toHaveBeenCalledWith('p1',expect.objectContaining({notes:'Keep'}));
  expect(localStorage.getItem('wg.profileId')).toBe('p1');
});
it('[manual] PROFILE-R08 loading a saved profile prevents blank writes; failed update preserves values', async () => {
  localStorage.setItem('wg.profileId','p1');let finish!:(profile:Profile & {id:string})=>void;
  vi.spyOn(api,'getProfile').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const update=vi.spyOn(api,'updateProfile').mockRejectedValue(new Error('offline'));
  render(<ProfileForm />);
  expect((screen.getByRole('button',{name:'Save changes'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));expect(update).not.toHaveBeenCalled();
  await act(async()=>finish({id:'p1',allergies:['soy'],diets:[],tastes:['spicy'],budget:21,notes:'Original'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Edited note'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('alert');
  expect(update).toHaveBeenCalledWith('p1',{allergies:['soy'],diets:[],tastes:['spicy'],budget:21,notes:'Edited note'});
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Edited note');
  expect(localStorage.getItem('wg.profileId')).toBe('p1');
});
