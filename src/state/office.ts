import { configuration, team, taskTitles } from '../config.ts';
import { statuses, type OfficeState, type AgentUpdate, type AgentStatus } from '../domain.ts';
const initialStatuses: AgentStatus[] = ['Working','Thinking','Working','Reviewing','Completed','Error','Testing','Waiting'];
export const statusActivity: Record<AgentStatus,string> = { Working:'Работает над задачей', Thinking:'Обдумывает решение', Waiting:'Ожидает следующий шаг', Reviewing:'Проверяет материалы', Testing:'Запускает проверки', Idle:'Готов к новой задаче', Error:'Требуется внимание', Completed:'Задача завершена' };
export function createOffice(now = new Date().toISOString()): OfficeState {
  const agents = team.map(([id,role,name,color,hair,skin], i) => ({id,role,name,color,hair,skin,status:initialStatuses[i],currentTask:`task-${id}`,progress:i===4?100:20+i*8,activity:statusActivity[initialStatuses[i]]}));
  return {agents,tasks:agents.map((agent,i)=>({id:agent.currentTask,title:taskTitles[i],description:`Демонстрационная задача проекта AI Office. Ответственный: ${agent.role}.`,status:agent.status,assignedAgent:agent.id,startedAt:now,completedAt:agent.status==='Completed'?now:null})), projects:[{id:configuration.projectId,name:'AI Office',repository:null,status:'demo',agents:agents.map(a=>a.id)}],activity:agents.map((a,i)=>({id:`initial-${i}`,agentId:a.id,message:`${a.role} · ${a.activity.toLowerCase()}`,timestamp:now,status:a.status,source:'mock' as const})).reverse()};
}
export function applyUpdate(state:OfficeState,event:AgentUpdate):OfficeState {
  const agent = state.agents.find(a=>a.id===event.agentId);
  if (!agent || !statuses.includes(event.status) || !Number.isFinite(event.progress) || !Number.isFinite(Date.parse(event.timestamp))) return state;
  const progress = event.status==='Completed'?100:Math.max(0,Math.min(99,event.progress));
  return {...state,agents:state.agents.map(a=>a.id===event.agentId?{...a,status:event.status,progress,activity:statusActivity[event.status]}:a),tasks:state.tasks.map(t=>t.id===agent.currentTask?{...t,status:event.status,startedAt:t.startedAt??event.timestamp,completedAt:event.status==='Completed'?event.timestamp:null}:t),activity:[{id:event.id,agentId:agent.id,message:`${agent.role} · ${statusActivity[event.status].toLowerCase()}`,timestamp:event.timestamp,status:event.status,source:'mock' as const},...state.activity].slice(0,configuration.activityLimit)};
}
export function metrics(state:OfficeState) { return {active:state.agents.filter(a=>['Working','Thinking','Reviewing','Testing'].includes(a.status)).length,total:state.tasks.length,completed:state.tasks.filter(t=>t.status==='Completed').length,inProgress:state.tasks.filter(t=>!['Idle','Waiting','Completed','Error'].includes(t.status)).length,errors:state.tasks.filter(t=>t.status==='Error').length}; }
