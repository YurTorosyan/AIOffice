export interface DesignDraft {version:1;html:string;css:string;assetIds:string[]}
/** Draft is untrusted data, never Node code or a shell command. Browser JS is also disabled. */
export function validateDraft(value:unknown,allowedAssets?:string[]):DesignDraft{
 const d=value as DesignDraft;
 if(!d||Object.keys(d).sort().join(',')!=='assetIds,css,html,version'||d.version!==1||typeof d.html!=='string'||typeof d.css!=='string'||!d.html.trim()||d.html.length+d.css.length>200000||!Array.isArray(d.assetIds)||d.assetIds.length>8||new Set(d.assetIds).size!==d.assetIds.length||d.assetIds.some(id=>!/^[a-f0-9]{64}$/.test(id)||allowedAssets&&!allowedAssets.includes(id)))throw Error('Invalid bounded design draft');
 if(/<\//.test(d.css)||/\b(?:srcset|style)\s*=/i.test(d.html)||/<\s*style\b/i.test(d.html))throw Error('Embedded style markup forbidden');
 const source=d.html+'\n'+d.css;
 for(const m of d.html.matchAll(/href\s*=\s*["']([^"']*)/gi))if(!/^#[a-zA-Z0-9_-]*$/.test(m[1]))throw Error('Only local fragment links allowed');
 if(/<\s*(?:script|iframe|object|embed|link|form|base|meta|svg|math|audio|video|source)\b|\bon[a-z]+\s*=|javascript\s*:|@import|https?\s*:|file\s*:|\/\//i.test(source)||/[\\]/.test(source))throw Error('Executable or external draft content forbidden');
 for(const match of source.matchAll(/(?:src\s*=\s*["']|url\(\s*["']?)([^"')\s>]+)/gi)){if(!/^asset:[a-f0-9]{64}$/.test(match[1])||!d.assetIds.includes(match[1].slice(6)))throw Error('Draft resources must be registered assets');}
 for(const match of source.matchAll(/asset:([a-f0-9]{64})/g))if(!d.assetIds.includes(match[1]))throw Error('Undeclared draft asset');
 return d;
}
