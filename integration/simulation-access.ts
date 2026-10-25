export function publicSimulationOrigin(env:NodeJS.ProcessEnv=process.env):string|null{
 if(env.PUBLIC_SIMULATION!=='true')return null;
 const value=env.PUBLIC_SIMULATION_ORIGIN||env.RENDER_EXTERNAL_URL;
 if(!value)throw Error('Public simulation requires its HTTPS origin.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Public simulation origin must be an HTTPS origin without a path.');
 return url.origin;
}
