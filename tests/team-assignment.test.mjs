import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {employees,validateEmployeeAssignment} from '../server/employee-config.mjs';
const registry=JSON.parse(readFileSync(new URL('../src/agents/registry.json',import.meta.url),'utf8'));
test('runtime required Skills and profiles are actual assignments for all eight unchanged employee IDs',()=>{for(const employee of employees)assert.equal(validateEmployeeAssignment(registry,employee.id),employee);});
test('removed supporting Skill, swapped profile owner and changed primary Skill fail before connecting',()=>{
 for(const mutate of [r=>r.skillAssignments=r.skillAssignments.filter(a=>a.assignedEmployeeId!=='backend'||a.skillId!=='source-driven-development'),r=>r.customAgents.find(p=>p.id==='backend-developer').employeeId='frontend',r=>r.employees.find(e=>e.id==='backend').skillId='frontend-design']){const bad=structuredClone(registry);mutate(bad);assert.throws(()=>validateEmployeeAssignment(bad,'backend'),/assignment/);}
});
