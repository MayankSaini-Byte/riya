/**
 * The document loaded into the playground's sandboxed iframe.
 *
 * The iframe is created with sandbox="allow-scripts" and WITHOUT
 * allow-same-origin, so this document runs in an opaque origin: it cannot read
 * the page's DOM, its cookies, or call /api/* with the admin session. Snippets
 * come from CMS article content, so they must never run in the site's origin.
 *
 * Python runs here too. Pyodide's `import js` bridges to the *sandbox's*
 * window, not the page's, which is exactly why the runtime is loaded in here
 * rather than on the page.
 *
 * Protocol (parent <-> sandbox), all messages tagged so stray postMessage
 * traffic is ignored:
 *   parent -> sandbox  { source:'bm-playground', type:'run'|'preload', id, language, code, inputs }
 *   sandbox -> parent  { source:'bm-playground-sandbox', type:'ready'|'runtime'|'result', ... }
 */

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'

const PYTHON_SETUP = [
  'import sys, io, builtins, js',
  'sys.stdout = io.StringIO()',
  'def custom_input(prompt_text=""):',
  '    if prompt_text:',
  '        print(str(prompt_text), end="")',
  '    res = js.get_stdin_value(str(prompt_text))',
  '    print(res)',
  '    return res',
  'builtins.input = custom_input',
].join('\\n')

export const SANDBOX_ORIGIN_MESSAGE = 'bm-playground-sandbox'
export const PARENT_MESSAGE = 'bm-playground'

export const sandboxDocument = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
(function () {
  var PYODIDE_URL = ${JSON.stringify(PYODIDE_URL)};
  var SETUP = ${JSON.stringify(PYTHON_SETUP)};
  var pyodide = null;
  var pyodidePromise = null;

  function post(message) {
    message.source = ${JSON.stringify(SANDBOX_ORIGIN_MESSAGE)};
    parent.postMessage(message, '*');
  }

  function show(value) {
    try { return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value); }
    catch (error) { return String(value); }
  }

  function loadPyodide_() {
    if (pyodide) return Promise.resolve(pyodide);
    if (pyodidePromise) return pyodidePromise;
    pyodidePromise = new Promise(function (resolve, reject) {
      var tag = document.createElement('script');
      tag.src = PYODIDE_URL + 'pyodide.js';
      tag.onload = function () {
        window.loadPyodide({ indexURL: PYODIDE_URL }).then(function (runtime) {
          pyodide = runtime;
          post({ type: 'runtime', ready: true });
          resolve(runtime);
        }, reject);
      };
      tag.onerror = function () { reject(new Error('The Python runtime could not be downloaded.')); };
      document.head.appendChild(tag);
    });
    return pyodidePromise;
  }

  function runJavaScript(code, inputs) {
    var logs = [];
    var originalLog = console.log;
    var originalError = console.error;
    var originalPrompt = window.prompt;
    var index = 0;
    console.log = function () { logs.push([].slice.call(arguments).map(show).join(' ')); };
    console.error = function () { logs.push('[Error] ' + [].slice.call(arguments).map(show).join(' ')); };
    window.prompt = function (label) {
      var value = inputs[index++] || '';
      logs.push((label || '') + value);
      return value;
    };
    try {
      (new Function(code))();
      return { logs: logs.join('\\n') || 'Execution complete (no output).', isError: false };
    } catch (error) {
      return { logs: (logs.length ? logs.join('\\n') + '\\n' : '') + '[Error]: ' + error.message, isError: true };
    } finally {
      console.log = originalLog;
      console.error = originalError;
      window.prompt = originalPrompt;
    }
  }

  function runPython(code, inputs) {
    return loadPyodide_().then(function (runtime) {
      var queue = inputs.slice();
      window.get_stdin_value = function () { return queue.length ? queue.shift() : ''; };
      return runtime.runPythonAsync(SETUP)
        .then(function () { return runtime.runPythonAsync(code); })
        .then(function () { return runtime.runPythonAsync('sys.stdout.getvalue()'); })
        .then(function (out) { return { logs: out || 'Execution complete (no output).', isError: false }; });
    }).catch(function (error) {
      return { logs: '[Error]: ' + ((error && error.message) || String(error)), isError: true };
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== ${JSON.stringify(PARENT_MESSAGE)}) return;

    if (data.type === 'preload') { loadPyodide_().catch(function () {}); return; }
    if (data.type !== 'run') return;

    var inputs = Array.isArray(data.inputs) ? data.inputs : [];
    var finish = function (result) {
      post({ type: 'result', id: data.id, logs: result.logs, isError: result.isError });
    };

    if (data.language === 'python') runPython(String(data.code || ''), inputs).then(finish);
    else finish(runJavaScript(String(data.code || ''), inputs));
  });

  post({ type: 'ready' });
})();
<\/script>
</body></html>`
