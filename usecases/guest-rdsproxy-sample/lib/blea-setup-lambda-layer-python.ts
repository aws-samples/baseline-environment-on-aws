import * as path from 'path';
import * as childProcess from 'child_process';

export function setupLambdaLayerPython() {
  const layerDir = path.resolve(__dirname, '..', 'lambda', 'python', 'layer', 'python');
  childProcess.execSync(`pip install pg8000 --target=${layerDir}`);
  return layerDir;
}
