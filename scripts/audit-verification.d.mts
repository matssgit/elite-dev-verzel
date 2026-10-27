export function canonical(value:unknown):string;
export function hash(value:unknown):string;
export function fingerprint(pem:string):string;
export function verifyTransition(value:unknown,legacyPin:string,manifestPin:string):import('../packages/shared/src/index.js').AuditTransition;
export function verifyReport(value:unknown,legacyPin:string,manifestPin?:string):{events:number;activeFingerprint:string;transitionHash:string|null};
export function verifySigningProof(value:unknown,transition:import('../packages/shared/src/index.js').AuditTransition):boolean;
