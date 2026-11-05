// @vitest-environment jsdom
// Existing refinements attributed to manual work per the user's review.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResultsView } from "../components/ResultsView";
import { api, API_URL, profileStore, type Picks } from "../lib/api";
const pick = (name: string, reason: string | null) => ({ dishId: name, name, price: 10, reason, quotes: reason ? [`${name} is great`] : [], mentionCount: 3, flags: [], labels: [] });
const result = (name: string, mode: 'llm' | 'fallback' = 'llm'): Picks => ({mode, picks:[pick(name, mode === 'llm' ? `Choose ${name}` : null)], explanation:null, recommendationId: mode === 'llm' ? 'rec1' : undefined});
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((a,b) => {resolve=a;reject=b;}); return {promise, resolve, reject}; }
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
describe('US-14 recommendation request lifecycle', () => {
  it('[manual] US14-R01 fallback appears first and validated picks replace it', async () => {
    const model = deferred<Picks>();
    vi.spyOn(api,'fallback').mockResolvedValue(result('Plain A','fallback'));
    vi.spyOn(api,'recommend').mockReturnValue(model.promise);
    render(<ResultsView restaurantId="r1" profileId="p1" />);
    await screen.findByText('Plain A');
    expect(screen.getByTestId('results').dataset.mode).toBe('fallback');
    await act(async () => model.resolve(result('Smart A')));
    expect(screen.queryByText('Plain A')).toBeNull();
    expect(screen.getByText('Choose Smart A')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Rate this meal later'}).getAttribute('href')).toBe('/rate/?rec=rec1');
  });
  it('[manual] US14-R02 successful empty results show explanation, not a request error', async () => {
    const empty: Picks = {mode:'none',picks:[],explanation:'No dishes on this menu fit your profile.'};
    vi.spyOn(api,'fallback').mockResolvedValue(empty); vi.spyOn(api,'recommend').mockResolvedValue(empty);
    render(<ResultsView restaurantId="r1" profileId="p1" />);
    await screen.findByText(empty.explanation!);
    expect(screen.getByText('No picks to show.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('[manual] US14-R03 both requests fail; retry resends both and clears the alert', async () => {
    const fb = vi.spyOn(api,'fallback').mockRejectedValueOnce(new Error('fallback unavailable')).mockResolvedValueOnce(result('Recovered','fallback'));
    const model = vi.spyOn(api,'recommend').mockRejectedValueOnce(new Error('model unavailable')).mockResolvedValueOnce(result('Recovered'));
    render(<ResultsView restaurantId="r1" profileId="p1" />);
    expect((await screen.findByRole('alert')).textContent).toContain('model unavailable');
    fireEvent.click(screen.getByRole('button',{name:'Try again'}));
    await screen.findByText('Recovered');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fb).toHaveBeenNthCalledWith(2,'r1','p1'); expect(model).toHaveBeenNthCalledWith(2,'r1','p1');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
  it('[manual] US14-R04 late fallback cannot replace already-rendered model picks', async () => {
    const fb = deferred<Picks>(); vi.spyOn(api,'fallback').mockReturnValue(fb.promise); vi.spyOn(api,'recommend').mockResolvedValue(result('Model'));
    render(<ResultsView restaurantId="r1" profileId="p1" />); await screen.findByText('Model');
    await act(async () => fb.resolve(result('Late fallback','fallback')));
    expect(screen.getByTestId('results').dataset.mode).toBe('llm'); expect(screen.queryByText('Late fallback')).toBeNull();
  });
  it.each(['fallback','recommend'] as const)('[manual] US14-R05 %s failure keeps the successful endpoint usable and finishes loading', async failed => {
    vi.spyOn(api,'fallback').mockImplementation(() => failed === 'fallback' ? Promise.reject(new Error('offline')) : Promise.resolve(result('Available','fallback')));
    vi.spyOn(api,'recommend').mockImplementation(() => failed === 'recommend' ? Promise.reject(new Error('offline')) : Promise.resolve(result('Available')));
    render(<ResultsView restaurantId="r1" profileId="p1" />); await screen.findByText('Available');
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each(['restaurant','profile'] as const)('[manual] US14-R06 %s changes ignore old successes and old failures', async changed => {
    const oldFb = deferred<Picks>(); const oldModel = deferred<Picks>();
    const fb = vi.spyOn(api,'fallback').mockReturnValueOnce(oldFb.promise).mockResolvedValueOnce(result('Current','fallback'));
    const model = vi.spyOn(api,'recommend').mockReturnValueOnce(oldModel.promise).mockResolvedValueOnce(result('Current'));
    const {rerender} = render(<ResultsView restaurantId="r1" profileId="p1" />);
    const r = changed === 'restaurant' ? 'r2' : 'r1'; const p = changed === 'profile' ? 'p2' : 'p1';
    rerender(<ResultsView restaurantId={r} profileId={p} />); await screen.findByText('Current');
    await act(async () => {oldFb.resolve(result('Obsolete','fallback'));oldModel.reject(new Error('old error'));});
    expect(screen.queryByText('Obsolete')).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
    expect(fb).toHaveBeenLastCalledWith(r,p); expect(model).toHaveBeenLastCalledWith(r,p);
  });
  it('[manual] US14-R07 unmount ignores pending completion', async () => {
    const fb = deferred<Picks>(); const model = deferred<Picks>();
    vi.spyOn(api,'fallback').mockReturnValue(fb.promise); vi.spyOn(api,'recommend').mockReturnValue(model.promise);
    const {unmount,container} = render(<ResultsView restaurantId="r1" profileId="p1" />); unmount();
    await act(async () => {fb.resolve(result('Old','fallback'));model.resolve(result('Old'));});
    expect(container.childElementCount).toBe(0);
  });
});
describe('US-14 client and browser storage contracts', () => {
  it('[manual] US14-C01 profile POST includes exact JSON and Content-Type', async () => {
    const spy = vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({id:'p9'}));
    const profile = {allergies:['peanut'],diets:['vegan'],budget:18.5,tastes:['spicy'],notes:'No cilantro'};
    expect(await api.createProfile(profile)).toEqual({id:'p9'});
    expect(spy).toHaveBeenCalledExactlyOnceWith(`${API_URL}/profiles`,{method:'POST',body:JSON.stringify(profile),headers:{'content-type':'application/json'}});
  });
  it.each([
    {name:'JSON', body:JSON.stringify({error:'profile missing'}), status:404, statusText:'Not Found', expected:'profile missing'},
    {name:'plain text',body:'upstream failed',status:502,statusText:'Bad Gateway',expected:'Bad Gateway'},
    {name:'malformed JSON',body:'{',status:503,statusText:'Service Unavailable',expected:'Service Unavailable'},
  ])('[manual] US14-C02 $name errors retain a usable message', async c => {
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(c.body,{status:c.status,statusText:c.statusText}));
    await expect(api.restaurant('missing')).rejects.toThrow(c.expected);
  });
  it('[manual] US14-C03 blocked getItem returns null', () => {
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => {throw new Error('blocked read');});
    expect(profileStore.get()).toBeNull();
  });
  it('[manual] US14-C04 blocked setItem does not throw or overwrite persisted ID', () => {
    localStorage.setItem('wg.profileId','old');
    const write = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('blocked write');});
    expect(() => profileStore.set('new')).not.toThrow(); expect(write).toHaveBeenCalledWith('wg.profileId','new');
    expect(profileStore.get()).toBe('old');
  });
});
