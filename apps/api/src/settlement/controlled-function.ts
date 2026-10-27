import scheduled from './function.js';
import { controlledDemo } from './controlled-demo.js';
export default {fetch(request:Request):Promise<Response>{
  if(new URL(request.url).pathname==='/controlled-demo-settlement')return controlledDemo(request);
  return scheduled.fetch(request);
}};
