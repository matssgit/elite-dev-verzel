type Deployment={id:number;status:string;created_at?:string;runtime?:string};
type FunctionRow={slug:string;invocation_url:string;current_deployment?:Deployment;active_deployment?:Deployment};
type Metadata={slug:string;url:string;current:{id:number;status:string;createdAt?:string;runtime?:string}|null;active:{id:number;status:string;createdAt?:string;runtime?:string}|null};
export function deploymentMetadata(rows:FunctionRow[]):Metadata;
export function waitForActiveDeployment(read:()=>Promise<FunctionRow[]>,options:{previousId:number;url:string;observe?:(m:Metadata)=>Promise<void>;timeoutMs?:number;pause?:()=>Promise<void>}):Promise<Metadata>;
