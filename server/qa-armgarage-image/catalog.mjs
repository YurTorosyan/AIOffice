/** Versioned acceptance dataset, not a production service price list. */
export const services=[
 {id:'computer-diagnostics',category:'diagnostics',name:'Компьютерная диагностика',price:12000,minutes:45},
 {id:'full-inspection',category:'diagnostics',name:'Комплексный осмотр',price:25000,minutes:90},
 {id:'oil-change',category:'maintenance',name:'Замена масла',price:18000,minutes:60},
 {id:'engine-service',category:'maintenance',name:'Обслуживание двигателя',price:30000,minutes:120},
 {id:'brake-service',category:'brakes-suspension',name:'Обслуживание тормозов',price:22000,minutes:90},
 {id:'suspension-check',category:'brakes-suspension',name:'Проверка подвески',price:15000,minutes:60},
 {id:'battery-check',category:'electrical',name:'Проверка аккумулятора',price:8000,minutes:30},
 {id:'electrical-diagnostics',category:'electrical',name:'Диагностика электрики',price:20000,minutes:75},
];
export const vehicleFactors={car:1,crossover:1.15,suv:1.3};
export function expectedQuote(ids,vehicle='car',urgent=false){const selected=[...new Set(ids)].map(id=>{const service=services.find(s=>s.id===id);if(!service)throw Error('Unknown acceptance service');return service;});if(!Object.hasOwn(vehicleFactors,vehicle))throw Error('Unknown acceptance vehicle');const subtotal=selected.reduce((n,s)=>n+s.price,0);return {subtotal,total:Math.round(subtotal*vehicleFactors[vehicle]*(urgent?1.2:1)),minutes:selected.reduce((n,s)=>n+s.minutes,0)};}
