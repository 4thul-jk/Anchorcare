import {sandboxChoices, type Choice} from './povChoices';
export function sceneGroups(room:string,done:string[]){
 const definitions:Record<string,Array<[string,string,string,RegExp]>>={
  bedroom:[['table','Bedside table','👓',/glasses/]],
  kitchen:[['meal','Dining table','☕',/breakfast|lunch|eaten|eat today/],['kettle','Kettle','👓',/glasses/]],
  lounge:[['shelf','Bookshelf','👓',/glasses/],['sarah','Sarah / album','♡',/daughter|Sarah/],['david','David','✦',/physio/],['sam','Sam / music','♫',/album2|evening/],['colour','Colour cards','◆',/color_|colour/]],
  garden:[['sam','Sam / plants','♧',/garden/]],
  cafe:[['support','Ask for help','☎',/lost|contact|Not yet/]]
 };
 const remaining=[...sandboxChoices(room,done)];
 const groups=(definitions[room]||[]).map(([key,title,icon,pattern])=>{
  const choices=remaining.filter(c=>pattern.test(c.action||c.question||c.label));
  for(const c of choices)remaining.splice(remaining.indexOf(c),1);
  return {key,title,icon,choices};
 });
 groups.push({key:'jhonny',title:'Jhonny',icon:'✧',choices:remaining});
 return groups.filter(g=>g.choices.length);
}
