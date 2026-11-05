// Manually reviewed and refined by the user. No model/network calls are made.
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {z} from 'zod';
import type {LlmMessage} from '../src/llm/types';
const mocks=vi.hoisted(()=>({parse:vi.fn(),query:vi.fn(),construct:vi.fn()}));
vi.mock('@anthropic-ai/sdk',()=>({default:class {beta={messages:{parse:mocks.parse}};constructor(opts:unknown){mocks.construct(opts);}}}));
vi.mock('@anthropic-ai/claude-agent-sdk',()=>({query:mocks.query}));
import {anthropicLlm,MODEL} from '../src/llm/anthropic';
import {runWithSubscription} from '../scripts/subscription-bridge';
const schema=z.object({picks:z.array(z.string())});
const messages:LlmMessage[]=[{role:'user' as const,content:[{type:'text' as const,text:'Read menu'},{type:'image' as const,mediaType:'image/png',data:'aW1n'},{type:'pdf' as const,data:'cGRm'}]}];
const request={task:'recommend',system:'system instruction',messages,schema,effort:'low' as const};
const bridge={task:'recommend',model:MODEL,system:'system instruction',messages,jsonSchema:{type:'object'},effort:'low' as const};
const usage={input_tokens:10,output_tokens:5,cache_read_input_tokens:7,cache_creation_input_tokens:3};
const result={type:'result',subtype:'success',is_error:false,result:'raw text',structured_output:{picks:['Noodles']},usage};
const stream=(items:unknown[])=>(async function*(){for(const item of items)yield item;})();
beforeEach(()=>vi.clearAllMocks());afterEach(()=>vi.unstubAllEnvs());
describe('LLM adapter boundaries',()=>{
 it('[ai] Anthropic SDK receives caller cancellation as request options',async()=>{
  mocks.parse.mockResolvedValue({content:[],parsed_output:{picks:[]},usage,stop_reason:'end_turn'});
  const controller=new AbortController();
  await anthropicLlm().json({...request,signal:controller.signal});
  expect(mocks.parse).toHaveBeenCalledWith(expect.any(Object),{signal:controller.signal});
 });
 it('[manual] ADAPTER-R01 Anthropic SDK receives model, schema, system, effort and image/PDF blocks',async()=>{
  mocks.parse.mockResolvedValue({content:[{type:'text',text:'{"picks":["Noodles"]}'}],parsed_output:{picks:['Noodles']},usage,stop_reason:'end_turn'});
  const out=await anthropicLlm({apiKey:'test-only'}).json(request);
  expect(mocks.construct).toHaveBeenCalledWith({apiKey:'test-only',fetch:undefined});
  expect(mocks.parse).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({model:MODEL,system:request.system,max_tokens:16000,output_config:expect.objectContaining({effort:'low',format:expect.objectContaining({type:'json_schema',schema:expect.objectContaining({type:'object'})})}),messages:[{role:'user',content:[{type:'text',text:'Read menu'},{type:'image',source:{type:'base64',media_type:'image/png',data:'aW1n'}},{type:'document',source:{type:'base64',media_type:'application/pdf',data:'cGRm'}}]}]}));
  expect(out).toMatchObject({data:{picks:['Noodles']},usage:{input_tokens:20,output_tokens:5}});
 });
 it.each(['refusal','missing'])('[manual] ADAPTER-R02 %s output cannot be treated as parsed picks',async mode=>{
  mocks.parse.mockResolvedValue({content:[{type:'text',text:'No answer'}],parsed_output:null,usage,stop_reason:mode==='refusal'?'refusal':'end_turn'});
  expect(await anthropicLlm().json(request)).toMatchObject({data:null,raw:mode==='refusal'?'REFUSED: No answer':'No answer'});
 });
 it('[manual] ADAPTER-R03 SDK error reaches caller',async()=>{
  mocks.parse.mockRejectedValue(new Error('SDK unavailable'));
  await expect(anthropicLlm().json(request)).rejects.toThrow('SDK unavailable');
 });
 it('[manual] ADAPTER-R04 subscription SDK receives the same model and isolation options and sums cache tokens',async()=>{
  vi.stubEnv('ANTHROPIC_API_KEY','test-key-must-be-removed');
  mocks.query.mockReturnValue(stream([{type:'assistant'},result]));
  expect(await runWithSubscription(bridge)).toEqual({data:result.structured_output,raw:JSON.stringify(result.structured_output),usage:{input_tokens:20,output_tokens:5}});
  const invocation=mocks.query.mock.calls[0][0];
  expect(invocation.options).toMatchObject({model:MODEL,systemPrompt:bridge.system,tools:[],settingSources:[],strictMcpConfig:true,persistSession:false,effort:'low',outputFormat:{type:'json_schema',schema:bridge.jsonSchema}});
  expect(invocation.options.env).not.toHaveProperty('ANTHROPIC_API_KEY');
  const turns=[];for await(const turn of invocation.prompt)turns.push(turn);
  expect(turns).toHaveLength(1);expect(turns[0].message.content.map((b:{type:string})=>b.type)).toEqual(['text','image','document']);
 });
 it.each([
  {name:'error flag',events:[{...result,is_error:true,result:'login required'}],error:'login required'},
  {name:'failed subtype',events:[{...result,subtype:'error_max_turns'}],error:'Model run failed: error_max_turns'},
  {name:'no result',events:[{type:'assistant'}],error:'ended without a result'},
 ])('[manual] ADAPTER-R05 subscription $name throws',async({events,error})=>{
  mocks.query.mockReturnValue(stream(events));await expect(runWithSubscription(bridge)).rejects.toThrow(error);
 });
 it('[manual] ADAPTER-R06 absent structured output returns null and retains raw result',async()=>{
  mocks.query.mockReturnValue(stream([{...result,structured_output:undefined}]));
  expect(await runWithSubscription(bridge)).toMatchObject({data:null,raw:'raw text'});
 });
});

it('[manual] ADAPTER-R07 disconnected caller aborts the subscription SDK controller',async()=>{
 const controller=new AbortController();
 mocks.query.mockReturnValue(stream([result]));
 controller.abort();await runWithSubscription(bridge,controller.signal);
 expect(mocks.query.mock.calls[0][0].options.abortController.signal.aborted).toBe(true);
});
