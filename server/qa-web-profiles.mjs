import coffee from './qa-web-image.json' with {type:'json'};
import armgarage from './qa-armgarage-image.json' with {type:'json'};
const profiles=Object.freeze({
 'coffee-house':Object.freeze({name:'coffee-house',profile:'coffee-house-react-v1',image:coffee.image,permission:'web_checks',browser:'Playwright Chromium (sandboxed): Coffee House acceptance at 1440px and 390px'}),
 armgarage:Object.freeze({name:'armgarage',profile:'armgarage-react-v1',image:armgarage.image,permission:'armgarage_checks',browser:'Playwright Chromium (sandboxed): ARMGARAGE filters, calculator, demo booking, privacy and keyboard at 390/768/1440px'}),
});
export function webRegistration(name){if(!Object.hasOwn(profiles,name))throw Error('No registered browser acceptance contract for this project');return profiles[name];}
