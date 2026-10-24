import { useState, useEffect, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { RiPlayFill, RiLoader4Line } from 'react-icons/ri'
import { PARENT_MESSAGE, SANDBOX_ORIGIN_MESSAGE, sandboxDocument } from './playgroundSandbox'

// A snippet gets this long to finish before the sandbox is torn down, which is
// also how an endless loop is stopped without freezing the page.
const JS_TIMEOUT_MS = 10_000
const PYTHON_TIMEOUT_MS = 90_000

export default function CodePlayground({ initialCode, language = 'javascript' }) {
  const [code, setCode] = useState(initialCode || '')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(false)
  const [pyodideLoaded, setPyodideLoaded] = useState(false)
  const frameRef = useRef(null)
  const pendingRef = useRef(null)
  const requestIdRef = useRef(0)

  const isPython = language.toLowerCase() === 'python'

  /** Replace the sandbox with a fresh one (also used to kill a stuck run). */
  const resetSandbox = useCallback(() => {
    const host = frameRef.current
    if (!host) return
    host.replaceChildren()
    const frame = document.createElement('iframe')
    // No allow-same-origin: the snippet must not reach this page's origin.
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('title', 'Code playground sandbox')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'width:0;height:0;border:0;position:absolute;visibility:hidden'
    frame.srcdoc = sandboxDocument
    host.appendChild(frame)
    setPyodideLoaded(false)
  }, [])

  useEffect(() => {
    resetSandbox()
    return () => frameRef.current?.replaceChildren()
  }, [resetSandbox])

  useEffect(() => {
    function onMessage(event) {
      const frame = frameRef.current?.firstChild
      // The sandbox has an opaque origin, so identify it by window reference.
      if (!frame || event.source !== frame.contentWindow) return
      const data = event.data
      if (!data || data.source !== SANDBOX_ORIGIN_MESSAGE) return

      if (data.type === 'ready') {
        if (isPython) frame.contentWindow.postMessage({ source: PARENT_MESSAGE, type: 'preload' }, '*')
        return
      }
      if (data.type === 'runtime') { setPyodideLoaded(Boolean(data.ready)); return }
      if (data.type === 'result' && pendingRef.current?.id === data.id) {
        pendingRef.current.settle({ logs: data.logs, isError: data.isError })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isPython])

  const handleRun = async () => {
    const frame = frameRef.current?.firstChild
    if (!frame?.contentWindow || isRunning) return

    setIsRunning(true)
    setOutput('Running...')
    setError(false)

    const id = ++requestIdRef.current
    const timeoutMs = isPython ? PYTHON_TIMEOUT_MS : JS_TIMEOUT_MS

    const result = await new Promise(resolve => {
      let done = false
      const settle = value => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        pendingRef.current = null
        resolve(value)
      }
      const timer = window.setTimeout(() => {
        // The sandbox is unresponsive (usually an endless loop): discard it.
        resetSandbox()
        settle({
          logs: `[Error]: Execution stopped after ${Math.round(timeoutMs / 1000)}s. Check for a loop that never ends.`,
          isError: true,
        })
      }, timeoutMs)

      pendingRef.current = { id, settle }
      frame.contentWindow.postMessage(
        { source: PARENT_MESSAGE, type: 'run', id, language: isPython ? 'python' : 'javascript', code, inputs: [] },
        '*'
      )
    })

    setOutput(result.logs)
    setError(result.isError)
    setIsRunning(false)
  }

  const extensions = isPython ? [python()] : [javascript({ jsx: true })]

  return (
    <div className="blitz-editor-wrap">
      {/* Header */}
      <div className="blitz-editor-header">
        <div className="blitz-editor-tabs">
          <div className="blitz-editor-tab active">
            <span style={{ color: isPython ? '#f59e0b' : '#facc15', marginRight: '0.5rem' }}>{isPython ? 'Py' : 'JS'}</span>
            {isPython ? 'main.py' : 'index.js'}
          </div>
        </div>
        <div className="blitz-editor-actions">
          <button 
            className="blitz-run-btn"
            onClick={handleRun}
            disabled={isRunning || (isPython && !pyodideLoaded)}
          >
            {isRunning ? <RiLoader4Line className="spin" size={16} /> : <RiPlayFill size={16} />}
            {isPython && !pyodideLoaded ? 'Loading Env...' : 'Run Code'}
          </button>
        </div>
      </div>
      
      <div className="blitz-editor-body">
        <CodeMirror
          value={code}
          height="300px"
          theme={vscodeDark}
          extensions={extensions}
          onChange={(val) => setCode(val)}
          style={{ fontSize: '14px', fontFamily: '"JetBrains Mono", monospace' }}
        />
      </div>

      {/* Console Output Panel - Always visible */}
      <div className="blitz-editor-terminal">
        <div className="blitz-term-header">
          <div className="blitz-term-title">Terminal Output</div>
          <button onClick={() => setOutput('')} className="blitz-term-clear">Clear</button>
        </div>
        <pre className={`blitz-term-output ${error ? 'error' : 'success'}`}>
          {output || 'Ready for execution...'}
        </pre>
      </div>

      {/* Holds the sandboxed iframe the snippet actually runs in. */}
      <div ref={frameRef} />
    </div>
  )
}
