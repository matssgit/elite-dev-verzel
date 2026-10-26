import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['**/dist/**','**/node_modules/**','tmp/**']},js.configs.recommended,...ts.configs.recommended);
