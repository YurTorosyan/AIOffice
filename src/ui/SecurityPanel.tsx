import {rolePolicies,securityEmployees} from '../security/policy.ts';
import type {WorkflowClient} from '../orchestration/WorkflowClient.ts';
export function SecurityPanel({client,mode,employeeId}:{client:WorkflowClient;mode:'mock'|'codex';employeeId:string}){
 const policy=rolePolicies[employeeId as keyof typeof rolePolicies],audit=client.security,all=employeeId==='security',events=mode==='codex'?audit.events.filter(e=>all||e.agentId===employeeId):[],records=mode==='codex'?audit.records.filter(r=>all||r.request.agentId===employeeId):[];
 return <details className="office-controls orchestrator-panel"><summary>Security · права и журнал <span>{mode==='mock'?'MOCK · политика':audit.available?'Stage 7':'мост не обновлён'}</span></summary><div className="orchestrator-body">
  <p>Сотрудник: {employeeId} · {all?'Security Engineer видит журнал всей команды':'права выбранного сотрудника'}. По умолчанию доступ запрещён. Роль дополнительно ограничивается файлами текущей задачи.</p>
  <p>Чтение: {policy.read.join(', ')||'проект в пределах задачи'}<br/>Предложения изменений: {policy.write.join(', ')}<br/>Профили команд: {policy.profiles.join(', ')} — требуют отдельной проверки и подтверждения.</p>
  <p>Секреты и повышение системных прав запрещены. Зависимости, сеть и Git-команды заблокированы. QA-тесты требуют отдельного подтверждения и проверенного изолированного исполнителя. Подтверждение не изменяет постоянные права роли.</p>
  {mode==='codex'&&<p>QA executor: {audit.executors?.qaTests?.available?'Доступен · Docker без сети и папок компьютера':`Заблокирован · ${audit.executors?.qaTests?.reason??'мост не обновлён'}`}</p>}
  {mode==='mock'&&<p>Показана политика. Настоящие проверки доступа и журнал работают в режиме Codex через обновлённый мост.</p>}
  {mode==='codex'&&(!audit.available||audit.error)&&<p role="status">{audit.error??'Данные безопасности недоступны. Нужен мост Stage 7.'}</p>}
  {all&&<details><summary>Политики всех {securityEmployees.length} сотрудников</summary><pre>{JSON.stringify(rolePolicies,null,2)}</pre></details>}
  <details><summary>Подтверждения · {records.length}</summary>{records.slice(-20).reverse().map(r=><p key={r.request.id}>{r.request.agentId} · {r.request.taskId} · {r.request.action} · {r.status}<br/>{r.request.resources.join(', ')} · до {new Date(r.expiresAt).toLocaleString('ru-RU')}</p>)}</details>
  <details><summary>Security events · {events.length} · блокировок {events.filter(e=>e.type==='action_denied').length}</summary><ol>{events.slice(-40).reverse().map(e=><li key={e.id}>{new Date(e.timestamp).toLocaleTimeString('ru-RU')} · {e.agentId} · {e.type} · {e.action}<br/>{e.reason} · {e.resources.join(', ')}</li>)}</ol></details>
 </div></details>;
}
