import {expect,it} from 'vitest';
import type {Dish} from '../src/menu/schema';
import {scoreMenu,a2Passes} from '../src/validation/score';
import {precisionRecall} from '../src/validation/coverage';
import {clopperPearson,clusterBootstrap} from '../src/validation/stats';
import {judgeA1,judgeA2,judgeA3} from '../src/validation/verdict';
const dish=(name:string,price:number|null=10):Dish=>({name,price,section:'',description:null,tags:[]});
it('[manual] SCORE-R01 empty truth/extractions have finite zero accuracy',()=>{
 expect(scoreMenu([],[])).toMatchObject({correct:0,invented:0,missed:0,accuracy:0});
 expect(scoreMenu([dish('Soup')],[])).toMatchObject({invented:1,accuracy:0});
 expect(scoreMenu([],[dish('Soup')])).toMatchObject({missed:1,accuracy:0});
});
it('[manual] SCORE-R02 duplicate predictions cannot receive repeated credit',()=>{
 expect(scoreMenu([dish('Soup'),dish('Soup')],[dish('Soup')])).toMatchObject({correct:1,invented:1,accuracy:1});
 expect(precisionRecall([{source_id:'r',dish:'Soup'},{source_id:'r',dish:'Soup'}],[{source_id:'r',dish:'Soup'}])).toEqual({tp:1,fp:1,fn:0,precision:0.5,recall:1});
});
it('[manual] SCORE-R03 competing fuzzy matches consume each prediction at most once',()=>{
 expect(scoreMenu([dish('Pork Dumpling')],[dish('Pork Dumpling'),dish('Pork Dumplings')])).toMatchObject({correct:1,missed:1,invented:0});
});
it('[manual] SCORE-R04 unknown prices agree only with unknown prices',()=>{
 expect(scoreMenu([dish('Soup',null)],[dish('Soup',null)])).toMatchObject({correct:1,wrongPrice:0});
 expect(scoreMenu([dish('Soup',null)],[dish('Soup',10)])).toMatchObject({correct:0,wrongPrice:1});
 expect(scoreMenu([dish('Soup',10)],[dish('Soup',null)])).toMatchObject({correct:0,wrongPrice:1});
});
it('[manual] SCORE-R05 exactly 120 seconds fails; exactly 90 percent lower bound passes',()=>{
 expect(a2Passes({accuracy:1,invented:0,seconds:120,manualFixes:0})).toBe(false);
 expect(judgeA2({passed:8,n:10,bootstrapLo:0.9}).pass).toBe(true);
});
it('[manual] SCORE-R06 zero denominators are finite and cannot pass validation',()=>{
 expect(precisionRecall([],[])).toEqual({tp:0,fp:0,fn:0,precision:0,recall:0});
 expect(clopperPearson(0,0)).toEqual([0,1]);
 const boot=clusterBootstrap([{correct:0,total:0}],{resamples:10});expect(boot).toEqual({lo:0,hi:0,samples:Array(10).fill(0)});
 const judgements=[judgeA1(0,0),judgeA2({passed:0,n:0,bootstrapLo:1}),judgeA3(0,0)];
 expect(judgements.every(j=>!j.pass)).toBe(true);expect(judgements.map(j=>j.summary).join(' ')).not.toMatch(/NaN|Infinity/);
});
