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
    var session = S(function (s) { return s.tungstenActiveSession; });
    var lastCmd = S(function (s) { return s.tungstenLastCommand; });
    var visible = S(function (s) { return s.tungstenPanelVisible; });
    var autoHidden = S(function (s) { return s.tungstenPanelAutoHidden; });

    const [content, setContent] = useState('');
    const captureRef = useRef(null);
    const intervalRef = useRef(null);
    var sessionRef = useRef(session);
    sessionRef.current = session;

    var doCapture = useCallback(function () {
      var s = sessionRef.current;
      if (!s) return;
      var now = Date.now();
      if (captureRef.current && now - captureRef.current < 500) return;
      captureRef.current = now;

      try {
        var execFileSync = require('child_process').execFileSync;
        var output = execFileSync('tmux', [
          '-L', s.socketName,
          'capture-pane', '-t', s.target,
          '-p', '-S', '-20',
        ], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 3000,
        });
        setContent(output.replace(/\n+$/, '') || '');
      } catch (_) {
        setContent('[capture unavailable]');
      }
    }, []);

    useEffect(function () {
      if (!session || visible === false) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      doCapture();
      intervalRef.current = setInterval(doCapture, 2000);
      return function () {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [session, visible, doCapture]);

    if (!session) return null;
    if (visible === false) return null;
    if (autoHidden === true) return null;
    if (!content) return null;

    var header = 'Tungsten: ' + session.sessionName;
    if (lastCmd && lastCmd.command) {
      header += ' | ' + lastCmd.command;
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
