import type { AuditReport } from '@elite/shared';
export function AuditTrust({report}:{report:AuditReport}) {
  if(!report.transition)return <p>A chave histórica é considerada potencialmente comprometida. Assinaturas válidas não garantem retroativamente a origem legítima dos registros.</p>;
  const boundary=report.transition.boundaries.find(b=>b.auctionId===report.auctionId);
  return <aside>
    <p className="error">A chave histórica é potencialmente comprometida. A transição preserva o estado observado; não comprova retroativamente a autenticidade dos eventos antigos.</p>
    <dl><dt>Chave ativa</dt><dd>{report.activeFingerprint}</dd><dt>Hash do manifesto (confirme por canal independente)</dt><dd>{report.transitionHash}</dd><dt>Fronteira deste lote</dt><dd>{boundary?`Evento #${boundary.sequence} · ${boundary.hash}`:'Lote posterior à transição: exige chave ativa desde a abertura.'}</dd></dl>
    <details><summary>Chaves públicas e identificação das assinaturas</summary>{report.keyring?.map(key=><section key={key.fingerprint}><p>{key.status==='active'?'Chave ativa':'Chave histórica potencialmente comprometida'} · {key.fingerprint}</p><pre>{key.publicKey}</pre></section>)}<pre>{JSON.stringify(report.signatureKeys,null,2)}</pre></details>
  </aside>;
}
