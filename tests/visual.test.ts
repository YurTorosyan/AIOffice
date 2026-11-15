import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement,isValidElement,type ComponentType,type ReactElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {createOffice} from '../src/state/office.ts';
import {agentView,type AgentView} from '../src/ui/presentation.ts';
import {statuses} from '../src/domain.ts';
const output=ts.transpileModule(readFileSync(new URL('../src/ui/Office.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
type OfficeProps={agents:AgentView[];selected:string;onSelect:(id:string)=>void;tasks:Record<string,string>};
const moduleExports={} as {Office:(props:OfficeProps)=>ReactElement;Character:ComponentType<{agent:AgentView;large?:boolean}>};
runInNewContext(output,{exports:moduleExports,require:createRequire(import.meta.url)});
const agents=createOffice().agents.map(agentView);
const props:OfficeProps={agents,selected:'lead',onSelect:()=>{},tasks:{}};
function elements(node:ReactNode):ReactElement<Record<string,unknown>>[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!isValidElement<Record<string,unknown>>(node))return [];
 return [node,...elements(node.props.children as ReactNode)];
}
test('redesigned SVG preserves eight named, selectable employees and exactly one selection',()=>{
 const html=renderToStaticMarkup(createElement(moduleExports.Office,props));
 assert.equal((html.match(/role="button"/g)??[]).length,8);
 assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);
 assert.equal((html.match(/tabindex="0"/g)??[]).length,8);
 for(const agent of agents){assert.ok(html.includes(`aria-label="${agent.role}, ${agent.status},`));assert.ok(html.replace(/<!--.*?-->/g,'').includes(`${agent.name} · ${agent.role}`));}
});
test('all workstations preserve click, Enter and Space selection without changing employee data',()=>{
 const selected:string[]=[];const before=JSON.stringify(agents);
 const controls=elements(moduleExports.Office({...props,onSelect:id=>selected.push(id)})).filter(e=>e.props.role==='button');
 for(const [i,control] of controls.entries()){
  (control.props.onClick as ()=>void)();
  for(const key of ['Enter',' ','Escape']){
   let prevented=false;(control.props.onKeyDown as (e:unknown)=>void)({key,preventDefault:()=>{prevented=true;}});
   assert.equal(prevented,key!=='Escape');
  }
  assert.deepEqual(selected.slice(i*3,i*3+3),[agents[i].id,agents[i].id,agents[i].id]);
 }
 assert.equal(JSON.stringify(agents),before);
});
test('approved illustrated layers retain Armenian landmarks and use local self-contained raster artwork',()=>{
 const html=renderToStaticMarkup(createElement(moduleExports.Office,props));
 for(const landmark of ['Большой и Малый Арарат','Мать Армения на возвышенности парка Победы','Каскад, Опера и башня площади Республики'])assert.ok(html.includes(landmark));
 assert.ok(html.includes('/art/room.svg'));assert.ok(html.includes('/art/workstation.svg'));assert.ok(html.includes('/art/employees.svg'));
 assert.doesNotMatch(html,/<foreignObject|https?:/i);
 for(const name of ['room','workstation','employees']){const asset=readFileSync(new URL(`../public/art/${name}.svg`,import.meta.url),'utf8');assert.ok(asset.includes('data:image/png;base64,'));assert.doesNotMatch(asset,/<script|https?:\/\/(?!www.w3.org)/i);}
});
test('all status animations and task labels project supplied state, including safe escaping',()=>{
 for(const status of statuses){
  const agent=agentView({...createOffice().agents[0],status});
  const html=renderToStaticMarkup(createElement(moduleExports.Character,{agent,large:true}));
  assert.ok(html.includes(`status-${agent.status}`));assert.ok(html.includes('class="hands"'));
 }
 const html=renderToStaticMarkup(createElement(moduleExports.Office,{...props,agents:agents.map((a,i)=>i===0?{...a,currentTask:'task-1'}:a),tasks:{'task-1':'<script>private task</script>'}}));
 assert.ok(html.includes('&lt;script&gt;private task&lt;/script&gt;'));assert.doesNotMatch(html,/<script>/);
});

test('all eight employee portraits use distinct stable atlas cells',()=>{
 const cells=agents.map(agent=>renderToStaticMarkup(createElement(moduleExports.Character,{agent})).match(/data-art-cell="(\d+)"/)?.[1]);
 assert.deepEqual(cells,['0','1','2','3','4','5','6','7']);
});
