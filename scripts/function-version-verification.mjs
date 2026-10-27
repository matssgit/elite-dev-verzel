export function classifyFunctionResponse(row,expected){
  if(row.buildId!==expected.buildId||row.runId!==expected.runId||row.protocol!=='elite-function/v2')return 'UNEXPECTED_VERSION';
  if(row.version&&(row.version.buildId!==row.buildId||row.version.runId!==row.runId||row.version.protocol!==row.protocol))return 'INCONSISTENT_PROVENANCE';
  if(row.status===401||row.status===403)return 'AUTH_REJECTED';
  if(row.status===200)return row.version?'CURRENT_ACCEPTED':'INCONSISTENT_PROVENANCE';
  return 'CURRENT_ERROR';
}
