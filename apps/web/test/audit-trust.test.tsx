import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import type {AuditReport} from '@elite/shared';
import {AuditTrust} from '../src/audit-trust';
const report:AuditReport={auctionId:'fixture',status:'INTEGRO',issues:[],records:[],checkpoints:[],publicKey:'public-fixture',fingerprint:'389b505e9330eaf660ace80f9d3f352375ccf9a03c2475621753810fbba496eb',legacyBaseline:false};
it('does not label an independent new root as a compromised historical key',()=>{
  const html=renderToStaticMarkup(createElement(AuditTrust,{report}));expect(html).toContain('canal independente');expect(html).not.toContain('potencialmente comprometida');
});
it('retains the warning for the known exposed historical root',()=>{
  const html=renderToStaticMarkup(createElement(AuditTrust,{report:{...report,fingerprint:'dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3'}}));expect(html).toContain('potencialmente comprometida');expect(html).toContain('não garantem retroativamente');
});
