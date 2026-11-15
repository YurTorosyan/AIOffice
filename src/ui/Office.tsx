import type { AgentView as Agent } from './presentation.ts';

export const statusColors: Record<Agent['status'], string> = {
 Working:'#7ce744', Thinking:'#ffab39', Waiting:'#b7bdd4', Reviewing:'#c4a4ff',
 Testing:'#32c9ef', Idle:'#9aa4be', Error:'#ff777b', Completed:'#7ce744',
};
// Presentation-only atlas order. Existing employee IDs, roles and state are not changed.
export const employeeArtwork = ['lead','design','frontend','backend','seo','security','qa','review'] as const;
export const officeArtwork = {
 room:'/art/room.svg', workstation:'/art/workstation.svg', employees:'/art/employees.svg',
 columns:4, rows:2, cellWidth:384, cellHeight:512,
} as const;

export function Character({agent,large=false}:{agent:Agent;large?:boolean}) {
 const cell=Math.max(0,employeeArtwork.findIndex(id=>id===agent.id));
 const x=-(cell%4)*384, y=-Math.floor(cell/4)*512;
 const clipId=`art-${agent.id}-${large?'portrait':'scene'}`;
 const sprite=<image href={officeArtwork.employees} x={x} y={y} width="1536" height="1024"/>;
 return <svg width={large?128:176} height={large?136:235} viewBox={large?'0 20 384 380':'0 0 384 512'}
  className={`character status-${agent.status}`} aria-hidden="true" overflow="hidden" data-art-cell={cell}>
  <defs>
   <clipPath id={`${clipId}-body`}><rect width="384" height="402"/></clipPath>
   <clipPath id={`${clipId}-paws`}><rect y="400" width="384" height="112"/></clipPath>
  </defs>
  <g className="person">
   <g clipPath={`url(#${clipId}-body)`}>{sprite}</g>
   <g clipPath={`url(#${clipId}-paws)`}><g className="hands">{sprite}</g></g>
  </g>
 </svg>;
}

const activitySymbols:Record<Agent['status'],string>={Working:'⌨',Thinking:'···',Waiting:'☕',Reviewing:'≡',Testing:'✓',Idle:'z',Error:'!',Completed:'★'};
export function Office({agents,selected,onSelect,tasks,runtimeStates,runtimeSource='codex'}:{agents:Agent[];selected:string;onSelect:(id:string)=>void;tasks:Record<string,string>;runtimeStates?:Record<string,{connection:string;execution:string}>;runtimeSource?:'mock'|'codex'}) {
 return <svg className="office-scene illustrated-office" viewBox="0 0 1600 1000" role="group" aria-label="Пиксельный офис: восемь рабочих мест">
  <defs>
   {/* The desk is a separate painted asset. Foreground masks put monitors and desktop in front of the employee. */}
   <clipPath id="desk-foreground">
    <rect y="140" width="360" height="120"/>
    <rect x="0" y="54" width="127" height="88"/>
    <rect x="253" y="54" width="107" height="88"/>
   </clipPath>
  </defs>
  <g role="img" aria-label="Ереван: Большой и Малый Арарат вдали; Каскад, Опера и башня площади Республики; Мать Армения на возвышенности парка Победы">
   <image href={officeArtwork.room} width="1600" height="1000" preserveAspectRatio="none"/>
  </g>
  {agents.map((agent,i)=>{
   const x=28+(i%4)*396, y=255+Math.floor(i/4)*260;
   const connection=runtimeStates?.[agent.id];
   const title=agent.currentTask?tasks[agent.currentTask]:'Нет активной задачи';
   return <g key={agent.id} transform={`translate(${x} ${y})`}
    className={`workstation ${selected===agent.id?'selected':''}`}>
    <title>{`${agent.name} · ${agent.role}: ${title}`}</title>
    <rect className="selection" x="-8" y="-88" width="376" height="343" rx="9" fill="#29c6ff" fillOpacity=".035" stroke="#55d4ff" strokeWidth="2"/>
    <ellipse cx="180" cy="236" rx="167" ry="16" fill="#251d34" opacity=".2"/>
    <image href={officeArtwork.workstation} width="360" height="260" preserveAspectRatio="none"/>
    <g transform="translate(92 -85)"><Character agent={agent}/></g>
    <g clipPath="url(#desk-foreground)"><image href={officeArtwork.workstation} width="360" height="260" preserveAspectRatio="none"/></g>
    {/* Role, status and progress remain live text/shapes rather than baked into the illustration. */}
    <rect x="98" y="159" width="164" height="15" rx="2" fill="#212134"/>
    <circle cx="108" cy="166" r="4.5" fill={statusColors[agent.status]}/>
    <text x="123" y="170" fill="#f6f0e5" fontSize="12.5" fontWeight="600">{agent.role}</text>
    {agent.currentTask&&<g aria-label={`Прогресс: ${agent.progressIndeterminate?'не определён':agent.progress+'%'}`}><rect x="99" y="177" width="162" height="3" rx="1.5" fill="#38384c"/><rect className={agent.progressIndeterminate?'desk-progress-indeterminate':''} x="99" y="177" width={agent.progressIndeterminate?45:162*agent.progress/100} height="3" rx="1.5" fill={statusColors[agent.status]}/></g>}
    <g className={`bubble bubble-${agent.status}`} transform="translate(284 -51)" aria-hidden="true">
     <rect width="45" height="27" rx="6" fill="#1d2338" fillOpacity=".94" stroke={statusColors[agent.status]} strokeOpacity=".55"/>
     <path d="M8 27V33L16 27" fill="#1d2338"/><text x="22.5" y="19" textAnchor="middle" fill={statusColors[agent.status]} fontSize="16">{connection?.execution==='paused'?'Ⅱ':activitySymbols[agent.status]}</text>
    </g>
    {connection&&<g className="desk-connection" aria-hidden="true"><rect x="103" y="183" width="154" height="15" rx="4" fill="#182034" fillOpacity=".9"/><circle cx="111" cy="190.5" r="3" fill={connection.connection==='connected'?'#7ce744':connection.connection==='error'?'#ff777b':'#9aa4be'}/><text x="120" y="194" fontSize="9" fill="#d5def3">{runtimeSource==='mock'?'MOCK':'Codex'} · {connection.connection} {connection.execution==='paused'?'· Paused':''}</text></g>}
    <path className="workstation-target" d="M80-75H280V54H360V240H0V54H80Z" fill="transparent"
     role="button" tabIndex={0} aria-label={`${agent.role}, ${agent.status}, ${title}`} aria-pressed={selected===agent.id}
     onClick={()=>onSelect(agent.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(agent.id);}}}/>
   </g>;
  })}
 </svg>;
}
