interface Props {
 mode:'mock'|'codex';connected:number;active:number;maxActive:number;busy:boolean;available:boolean;
 onModeChange:()=>void;onConnect:()=>void;onDisconnect:()=>void;
}

/** Presentation only: all commands keep their existing controller and permission checks. */
export function TeamConnectionCard({mode,connected,active,maxActive,busy,available,onModeChange,onConnect,onDisconnect}:Props){
 return <section className="team-connection-card" aria-label="Подключение команды">
  <div className="connection-copy"><span className="control-eyebrow">QST / TEAM CONTROL</span>
   <h2>Команда под контролем<span className={'control-mode '+mode}><i/>{mode==='mock'?'Демо-режим':'Codex'}</span></h2>
   <p>{mode==='mock'?'Проверяйте работу офиса в безопасной симуляции.':'Подключайте сотрудников и управляйте работой команды.'}</p>
   <div className="connection-actions">
    <button className="control-button control-button--light" disabled={busy||!available} onClick={onConnect}>{mode==='mock'?'Подключить mock-сессии':'Подключить всех'}<span aria-hidden="true">↗</span></button>
    <button className="control-button control-button--ghost" disabled={busy} onClick={onModeChange} aria-label={mode==='mock'?'Codex team →':'← Mock mode'}>{mode==='mock'?'Перейти в Codex':'Открыть демо'}<span aria-hidden="true">⇄</span></button>
    <details className="connection-options"><summary aria-label="Другие действия подключения">···</summary><button disabled={busy||connected===0} onClick={onDisconnect}>Отключить всех</button></details>
   </div>
  </div>
  <div className="connection-metrics">
   <div><span className="connection-metric-icon" aria-hidden="true">♧</span><strong>{connected}<small>/ 8</small></strong><span>Подключено{mode==='mock'?' · mock':''}</span><div className="connection-dots" aria-hidden="true">{Array.from({length:8},(_,i)=><i className={i<connected?'connected':''} key={i}/>)}</div></div>
   <div><span className="connection-metric-icon" aria-hidden="true">◴</span><strong>{active}<small>/ {maxActive}</small></strong><span>Занято слотов</span><small className="connection-metric-note">{active?'Команда выполняет задания':'Нет активных исполнений'}</small></div>
  </div>
 </section>;
}
