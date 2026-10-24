// Normalise common possessive spellings and a small explicit typo vocabulary, without fuzzy matching identities.
const corrections:Record<string,string>={daugher:'daughter',daughers:'daughter',daugther:'daughter',daugthers:'daughter',daughtr:'daughter',daughtrs:'daughter',duaghter:'daughter',duaghters:'daughter',doughter:'daughter',daughters:'daughter',sons:'son',mothers:'mother',fathers:'father',wives:'wife',husbands:'husband',sisters:'sister',brothers:'brother',granddaughters:'granddaughter',grandsons:'grandson',caregivers:'caregiver'};
export function normaliseRecallQuery(value:string){
 return value.toLowerCase().replace(/\u2019/g,"'").replace(/\b(who|what|where|when|how)'s\b/g,'$1 is').replace(/\b([\p{L}]+)'s\b/gu,'$1').replace(/[\p{L}]+/gu,word=>corrections[word]||word).replace(/\s+/g,' ').trim();
}
export function queryWords(value:string){return new Set(normaliseRecallQuery(value).match(/[\p{L}\p{N}]+/gu)||[]);}
