import { auditStore } from './store.js';
const store=await auditStore();
console.log(JSON.stringify({auditStorage:'ready',fingerprint:store.fingerprint}));
export { auditStore, AuditStore } from './store.js';
