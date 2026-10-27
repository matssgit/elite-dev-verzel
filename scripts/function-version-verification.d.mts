type Version={buildId:string;runId:string;protocol:string};
export function classifyFunctionResponse(row:{status:number;buildId:string|null;runId:string|null;protocol:string|null;version?:Version},expected:{buildId:string;runId:string}):'UNEXPECTED_VERSION'|'INCONSISTENT_PROVENANCE'|'AUTH_REJECTED'|'CURRENT_ACCEPTED'|'CURRENT_ERROR';
