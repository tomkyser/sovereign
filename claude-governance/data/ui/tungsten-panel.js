// Clean-Room TungstenLiveMonitor — Persistent Terminal Panel
// Renders tmux capture-pane output in CC's Ink UI. Receives React primitives
// as props from the render tree injection patch (D3) since this file runs
// outside the binary's module scope.

module.exports = function createTungstenPanel(props) {
  const { R, S, B, T } = props;
  // R = React (createElement, useState, useEffect, useRef, useCallback)
  // S = useAppState (Zustand-like selector hook)
  // B = Box (Ink layout component)
  // T = Text (Ink text component)

  const { useState, useEffect, useRef, useCallback } = R;

  function TungstenPanel() {
    const appState = S(function (s) {
      return {
        session: s.tungstenActiveSession,
        lastCmd: s.tungstenLastCommand,
        visible: s.tungstenPanelVisible,
        autoHidden: s.tungstenPanelAutoHidden,
      };
    });

    const [content, setContent] = useState('');
    const captureRef = useRef(null);
    const intervalRef = useRef(null);

    const doCapture = useCallback(function () {
      if (!appState.session) return;
      var now = Date.now();
      // Debounce: skip if captured within last 500ms
      if (captureRef.current && now - captureRef.current < 500) return;
      captureRef.current = now;

      try {
        var execFileSync = require('child_process').execFileSync;
        var output = execFileSync('tmux', [
          '-L', appState.session.socketName,
          'capture-pane', '-t', appState.session.target,
          '-p', '-S', '-20',
        ], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 3000,
        });
        // Trim trailing blanks
        setContent(output.replace(/\n+$/, '') || '');
      } catch (_) {
        setContent('[capture unavailable]');
      }
    }, [appState.session]);

    useEffect(function () {
      if (!appState.session || appState.visible === false) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      // Initial capture
      doCapture();
      // Poll every 2 seconds
      intervalRef.current = setInterval(doCapture, 2000);
      return function () {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [appState.session, appState.visible, doCapture]);

    // Render nothing if no active session or hidden
    if (!appState.session) return null;
    if (appState.visible === false) return null;
    if (appState.autoHidden === true) return null;
    if (!content) return null;

    var header = 'Tungsten: ' + appState.session.sessionName;
    if (appState.lastCmd && appState.lastCmd.command) {
      header += ' | ' + appState.lastCmd.command;
    }

    return R.createElement(B, {
      borderStyle: 'single',
      borderColor: 'cyan',
      paddingLeft: 1,
      paddingRight: 1,
      flexDirection: 'column',
      width: '100%',
    },
      R.createElement(T, { color: 'cyan', bold: true }, header),
      R.createElement(T, { dimColor: true }, content)
    );
  }

  return TungstenPanel;
};
